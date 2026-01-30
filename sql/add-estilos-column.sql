-- Script para agregar el campo 'estilos' a la tabla 'registro' en MariaDB
-- Uso: Ejecutar en la base de datos moibe_splashmix

ALTER TABLE registro ADD COLUMN estilos VARCHAR(500) DEFAULT NULL COMMENT 'Estilos artísticos detectados, separados por comas' AFTER prompt_eval;

-- Verificar que se agregó correctamente
SHOW COLUMNS FROM registro LIKE 'estilos';

-- Opcional: Ver la estructura completa de la tabla
-- DESCRIBE registro;
