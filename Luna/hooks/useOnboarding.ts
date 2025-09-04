import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ApiService from '@/services/apiService';
import { smartLog } from '@/config/logging';

interface OnboardingData {
  displayName?: string;
  birthDate?: string;
  gender?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  profileImage?: string;
}

interface OnboardingStep {
  name: string;
  completed: boolean;
  data?: any;
}

export const useOnboarding = () => {
  const { user, updateUserProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('welcome');

  // Pasos del onboarding
  const onboardingSteps: OnboardingStep[] = [
    { name: 'welcome', completed: false },
    { name: 'name', completed: false },
    { name: 'birthdate', completed: false },
    { name: 'gender', completed: false },
    { name: 'location', completed: false },
    { name: 'photo', completed: false },
    { name: 'complete', completed: false }
  ];

  /**
   * Actualiza un campo específico del perfil
   */
  const updateProfileField = async (field: keyof OnboardingData, value: any): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const updateData = { [field]: value };
      
      smartLog.info(`Actualizando campo ${field} en DynamoDB...`);
      smartLog.info(`Datos a enviar:`, updateData);
      
      const response = await ApiService.updateProfile(updateData);

      if (response.success) {
        smartLog.info(`✅ Campo ${field} actualizado exitosamente`);
        
        // Actualizar estado local del usuario
        updateUserProfile(updateData);
        
        // Marcar el paso como completado
        markStepCompleted(field);
        
        return true;
      } else {
        const errorMsg = response.message || `Error actualizando ${field}`;
        setError(errorMsg);
        smartLog.error(`❌ Error actualizando ${field}:`, errorMsg);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      
      // Manejar errores específicos de autenticación
      if (errorMessage.includes('Sesión expirada') || errorMessage.includes('Token expirado')) {
        setError('Sesión expirada. Por favor, inicie sesión nuevamente.');
        smartLog.error(`❌ Error de autenticación en updateProfileField para ${field}:`, err);
        
        // Aquí podrías redirigir al login o refrescar el token
        // Por ahora, solo mostramos el error
      } else {
        setError(`Error actualizando ${field}: ${errorMessage}`);
        smartLog.error(`❌ Error en updateProfileField para ${field}:`, err);
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Actualiza el nombre del usuario
   */
  const updateName = async (displayName: string): Promise<boolean> => {
    return updateProfileField('displayName', displayName);
  };

  /**
   * Actualiza la fecha de nacimiento del usuario
   */
  const updateBirthDate = async (birthDate: string): Promise<boolean> => {
    return updateProfileField('birthDate', birthDate);
  };

  /**
   * Actualiza el género del usuario
   */
  const updateGender = async (gender: string): Promise<boolean> => {
    return updateProfileField('gender', gender);
  };

  /**
   * Actualiza la ubicación del usuario
   */
  const updateLocation = async (location: {
    latitude?: number;
    longitude?: number;
    address?: string;
  }): Promise<boolean> => {
    return updateProfileField('location', location);
  };

  /**
   * Actualiza la foto de perfil del usuario
   */
  const updateProfileImage = async (profileImage: string): Promise<boolean> => {
    return updateProfileField('profileImage', profileImage);
  };

  /**
   * Marca un paso como completado
   */
  const markStepCompleted = (stepName: string) => {
    const step = onboardingSteps.find(s => s.name === stepName);
    if (step) {
      step.completed = true;
    }
  };

  /**
   * Verifica si el perfil está completo
   */
  const isProfileComplete = (): boolean => {
    if (!user) return false;
    
    return !!(
      user.displayName &&
      user.birthDate &&
      user.gender &&
      user.location &&
      user.profileImage
    );
  };

  /**
   * Marca el perfil como completado en DynamoDB
   */
  const markProfileCompleted = async (): Promise<boolean> => {
    if (!isProfileComplete()) {
      setError('No se puede marcar el perfil como completo. Faltan campos requeridos.');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      smartLog.info('Marcando perfil como completado en DynamoDB...');
      const response = await ApiService.markProfileCompleted();

      if (response.success) {
        smartLog.info('✅ Perfil marcado como completado exitosamente');
        
        // Actualizar estado local del usuario
        updateUserProfile({ profileCompleted: true });
        
        // Marcar el paso final como completado
        markStepCompleted('complete');
        
        return true;
      } else {
        setError(response.message || 'Error marcando perfil como completo');
        smartLog.error('❌ Error marcando perfil como completo:', response.message);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error marcando perfil como completo: ${errorMessage}`);
      smartLog.error('❌ Error en markProfileCompleted:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Obtiene el progreso del onboarding
   */
  const getOnboardingProgress = (): number => {
    const completedSteps = onboardingSteps.filter(step => step.completed).length;
    return Math.round((completedSteps / onboardingSteps.length) * 100);
  };

  /**
   * Obtiene el siguiente paso del onboarding
   */
  const getNextStep = (): string | null => {
    const currentStepIndex = onboardingSteps.findIndex(step => step.name === currentStep);
    if (currentStepIndex < onboardingSteps.length - 1) {
      return onboardingSteps[currentStepIndex + 1].name;
    }
    return null;
  };

  /**
   * Avanza al siguiente paso del onboarding
   */
  const goToNextStep = (): void => {
    const nextStep = getNextStep();
    if (nextStep) {
      setCurrentStep(nextStep);
    }
  };

  /**
   * Va a un paso específico del onboarding
   */
  const goToStep = (stepName: string): void => {
    setCurrentStep(stepName);
  };

  /**
   * Reinicia el onboarding
   */
  const resetOnboarding = (): void => {
    setCurrentStep('welcome');
    setError(null);
    onboardingSteps.forEach(step => {
      step.completed = false;
    });
  };

  return {
    // Estado
    isLoading,
    error,
    currentStep,
    onboardingSteps,
    
    // Métodos de actualización
    updateName,
    updateBirthDate,
    updateGender,
    updateLocation,
    updateProfileImage,
    updateProfileField,
    
    // Métodos de control
    markProfileCompleted,
    isProfileComplete,
    getOnboardingProgress,
    getNextStep,
    goToNextStep,
    goToStep,
    resetOnboarding,
    
    // Utilidades
    markStepCompleted
  };
};
