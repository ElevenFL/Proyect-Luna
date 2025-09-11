import { useRef, useCallback, useEffect } from 'react';
import { FlatList } from 'react-native';

/**
 * Hook personalizado para optimizaciones específicas del chat
 */
export const useChatOptimizations = () => {
  // Referencias para scroll inteligente
  const isNearBottom = useRef(true);
  const lastScrollOffset = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<FlatList>(null);

  // Función para scroll inteligente
  const scrollToEnd = useCallback((force = false) => {
    if (listRef.current) {
      if (force || isNearBottom.current) {
        listRef.current.scrollToOffset({ offset: 0, animated: true });
      } else {
        console.log('📜 Chat: Scroll automático cancelado - usuario no está al final');
      }
    }
  }, []);

  // Maneja el scroll de la lista
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    
    const wasNearBottom = isNearBottom.current;
    isNearBottom.current = distanceFromBottom < 150;
    
    if (wasNearBottom !== isNearBottom.current) {
      console.log('📜 Chat: Estado de scroll cambiado', { 
        isNearBottom: isNearBottom.current, 
        distanceFromBottom: Math.round(distanceFromBottom) 
      });
    }
    
    lastScrollOffset.current = contentOffset.y;
  }, []);

  // Optimización de getItemLayout para mejor scroll performance
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 80,
    offset: 80 * index,
    index,
  }), []);

  // Función para determinar si hacer scroll automático
  const shouldAutoScroll = useCallback((isMyMessage: boolean) => {
    return isMyMessage || isNearBottom.current;
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    listRef,
    isNearBottom,
    scrollToEnd,
    handleScroll,
    getItemLayout,
    shouldAutoScroll,
  };
};

/**
 * Hook para estadísticas de performance del chat
 */
export const useChatPerformance = () => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const averageRenderTime = useRef(0);
  const renderTimes = useRef<number[]>([]);

  const trackRender = useCallback(() => {
    const now = Date.now();
    const renderTime = now - lastRenderTime.current;
    
    renderCount.current++;
    renderTimes.current.push(renderTime);
    
    // Mantener solo las últimas 10 mediciones
    if (renderTimes.current.length > 10) {
      renderTimes.current = renderTimes.current.slice(-10);
    }
    
    // Calcular promedio
    averageRenderTime.current = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
    
    lastRenderTime.current = now;
  }, []);

  const getPerformanceStats = useCallback(() => ({
    renderCount: renderCount.current,
    averageRenderTime: Math.round(averageRenderTime.current),
    lastRenderTime: renderTimes.current[renderTimes.current.length - 1] || 0,
    recentRenderTimes: [...renderTimes.current],
  }), []);

  return {
    trackRender,
    getPerformanceStats,
  };
};

/**
 * Hook para gestión de estado de typing indicators
 */
export const useTypingIndicator = (
  conversationId: string,
  currentUserId: string,
  socketService: any
) => {
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const isTyping = useRef(false);

  const startTyping = useCallback(() => {
    if (!isTyping.current) {
      isTyping.current = true;
      socketService.sendTypingIndicator(conversationId, true);
      
      console.log('⌨️ Chat: Usuario comenzó a escribir');
    }

    // Resetear timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    // Detener typing después de 3 segundos de inactividad
    typingTimeout.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [conversationId, socketService]);

  const stopTyping = useCallback(() => {
    if (isTyping.current) {
      isTyping.current = false;
      socketService.sendTypingIndicator(conversationId, false);
      
      console.log('⌨️ Chat: Usuario dejó de escribir');
    }

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
  }, [conversationId, socketService]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  return {
    startTyping,
    stopTyping,
    isTyping: isTyping.current,
  };
};
