import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBK3Pm21qHSSPjj5Ix4kGiXwL1_jEWRY6s",
  authDomain: "lunea-f9853.firebaseapp.com",
  projectId: "lunea-f9853",
  storageBucket: "lunea-f9853.firebasestorage.app",
  messagingSenderId: "305090861402",
  appId: "1:305090861402:android:9c986e8089fd7a3f7ebb63"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firebase Storage
export const storage = getStorage(app);

export default app;
