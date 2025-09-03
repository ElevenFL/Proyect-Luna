import { Auth } from '../config/amplify';
import ApiService from '../services/apiService';

async function testRegistrationFlow() {
  console.log('🧪 Probando flujo de registro completo...\n');
  
  try {
    // Paso 1: Simular registro en Amplify
    console.log('📋 Paso 1: Simulando registro en Amplify...');
    const testUsername = `testuser_${Date.now()}`;
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'TestPass123!';
    
    console.log(`   Username: ${testUsername}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);
    
    // Paso 2: Probar endpoint de sincronización directamente
    console.log('📋 Paso 2: Probando endpoint de sincronización...');
    const syncResponse = await ApiService.post('/users/sync-amplify', {
      username: testUsername,
      email: testEmail,
      sub: `test_sub_${Date.now()}`
    });
    
    if (syncResponse.success) {
      console.log('✅ Sincronización exitosa');
      console.log(`   Usuario ID: ${syncResponse.data?.user?.id}`);
      console.log(`   Profile completed: ${syncResponse.data?.user?.profileCompleted}`);
    } else {
      console.log('❌ Error en sincronización:', syncResponse.message);
    }
    
    console.log('\n🎉 Prueba completada');
    
  } catch (error) {
    console.log('\n❌ Error en la prueba:');
    console.log(`   Tipo: ${error.name}`);
    console.log(`   Mensaje: ${error.message}`);
  }
}

testRegistrationFlow().catch(console.error);
