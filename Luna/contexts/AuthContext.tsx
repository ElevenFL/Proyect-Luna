import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { Auth } from '../config/amplify';
import { ImageService } from '../services/imageService';
import { API_CONFIG } from '../config/api';
import ApiService from '../services/apiService';
import optimizedChatService from '../services/optimizedChatService';
import { smartLog } from '../config/logging';
import backgroundSyncService from '../services/backgroundSyncService';

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  birthDate?: string;
  gender?: string;
  profileImage?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  profileCompleted?: boolean;
  active?: boolean;
  lastLogin?: string;
  loginAttempts?: number;
  lockUntil?: string;
  amplifySub?: string; // Agregar amplifySub para compatibilidad
}

interface LoginResponse {
  success: boolean;
  message: string;
  error?: string;
  token?: string;
  user?: User;
  remainingAttempts?: number;
  lockExpires?: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  error?: string;
  token?: string;
  user?: User;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

interface VerifyResponse {
  success: boolean;
  message: string;
  error?: string;
}

interface ResendCodeResponse {
  success: boolean;
  message: string;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<LoginResponse>;
  register: (username: string, email: string, password: string) => Promise<RegisterResponse>;
  confirmSignUp: (code: string) => Promise<VerifyResponse>;
  resendConfirmationCode: (username?: string) => Promise<ResendCodeResponse>;
  logout: () => Promise<void>;
  updateUserProfile: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // WebSocket management moved to ConversationProvider

  useEffect(() => {
    loadStoredAuth();
    
    // Listener para cambios en el estado de la app
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  // Efecto para sincronizar el token con ImageService, ApiService y SocketService
  useEffect(() => {
    if (token && user) {
      ImageService.setAuthToken(token);
      ApiService.setAuthToken(token);
      
      // Importar servicios dinámicamente para evitar dependencias circulares
      Promise.all([
        import('../services/socketService'),
        import('../services/optimizedChatService')
      ]).then(([{ socketService }, { default: optimizedChatService }]) => {
        socketService.setAuthToken(token);
        
        // Inicializar optimizedChatService una sola vez aquí
        if (!optimizedChatService.isInitialized()) {
          optimizedChatService.initialize(user.id).then(() => {
            smartLog.info('AuthContext: OptimizedChatService inicializado globalmente');
          }).catch((error) => {
            smartLog.error('AuthContext: Error inicializando OptimizedChatService:', error);
          });
        }
        
        smartLog.info('AuthContext: Token sincronizado con SocketService');
      });
      
      smartLog.info('AuthContext: Token sincronizado con ImageService y ApiService');
    }
  }, [token, user]);

      // Manejar cambios en el estado de la app
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      smartLog.info(`AuthContext: Cambio de estado de la app: ${appState} -> ${nextAppState}`);
      
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App vuelve al primer plano
        smartLog.info('AuthContext: App vuelve al primer plano, verificando sesión...');
        handleAppForeground();
      } else if (nextAppState.match(/inactive|background/)) {
        // App pasa a segundo plano
        smartLog.info('AuthContext: App pasa a segundo plano, limpiando estado temporal...');
        handleAppBackground();
      }
      
      setAppState(nextAppState);
    };

  // Manejar cuando la app vuelve al primer plano
  const handleAppForeground = async () => {
    try {
              // Verificar si la sesión sigue siendo válida
        if (token && user) {
          smartLog.info('AuthContext: Verificando sesión al volver al primer plano...');
          
          // Intentar verificar la sesión de Amplify
          try {
            const session = await Auth.fetchAuthSession();
            if (!session.tokens) {
              smartLog.info('AuthContext: Sesión de Amplify expirada, limpiando estado...');
              await logout();
            }
          } catch (error) {
            smartLog.error('AuthContext: Error verificando sesión de Amplify:', error);
            await logout();
          }
        }
      } catch (error) {
        smartLog.error('AuthContext: Error en handleAppForeground:', error);
      }
    };
    
    // Manejar cuando la app pasa a segundo plano
    const handleAppBackground = () => {
      // Limpiar cualquier estado temporal o alertas activas
      smartLog.info('AuthContext: Limpiando estado temporal al pasar a segundo plano...');
      
      // Aquí podrías agregar lógica para limpiar alertas, modales, etc.
      // Por ejemplo, si tienes algún estado de alerta activa, la limpiarías aquí
    };

  const loadStoredAuth = async () => {
    try {
      console.log('🔄 AuthContext: Iniciando carga de autenticación almacenada...');
      
      // Primero intentar cargar datos guardados localmente
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('userData');
      const storedAuthType = await AsyncStorage.getItem('authType');
      
      console.log('🔄 AuthContext: Datos almacenados:', {
        hasToken: !!storedToken,
        hasUser: !!storedUser,
        hasAuthType: !!storedAuthType,
        authType: storedAuthType
      });
      
      // Si hay datos locales, intentar validarlos
      if (storedToken && storedUser && storedAuthType) {
        console.log('🔄 AuthContext: Datos encontrados, validando...');
        const userData = JSON.parse(storedUser);
        
        try {
          if (storedAuthType === 'amplify') {
            // Verificar sesión de Amplify
            const session = await Auth.fetchAuthSession();
            const currentUser = await Auth.getCurrentUser();
            
            if (session.tokens && currentUser) {
              const accessToken = session.tokens.accessToken?.toString();
              
              if (accessToken) {
                setToken(accessToken);
                setUser(userData);
                ImageService.setAuthToken(accessToken);
                
                // Configurar token en socketService
                import('../services/socketService').then(({ socketService }) => {
                  socketService.setAuthToken(accessToken);
                });
                
                // Sincronizar el estado del perfil con la base de datos
                try {
                  await syncUserProfileFromDatabase(userData, accessToken);
                } catch (syncError) {
                  smartLog.error('Error sincronizando perfil del usuario:', syncError);
                  // Continuar sin sincronización si hay error
                }
                
                return;
              }
            }
          } else {
            // Verificar token JWT local
            try {
              const response = await fetch(`${API_CONFIG.BASE_URL}/users/verify-token`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${storedToken}`
                }
              });
              
              if (response.ok) {
                setToken(storedToken);
                setUser(userData);
                ImageService.setAuthToken(storedToken);
                
                // Sincronizar el estado del perfil con la base de datos
                try {
                  await syncUserProfileFromDatabase(userData, storedToken);
                } catch (syncError) {
                  smartLog.error('Error sincronizando perfil del usuario:', syncError);
                  // Continuar sin sincronización si hay error
                }
                
                return;
              }
                          } catch (error) {
                smartLog.error('Error verificando token JWT:', error);
              }
            }
          } catch (error) {
            smartLog.error('Error verificando sesión:', error);
          }
          
          // Si llegamos aquí, los datos almacenados no son válidos
          await AsyncStorage.multiRemove(['authToken', 'userData', 'authType']);
        }
        
        // Intentar obtener sesión de Amplify
        try {
          console.log('🔄 AuthContext: Intentando obtener sesión de Amplify...');
          const session = await Auth.fetchAuthSession();
          const currentUser = await Auth.getCurrentUser();
          
          if (session.tokens && currentUser) {
            console.log('🔄 AuthContext: Sesión de Amplify encontrada, creando usuario...');
            const userData: User = {
              id: currentUser.userId,
              username: currentUser.username,
              email: currentUser.signInDetails?.loginId || '',
              profileCompleted: true, // Iniciar como true y actualizar según la DB si es posible
              active: true,
              lastLogin: new Date().toISOString()
            };
            
            const accessToken = session.tokens.accessToken?.toString();
            
            if (accessToken) {
              setUser(userData);
              setToken(accessToken);
              ImageService.setAuthToken(accessToken);
              
              // Sincronizar el estado del perfil con la base de datos
              try {
                console.log('🔄 AuthContext: Sincronizando perfil desde sesión de Amplify...');
                await syncUserProfileFromDatabase(userData, accessToken);
              } catch (syncError) {
                console.error('❌ AuthContext: Error sincronizando perfil desde Amplify:', syncError);
                // Continuar sin sincronización si hay error
              }
              
              // Guardar en AsyncStorage
              await AsyncStorage.multiSet([
                ['authToken', accessToken],
                ['userData', JSON.stringify(userData)],
                ['authType', 'amplify']
              ]);
            }
          }
        } catch (amplifyError) {
          // Error de Amplify es esperado cuando no hay sesión activa
          smartLog.info('No hay sesión activa en Amplify');
        }
      } catch (error) {
        smartLog.error('Error cargando datos de autenticación:', error);
        // Limpiar datos en caso de error
        await AsyncStorage.multiRemove(['authToken', 'userData', 'authType']);
      } finally {
        console.log('🔄 AuthContext: Finalizando carga de autenticación, estableciendo isLoading = false');
        setIsLoading(false);
      }
  };

  const login = async (usernameOrEmail: string, password: string): Promise<LoginResponse> => {
    try {
      const signInResult = await Auth.signIn({
        username: usernameOrEmail,
        password: password,
      });

      if (signInResult.isSignedIn) {
        const session = await Auth.fetchAuthSession();
        const currentUser = await Auth.getCurrentUser();
        
        const userData: User = {
          id: currentUser.userId,
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId || '',
          profileCompleted: true, // Iniciar como true y solo cambiar a false si es necesario
          active: true,
          lastLogin: new Date().toISOString(),
          loginAttempts: 0,
          amplifySub: currentUser.userId // Guardar el amplifySub original
        };
        
        const accessToken = session.tokens?.accessToken?.toString();
        
        // Sincronizar automáticamente con DynamoDB después del login exitoso
        try {
          console.log('Sincronizando usuario después del login con DynamoDB...');
          
          // Establecer el token en ApiService antes de hacer la sincronización
          if (accessToken) {
            ApiService.setAuthToken(accessToken);
          }
          
          // Validar que tenemos un email válido antes de sincronizar
          const email = currentUser.signInDetails?.loginId || '';
          const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
          
          if (!email || !emailRegex.test(email) || email === currentUser.username) {
            console.log('⚠️ No se puede sincronizar: email inválido o faltante');
            console.log('📧 Email recibido:', email);
            console.log('👤 Username:', currentUser.username);
            // Continuar sin sincronización si no hay email válido
          } else {
            const syncResponse = await ApiService.post('/users/sync-amplify', {
              username: currentUser.username,
              email: email,
              sub: currentUser.userId
            });
            
            if (syncResponse.success && syncResponse.data) {
              console.log('✅ Usuario sincronizado exitosamente después del login');
              // Actualizar userData con la información de DynamoDB
              userData.id = syncResponse.data.user.id;
              userData.profileCompleted = syncResponse.data.user.profileCompleted;
              // Mantener el amplifySub original
              userData.amplifySub = currentUser.userId;
            } else {
              console.log('⚠️ Error en sincronización, verificando si es usuario nuevo o existente');
              // Si la sincronización falla, asumir que es un usuario existente con perfil completo
              // Solo usuarios nuevos necesitarían completar el onboarding
              console.log('⚠️ Manteniendo profileCompleted como true debido a error de sincronización');
            }
          }
        } catch (syncError) {
          console.error('❌ Error en sincronización después del login:', syncError);
          
          // Proporcionar información más específica sobre el error
          if (syncError instanceof Error) {
            if (syncError.message.includes('Error interno del servidor')) {
              console.error('💡 Posibles causas del error interno:');
              console.error('   - La tabla de DynamoDB no existe o no está configurada correctamente');
              console.error('   - Credenciales de AWS incorrectas o permisos insuficientes');
              console.error('   - El backend no está corriendo o no es accesible');
              console.error('   - Error en la estructura de la base de datos');
            } else if (syncError.message.includes('fetch')) {
              console.error('💡 Error de conectividad:');
              console.error('   - Verifica que el backend esté corriendo');
              console.error('   - Verifica la URL del backend en la configuración');
              console.error('   - Verifica la conexión de red');
            }
          }
          
          // Continuar con el flujo aunque haya error de sincronización
          // Mantener profileCompleted como true asumiendo que es un usuario existente
          console.log('⚠️ Continuando con el login sin sincronización...');
          console.log('🔧 Manteniendo profileCompleted como true debido a error de sincronización (asumiendo usuario existente)');
        }
        
        setUser(userData);
        setToken(accessToken || null);
        
        // Sincronizar token con ImageService
        if (accessToken) {
          ImageService.setAuthToken(accessToken);
        }
        
        // Inicializar servicios de chat con sincronización en segundo plano
        try {
          await optimizedChatService.initialize(userData.id);
          smartLog.info('AuthContext: Servicios de chat inicializados con sincronización en segundo plano');
        } catch (chatError) {
          smartLog.error('AuthContext: Error inicializando servicios de chat:', chatError);
        }
        
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        if (accessToken) {
          await AsyncStorage.setItem('authToken', accessToken);
        }
        
        return { 
          success: true, 
          message: 'Inicio de sesión exitoso',
          token: accessToken,
          user: userData
        };
      } else {
        return { 
          success: false, 
          message: 'Error en el inicio de sesión',
          error: 'LOGIN_FAILED'
        };
      }
    } catch (error) {
      smartLog.error('Error en login:', error);
      smartLog.info('Error message:', error instanceof Error ? error.message : 'Unknown error');
      
      if (error instanceof Error) {
        // Manejar errores específicos del backend
        if (error.message.includes('ACCOUNT_LOCKED')) {
          const lockData = JSON.parse(error.message);
          return {
            success: false,
            message: lockData.message,
            error: 'ACCOUNT_LOCKED',
            lockExpires: lockData.lockExpires
          };
        }
        
        if (error.message.includes('INVALID_CREDENTIALS')) {
          const errorData = JSON.parse(error.message);
          return {
            success: false,
            message: 'Credenciales inválidas',
            error: 'INVALID_CREDENTIALS',
            remainingAttempts: errorData.remainingAttempts
          };
        }
        
        if (error.message.includes('ACCOUNT_DISABLED')) {
          return {
            success: false,
            message: 'Cuenta desactivada. Por favor, contacte a soporte.',
            error: 'ACCOUNT_DISABLED'
          };
        }
        
        // Manejar errores de Amplify
        if (error.message.includes('Incorrect username or password') || error.message.includes('NotAuthorizedException')) {
          // Para errores de credenciales incorrectas, siempre devolver INVALID_CREDENTIALS
          // No intentar verificar si el usuario existe, ya que puede causar redirecciones incorrectas al verify
          smartLog.info('AuthContext: Credenciales incorrectas detectadas, devolviendo INVALID_CREDENTIALS');
          return {
            success: false,
            message: 'Usuario o contraseña incorrectos. Verifica tus credenciales.',
            error: 'INVALID_CREDENTIALS'
          };
        }
        
        if (error.message.includes('User is not confirmed') || error.message.includes('UserNotConfirmedException')) {
          // Guardar el username para reenviar el código
          await AsyncStorage.setItem('pendingUsername', usernameOrEmail);
          
          smartLog.info('AuthContext: Usuario no confirmado detectado, redirigiendo al verify');
          
          // Intentar reenviar el código automáticamente
          try {
            await Auth.resendSignUpCode({
              username: usernameOrEmail
            });
                      } catch (resendError) {
              smartLog.info('No se pudo reenviar el código automáticamente');
            }
          
          return {
            success: false,
            message: 'Usuario no confirmado. Se ha reenviado el código de verificación a tu email.',
            error: 'USER_NOT_CONFIRMED'
          };
        }
      }
      
      return { 
        success: false, 
        message: 'Error de conexión',
        error: 'CONNECTION_ERROR'
      };
    }
  };

  const register = async (username: string, email: string, password: string): Promise<RegisterResponse> => {
    try {
      // Validaciones locales antes de enviar al servidor
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return {
          success: false,
          message: 'Formato de email inválido',
          error: 'INVALID_EMAIL_FORMAT'
        };
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[a-zA-Z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
      if (!passwordRegex.test(password)) {
        return {
          success: false,
          message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)',
          error: 'INVALID_PASSWORD_FORMAT'
        };
      }

      const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!usernameRegex.test(username)) {
        return {
          success: false,
          message: 'El username debe tener entre 3 y 30 caracteres y solo puede contener letras, números, guiones y guiones bajos',
          error: 'INVALID_USERNAME_FORMAT'
        };
      }

      const signUpResult = await Auth.signUp({
        username: username,
        password: password,
        options: {
          userAttributes: {
            email: email,
          },
        },
      });

      // Nota: En Amplify v6, el ID del usuario solo está disponible después de la confirmación
      // La sincronización con DynamoDB se realizará después de confirmar el email

      if (signUpResult.isSignUpComplete) {
        // Si el registro está completo, hacer login automático
        const loginResponse = await login(username, password);
        if (loginResponse.success) {
          return {
            success: true,
            message: 'Registro y login exitosos',
            token: loginResponse.token,
            user: loginResponse.user
          };
        } else {
          return {
            success: false,
            message: 'Registro exitoso pero error en login automático',
            error: 'AUTO_LOGIN_FAILED'
          };
        }
      } else {
        // El registro no está completo, requiere confirmación
        // Guardar el username y contraseña para la verificación posterior
        await AsyncStorage.setItem('pendingUsername', username);
        await AsyncStorage.setItem('pendingPassword', password);
        
        return { 
          success: true, 
          message: 'Registro exitoso. Por favor, verifica tu email para confirmar tu cuenta.',
          error: 'CONFIRMATION_REQUIRED'
        };
      }
    } catch (error) {
      smartLog.error('Error en registro:', error);
      
      if (error instanceof Error) {
        // Manejar errores específicos del backend
        if (error.message.includes('EMAIL_EXISTS')) {
          return {
            success: false,
            message: 'El email ya está registrado',
            error: 'EMAIL_EXISTS'
          };
        }
        
        if (error.message.includes('USERNAME_EXISTS')) {
          return {
            success: false,
            message: 'El nombre de usuario ya está en uso',
            error: 'USERNAME_EXISTS'
          };
        }
        
        if (error.message.includes('VALIDATION_ERROR')) {
          try {
            const errorData = JSON.parse(error.message);
            return {
              success: false,
              message: 'Error de validación',
              error: 'VALIDATION_ERROR',
              details: errorData.details
            };
          } catch {
            // Si no podemos parsear el error, devolver mensaje genérico
            return {
              success: false,
              message: 'Error de validación',
              error: 'VALIDATION_ERROR'
            };
          }
        }
        
        // Manejar errores de Amplify
        if (error.message.includes('UsernameExistsException')) {
          return {
            success: false,
            message: 'El nombre de usuario ya existe. Si ya te registraste, verifica tu email o intenta iniciar sesión.',
            error: 'USERNAME_EXISTS'
          };
        }
        
        if (error.message.includes('InvalidPasswordException')) {
          return {
            success: false,
            message: 'La contraseña no cumple con los requisitos mínimos',
            error: 'INVALID_PASSWORD_FORMAT'
          };
        }
        
        if (error.message.includes('InvalidParameterException')) {
          return {
            success: false,
            message: 'Datos de entrada inválidos',
            error: 'INVALID_PARAMETERS'
          };
        }
      }
      
      return { 
        success: false, 
        message: 'Error de conexión',
        error: 'CONNECTION_ERROR'
      };
    }
  };

  const logout = async () => {
    try {
      smartLog.info('AuthContext: Iniciando proceso de logout...');
      
      // 1. Cerrar sesión en AWS Amplify
      await Auth.signOut();
      smartLog.info('AuthContext: Sesión de Amplify cerrada');
      
      // 2. Limpiar estado local
      setUser(null);
      setToken(null);
      smartLog.info('AuthContext: Estado local limpiado');
      
      // 3. Limpiar token de ImageService
      ImageService.setAuthToken('');
      smartLog.info('AuthContext: Token de ImageService limpiado');
      
      // 4. Desconectar servicios de chat y WebSockets
      try {
        backgroundSyncService.stop();
        smartLog.info('AuthContext: Servicios de chat desconectados');
      } catch (chatError) {
        smartLog.error('AuthContext: Error desconectando servicios de chat:', chatError);
      }

      // WebSocket disconnection now handled by ConversationProvider
      
      // 4. Limpiar todos los datos almacenados localmente
      await AsyncStorage.multiRemove([
        'authToken',
        'userData',
        'authType',
        'pendingUsername',
        'pendingPassword'
      ]);
      smartLog.info('AuthContext: Datos de AsyncStorage limpiados');
      
      smartLog.info('AuthContext: Logout completado exitosamente');
      
    } catch (error) {
      smartLog.error('AuthContext: Error en logout:', error);
      
      // Limpiar estado local incluso si hay error
      setUser(null);
      setToken(null);
      ImageService.setAuthToken('');
      
      // WebSocket cleanup now handled by ConversationProvider
      
      // Intentar limpiar AsyncStorage incluso si hay error
      try {
        await AsyncStorage.multiRemove([
          'authToken',
          'userData',
          'authType',
          'pendingUsername',
          'pendingPassword'
        ]);
        smartLog.info('AuthContext: Datos limpiados después de error');
      } catch (cleanupError) {
        smartLog.error('AuthContext: Error limpiando datos:', cleanupError);
      }
    }
  };

  const confirmSignUp = async (code: string): Promise<VerifyResponse> => {
    try {
      // Obtener el username del usuario actual (si está disponible)
      // En un flujo real, necesitarías almacenar el username durante el registro
      const storedUsername = await AsyncStorage.getItem('pendingUsername');
      
      if (!storedUsername) {
        return {
          success: false,
          message: 'No se encontró información de usuario pendiente. Por favor, regístrate nuevamente.',
          error: 'NO_PENDING_USER'
        };
      }

      const confirmResult = await Auth.confirmSignUp({
        username: storedUsername,
        confirmationCode: code
      });

      if (confirmResult.isSignUpComplete) {
        // Limpiar el username pendiente
        await AsyncStorage.removeItem('pendingUsername');
        
        // Sincronizar usuario con el backend personalizado
        try {
          const session = await Auth.fetchAuthSession();
          const currentUser = await Auth.getCurrentUser();
          
          if (session.tokens && currentUser) {
            const accessToken = session.tokens.accessToken?.toString();
            
            if (accessToken) {
              // Obtener el email del usuario desde los atributos
              const userAttributes = currentUser.signInDetails?.loginId || '';
              
              // Sincronizar con DynamoDB usando el endpoint correcto
              const syncResponse = await ApiService.post('/users/sync-amplify', {
                username: storedUsername,
                email: userAttributes,
                sub: currentUser.userId
              });

              if (syncResponse.success && syncResponse.data) {
                // Usuario sincronizado exitosamente
                const userData: User = {
                  id: syncResponse.data.user.id,
                  username: syncResponse.data.user.username,
                  email: syncResponse.data.user.email,
                  profileCompleted: syncResponse.data.user.profileCompleted,
                  active: true,
                  lastLogin: new Date().toISOString()
                };
                
                setUser(userData);
                setToken(accessToken);
                ImageService.setAuthToken(accessToken);
                
                // Guardar en AsyncStorage
                await AsyncStorage.multiSet([
                  ['authToken', accessToken],
                  ['userData', JSON.stringify(userData)],
                  ['authType', 'amplify']
                ]);
                
                // Si el usuario ya tiene el perfil completado, redirigir a las tabs
                if (syncResponse.data.user.profileCompleted) {
                  console.log('✅ Usuario verificado con perfil completo');
                } else {
                  console.log('⚠️ Usuario verificado sin perfil completo, debe completar onboarding');
                }
                
                return {
                  success: true,
                  message: 'Verificación exitosa. Tu cuenta ha sido confirmada y sincronizada.'
                };
              }
            }
          }
        } catch (syncError) {
          smartLog.error('Error sincronizando con el backend:', syncError);
          // Continuar con el flujo normal incluso si hay error de sincronización
        }

        // Hacer login automático después de la verificación
        try {
          // Obtener la contraseña del usuario (necesitamos almacenarla temporalmente)
          const storedPassword = await AsyncStorage.getItem('pendingPassword');
          
          if (storedPassword) {
            const loginResult = await login(storedUsername, storedPassword);
            await AsyncStorage.removeItem('pendingPassword');
            
            if (loginResult.success) {
              return {
                success: true,
                message: 'Verificación exitosa. Tu cuenta ha sido confirmada y has iniciado sesión.'
              };
            }
          }
          
          // Si no se pudo hacer login automático, devolver éxito pero requerir login manual
          return {
            success: true,
            message: 'Verificación exitosa. Tu cuenta ha sido confirmada. Por favor, inicia sesión.'
          };
        } catch (loginError) {
          smartLog.error('Error en login automático después de verificación:', loginError);
          return {
            success: true,
            message: 'Verificación exitosa. Tu cuenta ha sido confirmada. Por favor, inicia sesión.'
          };
        }
      } else {
        return {
          success: false,
          message: 'La verificación no se completó correctamente',
          error: 'VERIFICATION_INCOMPLETE'
        };
      }
    } catch (error) {
      smartLog.error('Error en verificación:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('CodeMismatchException')) {
          return {
            success: false,
            message: 'El código de verificación es incorrecto',
            error: 'INVALID_CODE'
          };
        }
        
        if (error.message.includes('ExpiredCodeException')) {
          return {
            success: false,
            message: 'El código de verificación ha expirado. Solicita uno nuevo.',
            error: 'EXPIRED_CODE'
          };
        }
        
        if (error.message.includes('NotAuthorizedException')) {
          return {
            success: false,
            message: 'El usuario ya está verificado o no existe',
            error: 'USER_ALREADY_VERIFIED'
          };
        }
      }
      
      return {
        success: false,
        message: 'Error al verificar el código. Inténtalo nuevamente.',
        error: 'VERIFICATION_ERROR'
      };
    }
  };

  const resendConfirmationCode = async (username?: string): Promise<ResendCodeResponse> => {
    try {
      // Usar el username proporcionado o el almacenado
      const targetUsername = username || await AsyncStorage.getItem('pendingUsername');
      
      if (!targetUsername) {
        return {
          success: false,
          message: 'No se encontró información de usuario pendiente.',
          error: 'NO_PENDING_USER'
        };
      }

      await Auth.resendSignUpCode({
        username: targetUsername
      });

      // Guardar el username para futuras verificaciones
      await AsyncStorage.setItem('pendingUsername', targetUsername);

      return {
        success: true,
        message: 'Código de verificación reenviado exitosamente'
      };
    } catch (error) {
      smartLog.error('Error reenviando código:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('LimitExceededException')) {
          return {
            success: false,
            message: 'Has excedido el límite de intentos. Espera un momento antes de solicitar otro código.',
            error: 'LIMIT_EXCEEDED'
          };
        }
        
        if (error.message.includes('InvalidParameterException')) {
          return {
            success: false,
            message: 'El usuario ya está verificado',
            error: 'USER_ALREADY_VERIFIED'
          };
        }
      }
      
      return {
        success: false,
        message: 'Error al reenviar el código. Inténtalo nuevamente.',
        error: 'RESEND_ERROR'
      };
    }
  };

  const checkUserExists = async (username: string): Promise<boolean> => {
    try {
      await Auth.resendSignUpCode({
        username: username
      });
      return true; // Usuario existe
    } catch (error) {
      smartLog.info('User check error');
      return false; // Usuario no existe
    }
  };

  const syncUserProfileFromDatabase = async (currentUserData: User, token: string) => {
    try {
      console.log('🔄 AuthContext: Iniciando sincronización del perfil del usuario...');
      console.log('🔄 AuthContext: userId:', currentUserData.id);
      console.log('🔄 AuthContext: token presente:', !!token);
      console.log('🔄 AuthContext: profileCompleted actual:', currentUserData.profileCompleted);
      
      // Establecer el token temporalmente para la consulta
      const originalToken = ApiService.getAuthToken();
      ApiService.setAuthToken(token);
      
      try {
        // Obtener el perfil actualizado del usuario desde la base de datos
        console.log('🔄 AuthContext: Llamando a /profiles...');
        const response = await ApiService.get('/profiles');
        
        console.log('🔄 AuthContext: Respuesta del servidor:', {
          success: response.success,
          hasData: !!response.data,
          hasUser: !!response.user,
          dataKeys: response.data ? Object.keys(response.data) : 'no data',
          userKeys: response.user ? Object.keys(response.user) : 'no user',
          message: response.message
        });
        
        // El servidor puede devolver los datos en response.data o response.user
        const dbUser = response.data || response.user;
        if (response.success && dbUser) {
          console.log('🔄 AuthContext: Datos del usuario desde DB:', {
            id: dbUser.id,
            profileCompleted: dbUser.profileCompleted,
            displayName: dbUser.displayName,
            hasBirthDate: !!dbUser.birthDate,
            hasGender: !!dbUser.gender,
            hasLocation: !!dbUser.location,
            hasProfileImage: !!dbUser.profileImage
          });
          
          // Actualizar solo los campos que pueden haber cambiado en la base de datos
          const updatedUser = {
            ...currentUserData,
            profileCompleted: dbUser.profileCompleted,
            displayName: dbUser.displayName,
            birthDate: dbUser.birthDate,
            gender: dbUser.gender,
            profileImage: dbUser.profileImage,
            location: dbUser.location,
            active: dbUser.active
          };
          
          console.log('🔄 AuthContext: Usuario actualizado:', {
            id: updatedUser.id,
            profileCompleted: updatedUser.profileCompleted,
            displayName: updatedUser.displayName
          });
          
          setUser(updatedUser);
          
          // Actualizar AsyncStorage
          await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
          
          console.log('✅ AuthContext: Perfil sincronizado exitosamente desde la base de datos');
          console.log(`✅ AuthContext: profileCompleted actualizado a: ${dbUser.profileCompleted}`);
        } else {
          console.log('⚠️ AuthContext: No se pudo obtener el perfil actualizado de la base de datos');
          console.log('⚠️ AuthContext: Respuesta:', response);
          console.log('ℹ️ AuthContext: Manteniendo profileCompleted actual sin cambios');
        }
      } finally {
        // Restaurar el token original
        ApiService.setAuthToken(originalToken || '');
      }
    } catch (error) {
      console.error('❌ AuthContext: Error sincronizando perfil desde la base de datos:', error);
      throw error;
    }
  };

  const updateUserProfile = async (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      
      // Log de depuración para ver qué se está actualizando
      console.log('🔄 AuthContext: Actualizando perfil del usuario:', {
        userId: updatedUser.id,
        profileCompleted: updatedUser.profileCompleted,
        displayName: updatedUser.displayName,
        hasLocation: !!updatedUser.location,
        hasProfileImage: !!updatedUser.profileImage
      });
      
      setUser(updatedUser);
      
      // Actualizar AsyncStorage de forma asíncrona
      try {
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
        console.log('✅ AuthContext: Perfil actualizado en AsyncStorage');
        smartLog.info('AuthContext: Perfil actualizado en AsyncStorage');
      } catch (error) {
        console.error('❌ AuthContext: Error actualizando AsyncStorage:', error);
        smartLog.error('AuthContext: Error actualizando AsyncStorage:', error);
      }
    } else {
      console.warn('⚠️ AuthContext: No hay usuario para actualizar');
      smartLog.warn('AuthContext: No hay usuario para actualizar');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, confirmSignUp, resendConfirmationCode, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
