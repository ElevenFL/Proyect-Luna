import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, withTiming, withDelay, interpolate } from 'react-native-reanimated';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatProvider';
import { ChatMessage } from '@/services/optimizedChatService';
import { ImageService } from '@/services/imageService';

/**
 * Componente de chat que usa el ChatProvider global para gestión de estado
 */
const GlobalChatScreen = React.memo(() => {
  const { 
    userId: otherUserId,
    userName,
    userImage,
    userAge,
    userGender,
    userCountry,
    userCountryFlag,
    isOnline
  } = useLocalSearchParams();
  
  const { user } = useAuth();
  const { 
    openChat, 
    getMessages, 
    sendMessage, 
    setCurrentChat, 
    closeChat, 
    markAsRead,
    getChatByUserId,
    getOtherUserInfo: getOtherUserInfoFromProvider,
    currentChatId,
    activeChats
  } = useChat();
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Iniciar como false para evitar flash innecesario
  const [messagesLoaded, setMessagesLoaded] = useState(false); // Nuevo estado para rastrear si los mensajes se cargaron
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [shouldAnimateMessages, setShouldAnimateMessages] = useState(false); // Estado para controlar animación de entrada
  const [keyboardHeight, setKeyboardHeight] = useState(0); // Estado para la altura del teclado
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false); // Estado para saber si el teclado está visible
  const [otherUserInfo, setOtherUserInfo] = useState<{
    name: string;
    profileImage?: string;
    age?: number;
    gender?: string;
    country?: string;
    countryFlag?: string;
    description?: string;
    isOnline?: boolean;
    lastSeen?: string;
    profileCompleted?: boolean;
  } | null>(null);
  
  // Estados para paginación
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  
  const listRef = useRef<FlatList>(null);
  const currentUserId = useMemo(() => user?.id || user?.amplifySub || '', [user]);
  
  // Ref para mantener la referencia actual del conversationId para cleanup
  const conversationIdRef = useRef<string | null>(null);
  
  // Refs para las funciones del ChatProvider para evitar dependencias problemáticas
  const openChatRef = useRef(openChat);
  const setCurrentChatRef = useRef(setCurrentChat);
  
  // Actualizar refs cuando las funciones cambien
  useEffect(() => {
    openChatRef.current = openChat;
    setCurrentChatRef.current = setCurrentChat;
  }, [openChat, setCurrentChat]);
  
  // Estado para scroll inteligente
  const isNearBottom = useRef(true);
  const lastScrollOffset = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markAsReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Función para hacer scroll al final con lógica inteligente
  const scrollToEnd = useCallback((force = false) => {
    if (listRef.current) {
      // Solo hacer scroll si el usuario está cerca del final o se fuerza
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
    
    // Considerar que está cerca del final si está a menos de 150px
    const wasNearBottom = isNearBottom.current;
    isNearBottom.current = distanceFromBottom < 150;
    
    // Log solo cuando cambia el estado
    if (wasNearBottom !== isNearBottom.current) {
      console.log('📜 Chat: Estado de scroll cambiado', { 
        isNearBottom: isNearBottom.current, 
        distanceFromBottom: Math.round(distanceFromBottom) 
      });
    }
    
    lastScrollOffset.current = contentOffset.y;
    
    // Marcar mensajes como leídos cuando el usuario está viendo el chat
    // Solo si está cerca del final (viendo los mensajes más recientes)
    // Usar debounce más agresivo para evitar llamadas excesivas
    if (isNearBottom.current && conversationId) {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
      
      markAsReadTimeoutRef.current = setTimeout(() => {
        // Solo marcar si realmente hay mensajes no leídos
        const hasUnreadMessages = messages.some(m => 
          m.senderId !== currentUserId && !m.read
        );
        
        if (hasUnreadMessages) {
          console.log('👁️ GlobalChat: Marcando mensajes como leídos durante scroll');
          markAsRead(conversationId).catch(error => {
            console.error('❌ GlobalChat: Error marcando como leído durante scroll:', error);
          });
        } else {
          console.log('ℹ️ GlobalChat: No hay mensajes no leídos, omitiendo marcado durante scroll');
        }
      }, 3000); // Aumentar a 3 segundos para reducir llamadas
    }
  }, [conversationId, markAsRead, messages, currentUserId]);

  // Función para cargar mensajes anteriores (paginación)
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || isLoadingOlder || !hasMoreMessages || !oldestMessageId) {
      return;
    }

    try {
      setIsLoadingOlder(true);
      console.log('📜 Chat: Cargando mensajes anteriores...', { oldestMessageId });

      // Usar optimizedChatService para cargar mensajes anteriores
      const response = await import('@/services/optimizedChatService').then(module => 
        module.default.getMessages(conversationId, { 
          limit: 50, 
          before: oldestMessageId 
        })
      );

      if (response.items && response.items.length > 0) {
        // Los mensajes vienen del backend en orden descendente (más recientes primero)
        const olderMessages = response.items;
        console.log(`📜 Chat: ${olderMessages.length} mensajes anteriores cargados`);
        
        setMessages(prevMessages => {
          const combinedMessages = [...prevMessages, ...olderMessages];
          // Eliminar duplicados basándose en messageId
          const uniqueMessages = combinedMessages.filter((message, index, self) => 
            index === self.findIndex(m => m.messageId === message.messageId)
          );
          
          // Los mensajes ya están en orden descendente, mantener ese orden
          return uniqueMessages;
        });

        // Actualizar el ID del mensaje más antiguo (está al final del array ya ordenado)
        const newOldestMessage = olderMessages[olderMessages.length - 1];
        setOldestMessageId(newOldestMessage.messageId);

        // Si se cargaron menos mensajes del límite, no hay más
        if (olderMessages.length < 20) {
          setHasMoreMessages(false);
          console.log('📜 Chat: No hay más mensajes anteriores');
        }
      } else {
        setHasMoreMessages(false);
        console.log('📜 Chat: No se encontraron mensajes anteriores');
      }
    } catch (error) {
      console.error('❌ Chat: Error cargando mensajes anteriores:', error);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [conversationId, isLoadingOlder, hasMoreMessages, oldestMessageId]);

  // Configurar información del otro usuario inmediatamente
  useEffect(() => {
    // Solo configurar si tenemos información válida del usuario
    const userNameStr = Array.isArray(userName) ? userName[0] : userName;
    if (userNameStr && userNameStr !== 'undefined' && userNameStr.trim() !== '') {
      setOtherUserInfo({
        name: String(userNameStr),
        profileImage: userImage ? String(userImage) : undefined,
        age: userAge ? parseInt(String(userAge)) : undefined,
        gender: String(userGender || 'other') as 'male' | 'female' | 'other',
        country: String(userCountry || 'Unknown'),
        countryFlag: String(userCountryFlag || '🌍'),
        isOnline: isOnline === 'true'
      });
    }
  }, [userName, userImage, otherUserId, userAge, userGender, userCountry, userCountryFlag, isOnline]);

  // Inicialización y gestión del chat usando ChatProvider
  useEffect(() => {
    const initializeChat = async () => {
      if (!otherUserId || !currentUserId) return;
      
      try {
        // Resetear estados de animación al cambiar de chat
        setShouldAnimateMessages(false);
        setMessagesLoaded(false);
        
        // Verificar si ya existe un chat con este usuario y tiene mensajes
        const existingChat = getChatByUserId(String(otherUserId));
        const hasCachedMessages = existingChat && existingChat.messages.length > 0;
        
        // Solo mostrar loading si no hay mensajes en cache
        if (!hasCachedMessages) {
          setIsLoading(true);
        }
        
        console.log('🔍 GlobalChat: Inicializando chat con usuario:', otherUserId, 'currentConversationId:', conversationIdRef.current, 'hasCachedMessages:', hasCachedMessages);
        
        // Preparar información del usuario - usar información del ChatProvider si está disponible
        const userNameStr = Array.isArray(userName) ? userName[0] : userName;
        let userInfo = {
          name: String(userNameStr || `Usuario ${String(otherUserId).slice(-4)}`),
          profileImage: userImage ? String(userImage) : undefined,
          isOnline: isOnline === 'true',
          age: userAge ? parseInt(String(userAge)) : undefined,
          gender: String(userGender || 'other') as 'male' | 'female' | 'other',
          country: String(userCountry || 'Unknown'),
          countryFlag: String(userCountryFlag || '🌍')
        };

        // Si no tenemos información válida del usuario, intentar obtenerla del ChatProvider
        if ((!userNameStr || userNameStr === 'undefined' || userNameStr.trim() === '') && otherUserId) {
          const existingChat = getChatByUserId(String(otherUserId));
          if (existingChat?.otherUser) {
            userInfo = {
              name: existingChat.otherUser.name,
              profileImage: existingChat.otherUser.profileImage,
              isOnline: existingChat.otherUser.isOnline || false,
              age: existingChat.otherUser.age,
              gender: existingChat.otherUser.gender || 'other',
              country: existingChat.otherUser.country || 'Unknown',
              countryFlag: existingChat.otherUser.countryFlag || '🌍'
            };
            
            // Actualizar el estado local con la información del ChatProvider
            setOtherUserInfo({
              name: existingChat.otherUser.name,
              profileImage: existingChat.otherUser.profileImage,
              age: existingChat.otherUser.age,
              gender: existingChat.otherUser.gender,
              country: existingChat.otherUser.country,
              countryFlag: existingChat.otherUser.countryFlag,
              isOnline: existingChat.otherUser.isOnline,
              lastSeen: existingChat.otherUser.lastSeen
            });
          }
        }

        // Abrir o recuperar chat usando ChatProvider
        const chatConversationId = await openChatRef.current(String(otherUserId), userInfo);
        setConversationId(chatConversationId);
        conversationIdRef.current = chatConversationId; // Actualizar ref para cleanup
        
        // Establecer como chat actual
        setCurrentChatRef.current(chatConversationId);
        
        // Si ya teníamos mensajes en cache, quitar el loading inmediatamente
        if (hasCachedMessages) {
          setIsLoading(false);
        }
        
        // Obtener información completa del otro usuario
        try {
          const fullUserInfo = await getOtherUserInfoFromProvider(chatConversationId);
          
          if (fullUserInfo) {
            setOtherUserInfo({
              name: fullUserInfo.name,
              profileImage: fullUserInfo.profileImage,
              age: fullUserInfo.age,
              gender: fullUserInfo.gender,
              country: fullUserInfo.country,
              countryFlag: fullUserInfo.countryFlag,
              isOnline: fullUserInfo.isOnline,
              lastSeen: fullUserInfo.lastSeen
            });
            console.log('✅ GlobalChat: Información del usuario actualizada:', fullUserInfo.name);
          }
        } catch (error) {
          console.warn('⚠️ GlobalChat: No se pudo obtener información completa del usuario:', error);
          // Mantener la información básica que ya tenemos
        }
        
        console.log('✅ GlobalChat: Chat inicializado:', chatConversationId);
        
      } catch (error) {
        console.error('❌ GlobalChat: Error inicializando chat:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, [otherUserId, currentUserId, userName, userImage, isOnline, userAge, userGender, userCountry, userCountryFlag]); // Removidas openChat y setCurrentChat

  // Sincronizar mensajes del ChatProvider
  useEffect(() => {
    if (conversationId) {
      const chatMessages = getMessages(conversationId);
      
      // Los mensajes del ChatProvider ya vienen en orden descendente (más recientes primero)
      // No necesitamos reordenarlos
      setMessages(chatMessages);
      setMessagesLoaded(true); // Marcar que los mensajes se han cargado
      
      // Si hay mensajes, quitar el estado de loading
      if (chatMessages.length > 0) {
        setIsLoading(false);
        
        // Activar animación de entrada solo si es la primera carga de mensajes
        if (!messagesLoaded && chatMessages.length > 0) {
          setShouldAnimateMessages(true);
          // Desactivar la animación después de que termine
          setTimeout(() => setShouldAnimateMessages(false), 1000);
        }
      }
      
      console.log(`📨 GlobalChat: Sincronizados ${chatMessages.length} mensajes del ChatProvider`);
      
      // Verificar si hay mensajes no leídos y marcarlos como leídos automáticamente
      // SOLO si es la primera carga de mensajes (no en actualizaciones)
      if (chatMessages.length > 0 && !messagesLoaded) {
        const unreadMessages = chatMessages.filter(message => 
          message.senderId !== currentUserId && message.read === false
        );
        
        if (unreadMessages.length > 0) {
          console.log(`👁️ GlobalChat: Primera carga - ${unreadMessages.length} mensajes no leídos encontrados, marcando como leídos...`);
          markAsRead(conversationId).catch(error => {
            console.error('❌ GlobalChat: Error marcando mensajes como leídos en primera carga:', error);
          });
        }
      }
      
      // Inicializar estados de paginación solo una vez
      if (chatMessages.length > 0) {
        // El mensaje más antiguo está al final del array (ya ordenado)
        const oldestMessage = chatMessages[chatMessages.length - 1];
        setOldestMessageId(oldestMessage.messageId);
        setHasMoreMessages(chatMessages.length >= 50); // Si hay 50 o más, probablemente hay más
        
        // Scroll al final cuando se cargan nuevos mensajes
        setTimeout(() => scrollToEnd(false), 100);
      }
    }
  }, [conversationId]); // Removidas las dependencias problemáticas

  // Listener para cambios en el chat actual (cuando recibimos mensajes nuevos)
  useEffect(() => {
    if (conversationId && messagesLoaded) {
      const chatMessages = getMessages(conversationId);
      
      // Comparar mensajes por IDs para detectar cambios reales
      const currentMessageIds = messages.map(m => m.messageId).sort().join(',');
      const newMessageIds = chatMessages.map(m => m.messageId).sort().join(',');
      
      if (currentMessageIds !== newMessageIds) {
        // Los mensajes del ChatProvider ya vienen en orden descendente
        setMessages(chatMessages);
        console.log(`📨 GlobalChat: Mensajes actualizados: ${chatMessages.length}`);
        
        // Verificar si hay mensajes no leídos en los nuevos mensajes
        // SOLO marcar si el usuario está viendo el chat activamente (cerca del final)
        const unreadMessages = chatMessages.filter(message => 
          message.senderId !== currentUserId && message.read === false
        );
        
        if (unreadMessages.length > 0 && isNearBottom.current) {
          console.log(`👁️ GlobalChat: Actualización - ${unreadMessages.length} mensajes no leídos encontrados, usuario viendo chat, marcando como leídos...`);
          markAsRead(conversationId).catch(error => {
            console.error('❌ GlobalChat: Error marcando mensajes como leídos en actualización:', error);
          });
        } else if (unreadMessages.length > 0) {
          console.log(`ℹ️ GlobalChat: ${unreadMessages.length} mensajes no leídos en actualización, pero usuario no está viendo el chat, omitiendo marcado`);
        }
        
        // Scroll automático para mensajes nuevos (sin animación)
        setTimeout(() => scrollToEnd(false), 100);
      }
    }
  }, [conversationId, getMessages, messagesLoaded]); // Usar getMessages como dependencia para detectar cambios

  // Listener adicional para cambios en el estado del ChatProvider
  useEffect(() => {
    if (conversationId) {
      const chatMessages = getMessages(conversationId);
      // Los mensajes del ChatProvider ya vienen en orden descendente
      setMessages(chatMessages);
    }
  }, [activeChats, conversationId, getMessages]); // Escuchar cambios en activeChats

  // Marcar como leído cuando el chat recibe foco
  useFocusEffect(
    useCallback(() => {
      if (conversationId) {
        // Marcar mensajes como leídos cuando el usuario entra en la conversación
        // Solo si hay mensajes no leídos para evitar llamadas innecesarias
        const hasUnreadMessages = messages.some(m => 
          m.senderId !== currentUserId && !m.read
        );
        
        if (hasUnreadMessages) {
          console.log(`👁️ GlobalChat: Chat recibió foco con mensajes no leídos, marcando como leído: ${conversationId}`);
          markAsRead(conversationId).then(() => {
            console.log(`✅ GlobalChat: Chat marcado como leído exitosamente: ${conversationId}`);
          }).catch(error => {
            console.error('❌ GlobalChat: Error marcando chat como leído:', error);
          });
        } else {
          console.log(`ℹ️ GlobalChat: Chat recibió foco pero no hay mensajes no leídos, omitiendo marcado: ${conversationId}`);
        }
      }
    }, [conversationId, messages, currentUserId, markAsRead])
  );

  // Listeners del teclado para ajustar la pantalla
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
      console.log('⌨️ Teclado mostrado, altura:', e.endCoordinates.height);
      
      // Hacer scroll al final cuando aparece el teclado
      setTimeout(() => scrollToEnd(true), 200);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
      console.log('⌨️ Teclado ocultado');
      
      // Ajustar scroll cuando se oculta el teclado
      setTimeout(() => scrollToEnd(false), 100);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [scrollToEnd]);

  // Limpiar al salir del chat (solo al desmontar el componente)
  useEffect(() => {
    return () => {
      const currentConversationId = conversationIdRef.current;
      if (currentConversationId) {
        console.log(`🔒 GlobalChat: Cerrando chat: ${currentConversationId}`);
        closeChat(currentConversationId);
        setCurrentChatRef.current(null);
      }
      
      // Limpiar timeouts
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, []); // Sin dependencias - solo ejecutar al desmontar

  // Función para manejar la subida de imagen
  const handleImageUpload = useCallback(async (imageUri: string) => {
    console.log('📸 GlobalChat: handleImageUpload called', {
      conversationId: !!conversationId,
      isUploadingImage,
      imageUri: imageUri.substring(0, 50) + '...'
    });

    if (!conversationId) {
      console.warn('❌ GlobalChat: No conversationId available');
      Alert.alert('Error', 'No hay conversación activa.');
      return;
    }

    if (isUploadingImage) {
      console.warn('❌ GlobalChat: Upload already in progress');
      Alert.alert('Subida en progreso', 'Ya hay una imagen subiéndose.');
      return;
    }

    setIsUploadingImage(true);
    console.log('📸 GlobalChat: Upload state set to true');

    try {
      console.log('📸 GlobalChat: Iniciando subida de imagen:', imageUri);

      // Subir imagen al servidor primero
      const uploadedImageUrl = await ImageService.uploadOptimizedImage(
        imageUri,
        'chat-images', // carpeta específica para imágenes del chat
        {
          maxWidth: 800,
          maxHeight: 600,
          quality: 0.8,
          format: 'jpeg'
        }
      );

      console.log('✅ GlobalChat: Imagen subida exitosamente:', uploadedImageUrl);

      // Enviar mensaje con la URL de la imagen subida
      await sendMessage(conversationId, uploadedImageUrl, undefined, 'image');
      console.log('✅ GlobalChat: Mensaje enviado exitosamente');

      // Forzar scroll para ver la imagen
      setTimeout(() => scrollToEnd(true), 200);

    } catch (error) {
      console.error('❌ GlobalChat: Error subiendo imagen:', error);
      Alert.alert('Error', 'No se pudo enviar la imagen. Inténtalo de nuevo.');
    } finally {
      console.log('🔄 GlobalChat: Resetting upload state');
      // Usar setTimeout para asegurar que el estado se resetee después de que termine el render
      setTimeout(() => {
        setIsUploadingImage(false);
        console.log('🔄 GlobalChat: Upload state reset to false');
      }, 100);
    }
  }, [conversationId, sendMessage, scrollToEnd]);

  // Función para seleccionar imagen de la galería
  const selectFromGallery = useCallback(async () => {
    console.log('📱 GlobalChat: selectFromGallery called');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('📱 GlobalChat: Gallery result:', { 
        canceled: result.canceled, 
        hasAssets: result.assets && result.assets.length > 0 
      });

      if (!result.canceled && result.assets[0]) {
        console.log('📱 GlobalChat: Calling handleImageUpload');
        await handleImageUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error seleccionando imagen de galería:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  }, [handleImageUpload]);

  // Función para tomar foto con la cámara
  const selectFromCamera = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Necesitas dar permisos para usar la cámara.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleImageUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error tomando foto:', error);
      Alert.alert('Error', 'No se pudo tomar la foto.');
    }
  }, [handleImageUpload]);

  // Función para seleccionar imagen
  const pickImage = useCallback(async () => {
    console.log('📷 GlobalChat: pickImage called', { isUploadingImage });
    
    if (isUploadingImage) {
      console.warn('📷 GlobalChat: Upload in progress, ignoring request');
      Alert.alert('Subida en progreso', 'Espera a que termine la subida actual.');
      return;
    }

    try {
      // Pedir permisos para acceder a la galería
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('📷 GlobalChat: Permission result:', permissionResult.granted);
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Necesitas dar permisos para acceder a la galería de fotos.');
        return;
      }

      // Mostrar opciones para seleccionar imagen
      Alert.alert(
        'Seleccionar imagen',
        'Elige una opción',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Galería', onPress: () => {
            console.log('📷 Gallery option selected');
            selectFromGallery();
          }},
          { text: 'Cámara', onPress: () => {
            console.log('📷 Camera option selected');
            selectFromCamera();
          }}
        ]
      );
    } catch (error) {
      console.error('Error al solicitar permisos:', error);
      Alert.alert('Error', 'Ocurrió un error al acceder a la galería.');
    }
  }, [selectFromGallery, selectFromCamera, isUploadingImage]);

  // Función para enviar mensaje usando ChatProvider
  const handleSend = useCallback(async () => {
    if (!conversationId || !input.trim() || isSending) return;
    
    const text = input.trim();
    setInput('');
    setIsSending(true);
    
    try {
      console.log('📤 GlobalChat: Enviando mensaje:', {
        conversationId,
        content: text.substring(0, 50) + '...',
        hasReply: !!replyingTo
      });
      
      // Enviar usando ChatProvider
      await sendMessage(conversationId, text, replyingTo || undefined);
      
      console.log('✅ GlobalChat: Mensaje enviado exitosamente');
      setReplyingTo(null);
      
      // Forzar scroll para mensajes propios
      setTimeout(() => scrollToEnd(true), 200);
      
    } catch (error) {
      console.error('❌ GlobalChat: Error enviando mensaje:', error);
      setInput(text); // Restaurar input en caso de error
    } finally {
      setIsSending(false);
    }
  }, [conversationId, input, isSending, replyingTo, sendMessage, scrollToEnd]);

  // Componente de mensaje optimizado
  const MessageItem = React.memo(({ item, index }: { item: ChatMessage, index: number }) => {
    const translateX = useSharedValue(0);
    const isMine = String(item.senderId) === String(currentUserId);
    const isTemporary = item.isOptimistic;
    
    // Optimización: solo aplicar animaciones a mensajes recientes
    const isRecentMessage = index < 20;
    
    // Animación de entrada para mensajes
    const entranceOpacity = useSharedValue(shouldAnimateMessages ? 0 : 1);
    const entranceTranslateY = useSharedValue(shouldAnimateMessages ? 30 : 0);
    const entranceScale = useSharedValue(shouldAnimateMessages ? 0.8 : 1);
    
    // Efecto para animar la entrada del mensaje
    useEffect(() => {
      if (shouldAnimateMessages && isRecentMessage) {
        const delay = Math.min(index * 50, 300); // Máximo 300ms de delay
        
        entranceOpacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
        entranceTranslateY.value = withDelay(delay, withTiming(0, { duration: 400 }));
        entranceScale.value = withDelay(delay, withTiming(1, { duration: 400 }));
      }
    }, [shouldAnimateMessages, index, isRecentMessage]);
    
    // Detectar si es una respuesta
    const isReply = item.content.startsWith('↳');
    let originalMessage = '';
    let replyText = item.content;
    
    if (isReply) {
      const parts = item.content.split('\n\n');
      if (parts.length >= 2) {
        originalMessage = parts[0].replace('↳ ', '');
        replyText = parts.slice(1).join('\n\n');
      }
    }

    // Solo habilitar gestos en mensajes recientes para mejor performance
    const panGesture = isRecentMessage ? Gesture.Pan()
      .onUpdate((event) => {
        translateX.value = Math.max(-100, Math.min(100, event.translationX));
      })
      .onEnd((event) => {
        if (event.translationX > 50 || event.velocityX > 500) {
          runOnJS(setReplyingTo)(item);
        }
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
      })
      .activeOffsetX([-10, 10])
      .failOffsetY([-5, 5]) : Gesture.Pan().enabled(false);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: entranceTranslateY.value },
        { scale: entranceScale.value }
      ],
      opacity: shouldAnimateMessages ? 
        Math.min(entranceOpacity.value, Math.max(0.7, 1 - Math.abs(translateX.value) / 200)) :
        Math.max(0.7, 1 - Math.abs(translateX.value) / 200),
    }), [shouldAnimateMessages]);

    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.messageContainer,
            isMine ? styles.messageContainerMine : styles.messageContainerOther,
            isRecentMessage ? animatedStyle : undefined
          ]}
        >
          <View style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleOther,
            item.type === 'image' && styles.imageBubble
          ]}>
            {item.type === 'image' ? (
              <TouchableOpacity 
                style={styles.imageMessageContainer}
                onPress={() => {
                  // Mostrar imagen en tamaño completo
                  Alert.alert(
                    'Imagen',
                    'Funcionalidad de vista completa próximamente',
                    [{ text: 'OK', style: 'default' }]
                  );
                }}
                activeOpacity={0.8}
              >
                <Image 
                  source={{ uri: item.content }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                  onError={(error) => {
                    console.warn('❌ Error cargando imagen:', error.nativeEvent.error);
                  }}
                  onLoad={() => {
                    console.log('✅ Imagen cargada exitosamente');
                  }}
                />
                {isTemporary && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#F9C80E" />
                    <Text style={styles.uploadingText}>Subiendo...</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : isReply ? (
              <View style={styles.replyMessageContainer}>
                <View style={[
                  styles.originalMessagePreview,
                  isMine ? styles.originalMessagePreviewMine : styles.originalMessagePreviewOther
                ]}>
                  <View style={styles.replyIndicator} />
                  <Text style={[
                    styles.originalMessageText,
                    isMine ? styles.originalMessageTextMine : styles.originalMessageTextOther
                  ]} numberOfLines={1}>
                    {originalMessage}
                  </Text>
                </View>
                <Text style={[
                  styles.bubbleText,
                  isMine ? styles.bubbleTextMine : styles.bubbleTextOther
                ]}>
                  {replyText}
                </Text>
              </View>
            ) : (
              <Text style={[
                styles.bubbleText,
                isMine ? styles.bubbleTextMine : styles.bubbleTextOther
              ]}>
                {item.content}
              </Text>
            )}
            
          </View>
        </Animated.View>
      </GestureDetector>
    );
  });

  const renderItem = useCallback(({ item, index }: { item: ChatMessage, index: number }) => (
    <MessageItem item={item} index={index} />
  ), []);

  // Optimización de getItemLayout para mejor scroll performance
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 80,
    offset: 80 * index,
    index,
  }), []);

  const keyExtractor = useCallback((item: ChatMessage, index: number) => 
    `${item.messageId}-${index}`, []
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#F9C80E" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerCenter} onPress={() => {
          // Navegar al perfil del usuario
          router.push({
            pathname: '/user-profile',
            params: {
              id: otherUserId,
              name: otherUserInfo?.name || `Usuario ${String(otherUserId).slice(-4)}`,
              age: otherUserInfo?.age?.toString() || '0',
              gender: otherUserInfo?.gender || 'other',
              profileImage: otherUserInfo?.profileImage || '',
              country: otherUserInfo?.country || 'Unknown',
              countryFlag: otherUserInfo?.countryFlag || '🌍',
              isOnline: otherUserInfo?.isOnline?.toString() || 'false',
              description: 'Usuario de Luna'
            }
          });
        }}>
          <View style={styles.userInfo}>
            <View style={styles.profileImageContainer}>
              {otherUserInfo?.profileImage ? (
                <Image 
                  source={{ uri: otherUserInfo.profileImage }} 
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.defaultProfileImage}>
                  <Text style={styles.defaultProfileText}>
                    {otherUserInfo?.name ? otherUserInfo.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
              {/* Indicador de estado online */}
              {otherUserInfo?.isOnline && (
                <View style={styles.onlineIndicator} />
              )}
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName} numberOfLines={1}>
                {otherUserInfo?.name || 'Usuario'}
              </Text>
              <View style={styles.userStatus}>
                {otherUserInfo?.isOnline ? (
                  <Text style={styles.onlineText}>En línea</Text>
                ) : otherUserInfo?.lastSeen ? (
                  <Text style={styles.lastSeenText}>
                    Última vez: {new Date(otherUserInfo.lastSeen).toLocaleDateString()}
                  </Text>
                ) : (
                  <Text style={styles.offlineText}>Desconectado</Text>
                )}
                {otherUserInfo?.countryFlag && (
                  <Text style={styles.countryFlag}>{otherUserInfo.countryFlag}</Text>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
        <View style={{ width: 36 }} />
      </View>

        {/* Lista de mensajes optimizada */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            isKeyboardVisible && { paddingBottom: 20 }
          ]}
          showsVerticalScrollIndicator={false}
          inverted={true} // Mensajes más recientes abajo
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={8}
          initialNumToRender={15}
          updateCellsBatchingPeriod={100}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 100
          }}
          // Paginación: cargar mensajes antiguos al hacer scroll hacia arriba
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.1}
          ListFooterComponent={
            isLoadingOlder ? (
              <View style={styles.loadingOlderContainer}>
                <ActivityIndicator size="small" color="#F9C80E" />
                <Text style={styles.loadingOlderText}>Cargando mensajes anteriores...</Text>
              </View>
            ) : !hasMoreMessages && messages.length > 0 ? (
              <View style={styles.noMoreMessagesContainer}>
                <Text style={styles.noMoreMessagesText}>• • •</Text>
                <Text style={styles.noMoreMessagesSubtext}>Inicio de la conversación</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            isLoading && !messagesLoaded ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F9C80E" />
                <Text style={styles.loadingText}>Cargando mensajes...</Text>
              </View>
            ) : messagesLoaded && messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>No hay mensajes aún</Text>
                <Text style={styles.emptySubtext}>Envía el primer mensaje</Text>
              </View>
            ) : null
          }
        />

        {/* Input de respuesta */}
        {replyingTo && (
          <View style={styles.replyContainer}>
            <View style={styles.replyContent}>
              <View style={styles.replyHeader}>
                <Text style={styles.replyLabel}>Respondiendo a:</Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Ionicons name="close" size={16} color="#F9C80E" />
                </TouchableOpacity>
              </View>
              <Text style={styles.replyText} numberOfLines={2}>
                {replyingTo.content}
              </Text>
            </View>
          </View>
        )}
        
        {isUploadingImage && (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="small" color="#F9C80E" />
            <Text style={styles.uploadingMessageText}>Subiendo imagen...</Text>
            <TouchableOpacity 
              onPress={() => {
                console.log('🔄 Force resetting upload state');
                setIsUploadingImage(false);
              }}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputBar}>
          <TouchableOpacity 
            onPress={pickImage} 
            disabled={isUploadingImage}
            style={[styles.imageBtn, { opacity: isUploadingImage ? 0.5 : 1 }]}
          >
            {isUploadingImage ? (
              <ActivityIndicator size="small" color="#F9C80E" />
            ) : (
              <Ionicons name="add" size={24} color="#F9C80E" />
            )}
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={replyingTo ? "Escribe tu respuesta..." : "Escribe un mensaje..."}
            placeholderTextColor="#888"
            style={styles.textInput}
            multiline
            maxLength={1000}
            returnKeyType="send"
            blurOnSubmit={false}
            onFocus={() => {
              // Hacer scroll al final cuando el usuario toca el input
              setTimeout(() => scrollToEnd(true), 300);
            }}
            onSubmitEditing={() => {
              if (input.trim()) {
                handleSend();
              }
            }}
          />
          <TouchableOpacity 
            onPress={handleSend} 
            disabled={isSending || !input.trim()} 
            style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.5 }]}
          >
            <Ionicons name="send" size={20} color={input.trim() ? '#F9C80E' : '#F9C80E'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
});

export default GlobalChatScreen;

// Estilos (mantenemos los mismos estilos existentes)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    marginTop: 25,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  backButton: {
    marginTop: 5,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  userInfo: {
    marginTop: 5,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    borderRadius: 16,
    marginRight: 12,
    position: 'relative',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  defaultProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2f2f2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultProfileText: {
    color: '#F9C80E',
    fontSize: 16,
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#000000',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  userStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
  },
  lastSeenText: {
    color: '#888',
    fontSize: 12,
  },
  offlineText: {
    color: '#666',
    fontSize: 12,
  },
  countryFlag: {
    marginLeft: 6,
    fontSize: 12,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageContainerMine: {
    alignSelf: 'flex-end',
  },
  messageContainerOther: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  bubbleMine: {
    backgroundColor: '#F9C80E',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#2F2F2F',
    borderBottomLeftRadius: 4,
  },
  imageBubble: {
    padding: 4,
    backgroundColor: 'transparent',
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#000000',
    fontWeight: '500',
  },
  bubbleTextOther: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  replyMessageContainer: {
    width: '100%',
  },
  originalMessagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  originalMessagePreviewMine: {
    backgroundColor: 'rgba(249, 200, 14, 0.1)',
    borderLeftColor: '#F9C80E',
  },
  originalMessagePreviewOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftColor: '#666666',
  },
  replyIndicator: {
    width: 4,
    height: 4,
    borderRadius: 16,
    marginRight: 8,
  },
  originalMessageText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
  },
  originalMessageTextMine: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  originalMessageTextOther: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  replyContainer: {
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2F2F2F',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replyContent: {
    backgroundColor: '#2F2F2F',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F9C80E',
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyLabel: {
    color: '#F9C80E',
    fontSize: 12,
    fontWeight: '600',
  },
  replyText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  imageBtn: {
    backgroundColor: '#2F2F2F',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textInput: {
    color: '#fff',
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: '#2F2F2F',
    borderRadius: 16,
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  // Estilos para mensajes de imagen
  imageMessageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: 12,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  uploadingText: {
    color: '#F9C80E',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2F2F2F',
  },
  uploadingMessageText: {
    color: '#F9C80E',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  resetButton: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Estilos para paginación
  loadingOlderContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOlderText: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  noMoreMessagesContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMoreMessagesText: {
    color: '#666',
    fontSize: 20,
    letterSpacing: 4,
  },
  noMoreMessagesSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

