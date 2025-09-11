import { socketIOWrapper } from '../services/socketServiceWrapper';

/**
 * Función para probar la inicialización de Socket.IO
 */
export const testSocketIOInitialization = async (): Promise<boolean> => {
  try {
    console.log('🧪 SocketTest: Iniciando prueba de Socket.IO...');
    
    // Intentar inicializar Socket.IO
    await socketIOWrapper.initialize();
    
    // Verificar que esté listo
    if (!socketIOWrapper.isReady()) {
      throw new Error('Socket.IO no está listo después de la inicialización');
    }
    
    console.log('✅ SocketTest: Socket.IO inicializado correctamente');
    return true;
  } catch (error) {
    console.error('❌ SocketTest: Error en la prueba de Socket.IO:', error);
    return false;
  }
};

/**
 * Función para probar la creación de un socket
 */
export const testSocketCreation = async (url: string = 'http://localhost:3000'): Promise<boolean> => {
  try {
    console.log('🧪 SocketTest: Probando creación de socket...');
    
    // Inicializar primero
    await socketIOWrapper.initialize();
    
    // Crear un socket de prueba
    const socket = await socketIOWrapper.createSocket(url, {
      autoConnect: false,
      timeout: 5000
    });
    
    if (!socket) {
      throw new Error('No se pudo crear el socket');
    }
    
    console.log('✅ SocketTest: Socket creado correctamente');
    
    // Limpiar el socket de prueba
    if (socket.disconnect) {
      socket.disconnect();
    }
    
    return true;
  } catch (error) {
    console.error('❌ SocketTest: Error creando socket:', error);
    return false;
  }
};

/**
 * Ejecuta todas las pruebas de Socket.IO
 */
export const runSocketIOTests = async (): Promise<{ initialization: boolean; creation: boolean }> => {
  console.log('🧪 SocketTest: Ejecutando todas las pruebas de Socket.IO...');
  
  const initialization = await testSocketIOInitialization();
  const creation = await testSocketCreation();
  
  console.log('🧪 SocketTest: Resultados:', { initialization, creation });
  
  return { initialization, creation };
};
