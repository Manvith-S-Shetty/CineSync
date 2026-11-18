import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, firebaseReady, googleProvider } from '../firebase';
import type { AuthContextValue, AuthProviderProps } from '../types/auth';
import type { UserProfile } from '../types/models';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase is not configured. Set VITE_FIREBASE_* in .env');
    }
    await signInWithPopup(auth, googleProvider);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (auth) await signOut(auth);
  }, []);

  /**
   * Firebase ID token for VisionBridge verification.
   * Never send uid/email/displayName as proof of identity — only this token.
   */
  const getIdToken = useCallback(async (forceRefresh = false): Promise<string> => {
    if (!auth?.currentUser) {
      throw new Error('You must be signed in.');
    }
    return auth.currentUser.getIdToken(forceRefresh);
  }, []);

  /** Global profile for header, participants, and chat (Firebase user). */
  const profile = useMemo<UserProfile | null>(() => {
    if (!user) return null;
    return {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Guest',
      photoURL: user.photoURL || '',
      email: user.email || '',
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      firebaseReady,
      signInWithGoogle,
      logout,
      getIdToken,
    }),
    [user, profile, loading, signInWithGoogle, logout, getIdToken]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
