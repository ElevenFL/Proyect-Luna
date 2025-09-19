import { Story } from '../models/Stories.js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * Script para limpiar stories expirados
 * Se puede ejecutar manualmente o programar con cron
 */
async function cleanupExpiredStories() {
  try {
    console.log('🧹 Iniciando limpieza de stories expirados...');
    
    const deletedCount = await Story.cleanupExpiredStories();
    
    console.log(`✅ Limpieza completada: ${deletedCount} stories expirados eliminados`);
    
    if (deletedCount > 0) {
      console.log('💾 Espacio liberado en la base de datos');
    } else {
      console.log('✨ No hay stories expirados para limpiar');
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza de stories:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupExpiredStories()
    .then(() => {
      console.log('🎉 Script de limpieza completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script de limpieza falló:', error);
      process.exit(1);
    });
}

export { cleanupExpiredStories };

