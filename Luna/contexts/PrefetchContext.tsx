import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PrefetchData {
  superLike: {
    starsCount: number;
    hasGivenSuperLike: boolean;
  };
  friendRequest: {
    status: 'none' | 'pending' | 'accepted' | 'rejected';
  };
  conversation: {
    hasActiveConversation: boolean;
  };
}

interface UserWithPrefetch {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  profileImage?: string;
  country: string;
  countryFlag: string;
  isOnline: boolean;
  description: string;
  lastConnection?: string;
  connectionPriority?: number;
  prefetchData: PrefetchData;
}

interface PrefetchContextType {
  prefetchedUsers: Map<string, UserWithPrefetch>;
  setPrefetchedUsers: (users: UserWithPrefetch[]) => void;
  getPrefetchedUser: (userId: string) => UserWithPrefetch | null;
  clearPrefetchCache: () => void;
}

const PrefetchContext = createContext<PrefetchContextType | undefined>(undefined);

export const PrefetchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [prefetchedUsers, setPrefetchedUsersMap] = useState<Map<string, UserWithPrefetch>>(new Map());

  const setPrefetchedUsers = (users: UserWithPrefetch[]) => {
    const userMap = new Map<string, UserWithPrefetch>();
    users.forEach(user => {
      userMap.set(user.id, user);
    });
    setPrefetchedUsersMap(userMap);
    
    if (__DEV__) {
      console.log(`📦 PrefetchContext: Almacenados ${users.length} usuarios con datos prefetchados`);
    }
  };

  const getPrefetchedUser = (userId: string): UserWithPrefetch | null => {
    const user = prefetchedUsers.get(userId);
    if (user && __DEV__) {
      console.log(`📦 PrefetchContext: Datos prefetchados encontrados para usuario ${userId}`);
    }
    return user || null;
  };

  const clearPrefetchCache = () => {
    setPrefetchedUsersMap(new Map());
    if (__DEV__) {
      console.log('🧹 PrefetchContext: Caché de prefetch limpiado');
    }
  };

  return (
    <PrefetchContext.Provider
      value={{
        prefetchedUsers,
        setPrefetchedUsers,
        getPrefetchedUser,
        clearPrefetchCache
      }}
    >
      {children}
    </PrefetchContext.Provider>
  );
};

export const usePrefetch = (): PrefetchContextType => {
  const context = useContext(PrefetchContext);
  if (!context) {
    throw new Error('usePrefetch debe ser usado dentro de un PrefetchProvider');
  }
  return context;
};

export type { UserWithPrefetch, PrefetchData };
