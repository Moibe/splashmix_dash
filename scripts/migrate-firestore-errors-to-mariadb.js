/**
 * Script para migrar registros de errores de Firestore (log_errores_ig) a MariaDB mediante API
 * Uso: node scripts/migrate-firestore-errors-to-mariadb.js
 * 
 * Similar al script principal pero:
 * - Lee de log_errores_ig
 * - Usa proveedor_intentado como proveedor
 * - Marca los registros como errores en prompt_eval
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuración Firebase desde .env
const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const apiUrl = process.env.VITE_API_URL;

// Inicializar Firebase Admin (sin credenciales, usa Application Default Credentials del entorno)
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    ...firebaseConfig,
  });
} catch (err) {
  // Si ya está inicializado, continúa
  if (err.code !== 'app/duplicate-app') {
    throw err;
  }
}

const db = admin.firestore();

async function main() {
  console.log('🚀 Iniciando migración de errores de Firestore a MariaDB...\n');

  try {
    // 1. Leer todos los documentos de log_errores_ig
    console.log('📖 Leyendo documentos de log_errores_ig...');
    const logSnapshot = await db.collection('log_errores_ig').get();
    console.log(`✅ Se encontraron ${logSnapshot.size} registros de errores en log_errores_ig\n`);

    // 2. Leer todos los usuarios de usuarios_ig
    console.log('👥 Leyendo documentos de usuarios_ig...');
    const usuariosSnapshot = await db.collection('usuarios_ig').get();
    const usuariosMap = new Map();

    usuariosSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        usuariosMap.set(data.email, {
          uid: data.uid,
          display_name: data.displayName,
          email: data.email,
          pais: data.country_header || data.country_ip || 'N/A',
          fecha_registro: data.fecha_registro,
          usos: data.usos || 0,
        });
      }
    });
    console.log(`✅ Se encontraron ${usuariosMap.size} usuarios únicos\n`);

    // 3. Procesar cada registro de log_errores_ig y enviarlo a la API
    console.log('⚙️ Procesando registros de errores...\n');
    let insertados = 0;
    let errores = 0;
    const registrosArray = Array.from(logSnapshot.docs);

    for (let i = 0; i < registrosArray.length; i++) {
      try {
        const logDoc = registrosArray[i];
        const logData = logDoc.data();
        const email = logData.email || logData.correo;

        if (!email) {
          console.warn(`⚠️ Registro sin email/correo: ${logDoc.id}`);
          errores++;
          continue;
        }

        // Obtener datos del usuario
        const userData = usuariosMap.get(email);
        if (!userData) {
          console.warn(`⚠️ Usuario no encontrado para email: ${email}`);
          errores++;
          continue;
        }

        // Preparar payload para la API
        // Nota: prompt_eval contiene el error que ocurrió
        // Truncar prompt a 255 caracteres si es muy largo
        const promptTruncado = (logData.prompt || '').substring(0, 255);

        const payload = {
          uid: userData.uid,
          display_name: userData.display_name,
          pais: userData.pais,
          correo: email,
          fecha_registro: userData.fecha_registro,
          usos: userData.usos,
          prompt: promptTruncado,
          seed: logData.seed || 182,
          proveedor: logData.proveedor_intentado || 'DESCONOCIDO',
          prompt_type: logData.prompt_type || '',
          prompt_eval: `❌ ERROR: ${logData.razon_error || 'Error desconocido'}`,
          ritmo: logData.ritmo || 0,
        };

        // Enviar a la API
        const response = await fetch(`${apiUrl}/registrar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          insertados++;
        } else {
          const errorText = await response.text();
          console.warn(`⚠️ Error al insertar registro de error: ${response.status} ${response.statusText}`);
          console.warn(`   Email: ${email}`);
          console.warn(`   Respuesta: ${errorText}\n`);
          errores++;
        }

        if ((insertados + errores) % 10 === 0) {
          console.log(`  📊 Procesados: ${insertados + errores}/${registrosArray.length}`);
        }
      } catch (error) {
        console.error(`❌ Error procesando registro:`, error.message);
        errores++;
      }
    }

    console.log('\n✅ Migración de errores completada!');
    console.log(`📊 Resumen:`);
    console.log(`   • Insertados: ${insertados}`);
    console.log(`   • Errores: ${errores}`);
    console.log(`   • Total procesados: ${insertados + errores}/${registrosArray.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
