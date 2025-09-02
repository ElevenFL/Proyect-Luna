import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from '../config/amplify';
import { ImageService } from '../services/imageService';

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
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  updateUserProfile: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Efecto para sincronizar el token con ImageService
  useEffect(() => {
    if (token) {
      ImageService.setAuthToken(token);
    }
  }, [token]);

  const loadStoredAuth = async () => {
    try {
      // Primero intentar cargar datos guardados localmente
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('userData');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Sincronizar token con ImageService
        ImageService.setAuthToken(storedToken);
        setIsLoading(false);
        return;
      }
      
      // Solo verificar Amplify si no hay datos locales
      try {
        const session = await Auth.fetchAuthSession();
        const currentUser = await Auth.getCurrentUser();
        
        if (session.tokens && currentUser) {
          const userData: User = {
            id: currentUser.userId,
            username: currentUser.username,
            email: currentUser.signInDetails?.loginId || '',
            profileCompleted: false,
          };
          
          const accessToken = session.tokens.accessToken?.toString();
          
          setUser(userData);
          setToken(accessToken);
          
          // Sincronizar token con ImageService
          if (accessToken) {
            ImageService.setAuthToken(accessToken);
          }
          
          // Guardar en AsyncStorage para persistencia
          await AsyncStorage.setItem('userData', JSON.stringify(userData));
          if (accessToken) {
            await AsyncStorage.setItem('authToken', accessToken);
          }
        }
             } catch (amplifyError) {
         // Error de Amplify es esperado cuando no hay sesión activa
         console.log('No hay sesión activa en Amplify:', amplifyError instanceof Error ? amplifyError.message : 'Error desconocido');
         // No hacer nada, el usuario simplemente no está autenticado
       }
    } catch (error) {
      console.error('Error cargando datos de autenticación:', error);
      // En caso de error, simplemente continuar sin autenticación
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; message: string }> => {
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
          profileCompleted: false,
        };
        
        setUser(userData);
        setToken(session.tokens?.accessToken?.toString() || null);
        
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        if (session.tokens?.accessToken) {
          await AsyncStorage.setItem('authToken', session.tokens.accessToken.toString());
        }
        
        return { success: true, message: 'Inicio de sesión exitoso' };
      } else {
        return { success: false, message: 'Error en el inicio de sesión' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      let errorMessage = 'Error de conexión';
      
      if (error instanceof Error) {
        if (error.message.includes('Incorrect username or password')) {
          errorMessage = 'Usuario o contraseña incorrectos';
        } else if (error.message.includes('User is not confirmed')) {
          errorMessage = 'Usuario no confirmado. Por favor, verifica tu email.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return { success: false, message: errorMessage };
    }
  };

  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const signUpResult = await Auth.signUp({
        username: username,
        password: password,
        options: {
          userAttributes: {
            email: email,
          },
        },
      });

      if (signUpResult.isSignUpComplete) {
        // Si el registro no requiere confirmación, hacer login automático
        if (!signUpResult.nextStep.signUpStep) {
          return await login(username, password);
        } else {
          return { success: true, message: 'Registro exitoso. Por favor, verifica tu email para confirmar tu cuenta.' };
        }
      } else {
        return { success: false, message: 'Error en el registro' };
      }
    } catch (error) {
      console.error('Error en registro:', error);
      let errorMessage = 'Error de conexión';
      
      if (error instanceof Error) {
        if (error.message.includes('UsernameExistsException')) {
          errorMessage = 'El nombre de usuario ya existe';
        } else if (error.message.includes('InvalidPasswordException')) {
          errorMessage = 'La contraseña no cumple con los requisitos mínimos';
        } else if (error.message.includes('InvalidParameterException')) {
          errorMessage = 'Datos de entrada inválidos';
        } else {
          errorMessage = error.message;
        }
      }
      
      return { success: false, message: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await Auth.signOut();
      setUser(null);
      setToken(null);
      // Limpiar token de ImageService
      ImageService.setAuthToken('');
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.error('Error en logout:', error);
      // Limpiar estado local incluso si hay error
      setUser(null);
      setToken(null);
      // Limpiar token de ImageService
      ImageService.setAuthToken('');
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
  };

  const updateUserProfile = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUserProfile }}>
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
