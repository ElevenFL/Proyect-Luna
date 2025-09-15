import { FriendRequest } from "../models/FriendRequest.js";
import { User } from "../models/Users.js";

/**
 * Enviar una solicitud de amistad
 */
export const sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const senderId = req.user.id;

    console.log('📤 Enviando solicitud de amistad:', { senderId, receiverId: userId });

    // Validar que no se envíe solicitud a sí mismo
    if (senderId === userId) {
      return res.status(400).json({
        success: false,
        message: "No puedes enviar una solicitud de amistad a ti mismo",
        error: "INVALID_REQUEST"
      });
    }

    // Verificar que el usuario receptor existe
    const receiver = await User.findById(userId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
        error: "USER_NOT_FOUND"
      });
    }

    // Verificar si ya existe una solicitud entre estos usuarios (en cualquier dirección)
    const existingRequest = await FriendRequest.findExistingRequestBidirectional(senderId, userId);
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Ya existe una solicitud de amistad entre estos usuarios",
        error: "REQUEST_ALREADY_EXISTS"
      });
    }

    // Crear la solicitud de amistad
    const friendRequest = await FriendRequest.create({
      senderId,
      receiverId: userId,
      status: 'pending'
    });

    console.log('✅ Solicitud de amistad enviada exitosamente:', friendRequest.id);

    res.status(201).json({
      success: true,
      message: "Solicitud de amistad enviada exitosamente",
      data: {
        friendRequestId: friendRequest.id,
        senderId: friendRequest.senderId,
        receiverId: friendRequest.receiverId,
        status: friendRequest.status,
        createdAt: friendRequest.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error enviando solicitud de amistad:', error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
};

/**
 * Aceptar una solicitud de amistad
 */
export const acceptFriendRequest = async (req, res) => {
  try {
    const { friendRequestId } = req.params;
    const userId = req.user.id;

    console.log('✅ Aceptando solicitud de amistad:', { friendRequestId, userId });

    // Buscar la solicitud de amistad
    const friendRequest = await FriendRequest.findById(friendRequestId);
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: "Solicitud de amistad no encontrada",
        error: "FRIEND_REQUEST_NOT_FOUND"
      });
    }

    // Verificar que el usuario actual es el receptor
    if (friendRequest.receiverId !== userId) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para aceptar esta solicitud",
        error: "UNAUTHORIZED"
      });
    }

    // Verificar que la solicitud esté pendiente
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Esta solicitud ya ha sido procesada",
        error: "REQUEST_ALREADY_PROCESSED"
      });
    }

    // Actualizar el estado a aceptado
    await friendRequest.updateStatus('accepted');

    console.log('✅ Solicitud de amistad aceptada:', friendRequestId);

    res.json({
      success: true,
      message: "Solicitud de amistad aceptada exitosamente",
      data: {
        friendRequestId: friendRequest.id,
        status: friendRequest.status,
        updatedAt: friendRequest.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error aceptando solicitud de amistad:', error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
};

/**
 * Rechazar una solicitud de amistad
 */
export const rejectFriendRequest = async (req, res) => {
  try {
    const { friendRequestId } = req.params;
    const userId = req.user.id;

    console.log('❌ Rechazando solicitud de amistad:', { friendRequestId, userId });

    // Buscar la solicitud de amistad
    const friendRequest = await FriendRequest.findById(friendRequestId);
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: "Solicitud de amistad no encontrada",
        error: "FRIEND_REQUEST_NOT_FOUND"
      });
    }

    // Verificar que el usuario actual es el receptor
    if (friendRequest.receiverId !== userId) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para rechazar esta solicitud",
        error: "UNAUTHORIZED"
      });
    }

    // Verificar que la solicitud esté pendiente
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Esta solicitud ya ha sido procesada",
        error: "REQUEST_ALREADY_PROCESSED"
      });
    }

    // Actualizar el estado a rechazado
    await friendRequest.updateStatus('rejected');

    console.log('✅ Solicitud de amistad rechazada:', friendRequestId);

    res.json({
      success: true,
      message: "Solicitud de amistad rechazada exitosamente",
      data: {
        friendRequestId: friendRequest.id,
        status: friendRequest.status,
        updatedAt: friendRequest.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error rechazando solicitud de amistad:', error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
};

/**
 * Obtener solicitudes de amistad recibidas
 */
export const getReceivedFriendRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📥 Obteniendo solicitudes de amistad recibidas:', userId);

    // Usar el método alternativo si el GSI no está disponible
    const friendRequests = await FriendRequest.findByReceiverIdAlternative(userId);
    
    // Filtrar solo las solicitudes pendientes
    const pendingRequests = friendRequests.filter(req => req.status === 'pending');

    // Obtener información del usuario que envió cada solicitud
    const requestsWithUserInfo = await Promise.all(
      pendingRequests.map(async (request) => {
        try {
          const sender = await User.findById(request.senderId);
          return {
            id: request.id,
            friendRequestId: request.id,
            senderId: request.senderId,
            senderName: sender ? sender.displayName || sender.username : 'Usuario desconocido',
            senderImage: sender ? sender.profileImage : null,
            status: request.status,
            createdAt: request.createdAt
          };
        } catch (error) {
          console.error('Error obteniendo información del usuario:', error);
          return {
            id: request.id,
            friendRequestId: request.id,
            senderId: request.senderId,
            senderName: 'Usuario desconocido',
            senderImage: null,
            status: request.status,
            createdAt: request.createdAt
          };
        }
      })
    );

    console.log(`✅ ${requestsWithUserInfo.length} solicitudes de amistad encontradas`);

    res.json({
      success: true,
      message: "Solicitudes de amistad obtenidas exitosamente",
      data: {
        friendRequests: requestsWithUserInfo
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo solicitudes de amistad:', error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
};

/**
 * Obtener solicitudes de amistad enviadas
 */
export const getSentFriendRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📤 Obteniendo solicitudes de amistad enviadas:', userId);

    const friendRequests = await FriendRequest.findBySenderId(userId);

    // Obtener información del usuario que recibió cada solicitud
    const requestsWithUserInfo = await Promise.all(
      friendRequests.map(async (request) => {
        try {
          const receiver = await User.findById(request.receiverId);
          return {
            id: request.id,
            friendRequestId: request.id,
            receiverId: request.receiverId,
            receiverName: receiver ? receiver.displayName || receiver.username : 'Usuario desconocido',
            receiverImage: receiver ? receiver.profileImage : null,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt
          };
        } catch (error) {
          console.error('Error obteniendo información del usuario:', error);
          return {
            id: request.id,
            friendRequestId: request.id,
            receiverId: request.receiverId,
            receiverName: 'Usuario desconocido',
            receiverImage: null,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt
          };
        }
      })
    );

    console.log(`✅ ${requestsWithUserInfo.length} solicitudes de amistad enviadas encontradas`);

    res.json({
      success: true,
      message: "Solicitudes de amistad enviadas obtenidas exitosamente",
      data: {
        friendRequests: requestsWithUserInfo
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo solicitudes de amistad enviadas:', error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
};

/**
 * Cancelar una solicitud de amistad enviada
 */
export const cancelFriendRequest = async (req, res) => {
  try {
    const { friendRequestId } = req.params;
    const userId = req.user.id;

    console.log('🚫 Cancelando solicitud de amistad:', { friendRequestId, userId });

    // Buscar la solicitud de amistad
    const friendRequest = await FriendRequest.findById(friendRequestId);
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: "Solicitud de amistad no encontrada",
        error: "FRIEND_REQUEST_NOT_FOUND"
      });
    }

    // Verificar que el usuario actual es el remitente
    if (friendRequest.senderId !== userId) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para cancelar esta solicitud",
        error: "UNAUTHORIZED"
      });
    }

    // Verificar que la solicitud esté pendiente
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Esta solicitud ya ha sido procesada",
        error: "REQUEST_ALREADY_PROCESSED"
      });
    }

    // Eliminar la solicitud
    await friendRequest.delete();

    console.log('✅ Solicitud de amistad cancelada:', friendRequestId);

    res.json({
      success: true,
      message: "Solicitud de amistad cancelada exitosamente"
    });

  } catch (error) {
    console.error('❌ Error cancelando solicitud de amistad:', error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
};

/**
 * Obtener lista de amigos aceptados
 */
export const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('👥 Obteniendo lista de amigos:', userId);

    // Obtener solicitudes enviadas y recibidas en paralelo
    const [sentRequests, receivedRequests] = await Promise.all([
      FriendRequest.findBySenderId(userId),
      FriendRequest.findByReceiverIdAlternative(userId)
    ]);

    // Filtrar solo las solicitudes aceptadas
    const acceptedSentRequests = sentRequests.filter(req => req.status === 'accepted');
    const acceptedReceivedRequests = receivedRequests.filter(req => req.status === 'accepted');

    // Función auxiliar para calcular edad
    const calculateAge = (birthDate) => {
      if (!birthDate) return null;
      try {
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        return age;
      } catch (error) {
        console.error('Error calculando edad:', error);
        return null;
      }
    };

    // Función auxiliar para extraer país de la ubicación
    const extractCountry = (location) => {
      if (!location) return null;
      if (typeof location === 'string') {
        // Si es un string, intentar extraer el país
        return location;
      }
      if (typeof location === 'object' && location.country) {
        return location.country;
      }
      if (typeof location === 'object' && location.address) {
        // Intentar extraer país de la dirección
        const parts = location.address.split(',');
        return parts[parts.length - 1]?.trim() || null;
      }
      return null;
    };

    // Función auxiliar para obtener bandera del país
    const getCountryFlag = (country) => {
      if (!country) return '🌍';
      
      const countryFlags = {
        'España': '🇪🇸',
        'Spain': '🇪🇸',
        'México': '🇲🇽',
        'Mexico': '🇲🇽',
        'Argentina': '🇦🇷',
        'Colombia': '🇨🇴',
        'Perú': '🇵🇪',
        'Peru': '🇵🇪',
        'Chile': '🇨🇱',
        'Venezuela': '🇻🇪',
        'Ecuador': '🇪🇨',
        'Bolivia': '🇧🇴',
        'Uruguay': '🇺🇾',
        'Paraguay': '🇵🇾',
        'Estados Unidos': '🇺🇸',
        'United States': '🇺🇸',
        'USA': '🇺🇸',
        'Francia': '🇫🇷',
        'France': '🇫🇷',
        'Italia': '🇮🇹',
        'Italy': '🇮🇹',
        'Alemania': '🇩🇪',
        'Germany': '🇩🇪',
        'Reino Unido': '🇬🇧',
        'United Kingdom': '🇬🇧',
        'UK': '🇬🇧',
        'Brasil': '🇧🇷',
        'Brazil': '🇧🇷',
        'Canadá': '🇨🇦',
        'Canada': '🇨🇦',
        'Australia': '🇦🇺',
        'Japón': '🇯🇵',
        'Japan': '🇯🇵',
        'China': '🇨🇳',
        'India': '🇮🇳',
        'Rusia': '🇷🇺',
        'Russia': '🇷🇺',
        'Corea del Sur': '🇰🇷',
        'South Korea': '🇰🇷',
        'Portugal': '🇵🇹',
        'Países Bajos': '🇳🇱',
        'Netherlands': '🇳🇱',
        'Bélgica': '🇧🇪',
        'Belgium': '🇧🇪',
        'Suiza': '🇨🇭',
        'Switzerland': '🇨🇭',
        'Austria': '🇦🇹',
        'Suecia': '🇸🇪',
        'Sweden': '🇸🇪',
        'Noruega': '🇳🇴',
        'Norway': '🇳🇴',
        'Dinamarca': '🇩🇰',
        'Denmark': '🇩🇰',
        'Finlandia': '🇫🇮',
        'Finland': '🇫🇮',
        'Polonia': '🇵🇱',
        'Poland': '🇵🇱',
        'República Checa': '🇨🇿',
        'Czech Republic': '🇨🇿',
        'Hungría': '🇭🇺',
        'Hungary': '🇭🇺',
        'Grecia': '🇬🇷',
        'Greece': '🇬🇷',
        'Turquía': '🇹🇷',
        'Turkey': '🇹🇷',
        'Israel': '🇮🇱',
        'Egipto': '🇪🇬',
        'Egypt': '🇪🇬',
        'Sudáfrica': '🇿🇦',
        'South Africa': '🇿🇦',
        'Nigeria': '🇳🇬',
        'Kenia': '🇰🇪',
        'Kenya': '🇰🇪',
        'Marruecos': '🇲🇦',
        'Morocco': '🇲🇦',
        'Túnez': '🇹🇳',
        'Tunisia': '🇹🇳',
        'Argelia': '🇩🇿',
        'Algeria': '🇩🇿',
        'Nueva Zelanda': '🇳🇿',
        'New Zealand': '🇳🇿',
        'Singapur': '🇸🇬',
        'Singapore': '🇸🇬',
        'Tailandia': '🇹🇭',
        'Thailand': '🇹🇭',
        'Vietnam': '🇻🇳',
        'Filipinas': '🇵🇭',
        'Philippines': '🇵🇭',
        'Indonesia': '🇮🇩',
        'Malasia': '🇲🇾',
        'Malaysia': '🇲🇾',
        'Pakistán': '🇵🇰',
        'Pakistan': '🇵🇰',
        'Bangladesh': '🇧🇩',
        'Sri Lanka': '🇱🇰',
        'Nepal': '🇳🇵',
        'Bután': '🇧🇹',
        'Bhutan': '🇧🇹',
        'Myanmar': '🇲🇲',
        'Camboya': '🇰🇭',
        'Cambodia': '🇰🇭',
        'Laos': '🇱🇦',
        'Mongolia': '🇲🇳',
        'Kazajistán': '🇰🇿',
        'Kazakhstan': '🇰🇿',
        'Uzbekistán': '🇺🇿',
        'Uzbekistan': '🇺🇿',
        'Kirguistán': '🇰🇬',
        'Kyrgyzstan': '🇰🇬',
        'Tayikistán': '🇹🇯',
        'Tajikistan': '🇹🇯',
        'Turkmenistán': '🇹🇲',
        'Turkmenistan': '🇹🇲',
        'Afganistán': '🇦🇫',
        'Afghanistan': '🇦🇫',
        'Irán': '🇮🇷',
        'Iran': '🇮🇷',
        'Irak': '🇮🇶',
        'Iraq': '🇮🇶',
        'Siria': '🇸🇾',
        'Syria': '🇸🇾',
        'Líbano': '🇱🇧',
        'Lebanon': '🇱🇧',
        'Jordania': '🇯🇴',
        'Jordan': '🇯🇴',
        'Arabia Saudí': '🇸🇦',
        'Saudi Arabia': '🇸🇦',
        'Emiratos Árabes Unidos': '🇦🇪',
        'United Arab Emirates': '🇦🇪',
        'Kuwait': '🇰🇼',
        'Qatar': '🇶🇦',
        'Baréin': '🇧🇭',
        'Bahrain': '🇧🇭',
        'Omán': '🇴🇲',
        'Oman': '🇴🇲',
        'Yemen': '🇾🇪',
        'Georgia': '🇬🇪',
        'Armenia': '🇦🇲',
        'Azerbaiyán': '🇦🇿',
        'Azerbaijan': '🇦🇿',
        'Chipre': '🇨🇾',
        'Cyprus': '🇨🇾',
        'Malta': '🇲🇹',
        'Islandia': '🇮🇸',
        'Iceland': '🇮🇸',
        'Irlanda': '🇮🇪',
        'Ireland': '🇮🇪',
        'Luxemburgo': '🇱🇺',
        'Luxembourg': '🇱🇺',
        'Liechtenstein': '🇱🇮',
        'Mónaco': '🇲🇨',
        'Monaco': '🇲🇨',
        'San Marino': '🇸🇲',
        'Vaticano': '🇻🇦',
        'Vatican': '🇻🇦',
        'Andorra': '🇦🇩',
        'Moldavia': '🇲🇩',
        'Moldova': '🇲🇩',
        'Bielorrusia': '🇧🇾',
        'Belarus': '🇧🇾',
        'Ucrania': '🇺🇦',
        'Ukraine': '🇺🇦',
        'Lituania': '🇱🇹',
        'Lithuania': '🇱🇹',
        'Letonia': '🇱🇻',
        'Latvia': '🇱🇻',
        'Estonia': '🇪🇪',
        'Eslovaquia': '🇸🇰',
        'Slovakia': '🇸🇰',
        'Eslovenia': '🇸🇮',
        'Slovenia': '🇸🇮',
        'Croacia': '🇭🇷',
        'Croatia': '🇭🇷',
        'Bosnia y Herzegovina': '🇧🇦',
        'Bosnia and Herzegovina': '🇧🇦',
        'Serbia': '🇷🇸',
        'Montenegro': '🇲🇪',
        'Macedonia del Norte': '🇲🇰',
        'North Macedonia': '🇲🇰',
        'Albania': '🇦🇱',
        'Kosovo': '🇽🇰',
        'Bulgaria': '🇧🇬',
        'Rumania': '🇷🇴',
        'Romania': '🇷🇴'
      };
      
      // Buscar bandera por nombre del país (case insensitive)
      const normalizedCountry = country.trim();
      for (const [countryName, flag] of Object.entries(countryFlags)) {
        if (countryName.toLowerCase() === normalizedCountry.toLowerCase()) {
          return flag;
        }
      }
      
      // Si no se encuentra, devolver bandera genérica
      return '🌍';
    };

    // Obtener información de los amigos (receptores de solicitudes enviadas aceptadas)
    const friendsFromSent = await Promise.all(
      acceptedSentRequests.map(async (request) => {
        try {
          const friend = await User.findById(request.receiverId);
          if (!friend) return null;
          
          const age = calculateAge(friend.birthDate);
          const country = extractCountry(friend.location);
          const countryFlag = getCountryFlag(country);
          
          return {
            id: request.receiverId,
            name: friend.displayName || friend.username,
            username: friend.username,
            profileImage: friend.profileImage,
            isOnline: friend.isOnline || false,
            lastSeen: friend.lastConnection,
            age: age,
            gender: friend.gender,
            country: country,
            countryFlag: countryFlag,
            friendshipDate: request.updatedAt
          };
        } catch (error) {
          console.error('Error obteniendo información del amigo:', error);
          return null;
        }
      })
    );

    // Obtener información de los amigos (remitentes de solicitudes recibidas aceptadas)
    const friendsFromReceived = await Promise.all(
      acceptedReceivedRequests.map(async (request) => {
        try {
          const friend = await User.findById(request.senderId);
          if (!friend) return null;
          
          const age = calculateAge(friend.birthDate);
          const country = extractCountry(friend.location);
          const countryFlag = getCountryFlag(country);
          
          return {
            id: request.senderId,
            name: friend.displayName || friend.username,
            username: friend.username,
            profileImage: friend.profileImage,
            isOnline: friend.isOnline || false,
            lastSeen: friend.lastConnection,
            age: age,
            gender: friend.gender,
            country: country,
            countryFlag: countryFlag,
            friendshipDate: request.updatedAt
          };
        } catch (error) {
          console.error('Error obteniendo información del amigo:', error);
          return null;
        }
      })
    );

    // Combinar y filtrar amigos válidos
    const allFriends = [...friendsFromSent, ...friendsFromReceived]
      .filter(friend => friend !== null)
      .sort((a, b) => new Date(b.friendshipDate) - new Date(a.friendshipDate));

    console.log(`✅ ${allFriends.length} amigos encontrados`);

    res.json({
      success: true,
      message: "Lista de amigos obtenida exitosamente",
      data: {
        friends: allFriends,
        count: allFriends.length
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo lista de amigos:', error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
};

/**
 * Obtener todas las solicitudes de amistad (enviadas y recibidas)
 */
export const getAllFriendRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📋 Obteniendo todas las solicitudes de amistad:', userId);

    // Obtener solicitudes enviadas y recibidas en paralelo
    const [sentRequests, receivedRequests] = await Promise.all([
      FriendRequest.findBySenderId(userId),
      FriendRequest.findByReceiverIdAlternative(userId)
    ]);

    // Enriquecer solicitudes enviadas con información del receptor
    const enrichedSentRequests = await Promise.all(
      sentRequests.map(async (request) => {
        try {
          const receiver = await User.findById(request.receiverId);
          return {
            id: request.id,
            friendRequestId: request.id,
            receiverId: request.receiverId,
            receiverName: receiver ? receiver.displayName || receiver.username : 'Usuario desconocido',
            receiverImage: receiver ? receiver.profileImage : null,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            type: 'sent'
          };
        } catch (error) {
          console.error('Error obteniendo información del receptor:', error);
          return {
            id: request.id,
            friendRequestId: request.id,
            receiverId: request.receiverId,
            receiverName: 'Usuario desconocido',
            receiverImage: null,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            type: 'sent'
          };
        }
      })
    );

    // Enriquecer solicitudes recibidas con información del remitente
    const enrichedReceivedRequests = await Promise.all(
      receivedRequests.map(async (request) => {
        try {
          const sender = await User.findById(request.senderId);
          return {
            id: request.id,
            friendRequestId: request.id,
            senderId: request.senderId,
            senderName: sender ? sender.displayName || sender.username : 'Usuario desconocido',
            senderImage: sender ? sender.profileImage : null,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            type: 'received'
          };
        } catch (error) {
          console.error('Error obteniendo información del remitente:', error);
          return {
            id: request.id,
            friendRequestId: request.id,
            senderId: request.senderId,
            senderName: 'Usuario desconocido',
            senderImage: null,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            type: 'received'
          };
        }
      })
    );

    // Combinar y ordenar por fecha de creación
    const allRequests = [...enrichedSentRequests, ...enrichedReceivedRequests]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`✅ ${allRequests.length} solicitudes de amistad encontradas (${enrichedSentRequests.length} enviadas, ${enrichedReceivedRequests.length} recibidas)`);

    res.json({
      success: true,
      message: "Todas las solicitudes de amistad obtenidas exitosamente",
      data: {
        friendRequests: allRequests,
        summary: {
          total: allRequests.length,
          sent: enrichedSentRequests.length,
          received: enrichedReceivedRequests.length,
          pending: allRequests.filter(req => req.status === 'pending').length,
          accepted: allRequests.filter(req => req.status === 'accepted').length,
          rejected: allRequests.filter(req => req.status === 'rejected').length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo todas las solicitudes de amistad:', error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
};

