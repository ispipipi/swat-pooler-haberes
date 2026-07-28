import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, firebaseReady } from '../lib/firebaseClient.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(firebaseReady);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  async function login(email, password) {
    if (!auth) return;
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (cause) {
      setError(mapAuthError(cause));
    }
  }

  async function logout() {
    if (auth) await signOut(auth);
  }

  return {
    user,
    loading,
    error,
    login,
    logout,
    firebaseReady,
  };
}

function mapAuthError(error) {
  const code = error?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) {
    return 'No pudimos iniciar sesión con ese correo y contraseña. Revisa las credenciales internas Swat.';
  }
  if (code.includes('user-not-found')) {
    return 'Ese correo no existe en Firebase Auth. La cuenta debe ser creada manualmente por Julio o Milenko.';
  }
  if (code.includes('too-many-requests')) {
    return 'Firebase bloqueó temporalmente los intentos de acceso. Espera unos minutos antes de volver a probar.';
  }
  return 'No pudimos conectar con Firebase Auth. Revisa la configuración del proyecto y vuelve a intentar.';
}
