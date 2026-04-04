import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, firebaseReady, googleProvider } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase is not configured. Set VITE_FIREBASE_* in .env');
    }
    await signInWithPopup(auth, googleProvider);
  }, []);

  const logout = useCallback(async () => {
    if (auth) await signOut(auth);
  }, []);

  /** Global profile for header, participants, and chat (Firebase user). */
  const profile = useMemo(() => {
    if (!user) return null;
    return {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Guest',
      photoURL: user.photoURL || '',
      email: user.email || '',
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      firebaseReady,
      signInWithGoogle,
      logout,
    }),
    [user, profile, loading, firebaseReady, signInWithGoogle, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
