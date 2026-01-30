/**
 * Script para agregar la columna 'estilos' a la tabla 'registro' en MariaDB
 * Uso: node scripts/add-estilos-column.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuración de MariaDB
const mariadbConfig = {
  host: '45.88.105.161', // IP de sql.moibe.com
  port: 3306,
  user: 'moibe_splashmix',
  password: 'SplashMix2025@',
  database: 'moibe_splashmix',
};

async function main() {
  console.log('🚀 Iniciando modificación de tabla registro...\n');

  try {
    // Conectar a MariaDB
    console.log('🔌 Conectando a MariaDB...');
    const connection = await mysql.createConnection(mariadbConfig);
    console.log('✅ Conectado a MariaDB\n');

    // Verificar si la columna ya existe
    console.log('🔍 Verificando si la columna estilos ya existe...');
    const [rows] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='registro' AND COLUMN_NAME='estilos'"
    );

    if (rows.length > 0) {
      console.log('ℹ️ La columna estilos ya existe en la tabla registro');
      await connection.end();
      process.exit(0);
    }

    // Agregar columna estilos
    console.log('➕ Agregando columna estilos...');
    const addColumnSQL = `
      ALTER TABLE registro 
      ADD COLUMN estilos VARCHAR(500) DEFAULT NULL 
      COMMENT 'Estilos artísticos detectados, separados por comas' 
      AFTER prompt_eval;
    `;

    await connection.execute(addColumnSQL);
    console.log('✅ Columna estilos agregada exitosamente\n');

    // Verificar que se agregó
    console.log('🔍 Verificando estructura de tabla...');
    const [columns] = await connection.execute('DESCRIBE registro');
    const estilosColumn = columns.find(col => col.Field === 'estilos');
    
    if (estilosColumn) {
      console.log('✅ Estructura de tabla verificada:');
      console.log(`   • Campo: ${estilosColumn.Field}`);
      console.log(`   • Tipo: ${estilosColumn.Type}`);
      console.log(`   • Nulo: ${estilosColumn.Null}`);
      console.log(`   • Default: ${estilosColumn.Default}`);
    }

    await connection.end();

    console.log('\n✅ Modificación completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
