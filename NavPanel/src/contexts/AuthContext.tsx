import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, firebaseReady, googleProvider } from '../firebase';
import {
  getAuthErrorMessage,
  shouldFallbackToRedirect,
} from '../utils/authErrors';
import type { AuthContextValue, AuthProviderProps } from '../types/auth';
import type { UserProfile } from '../types/models';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const redirectCheckedRef = useRef(false);
  const signInPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setLoading(false);
      return;
    }

    let authStateSettled = false;
    let redirectSettled = false;

    const settleLoading = () => {
      if (authStateSettled && redirectSettled) setLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      authStateSettled = true;
      settleLoading();
    });

    // Process a pending redirect result exactly once per app initialization.
    if (redirectCheckedRef.current) {
      redirectSettled = true;
      settleLoading();
    } else {
      redirectCheckedRef.current = true;
      getRedirectResult(auth)
        .catch((error: unknown) => {
          setAuthError(getAuthErrorMessage(error));
        })
        .finally(() => {
          redirectSettled = true;
          settleLoading();
        });
    }

    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback((): Promise<void> => {
    if (signInPromiseRef.current) return signInPromiseRef.current;

    const run = async (): Promise<void> => {
      if (!auth || !googleProvider) {
        throw new Error('Firebase is not configured. Set VITE_FIREBASE_* in .env');
      }

      setAuthError(null);

      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error: unknown) {
        // Fall back to a full-page redirect only when the browser/environment
        // refuses to open the popup. Never fall back for unrelated errors.
        if (shouldFallbackToRedirect(error)) {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw error;
      }
    };

    const promise = run().finally(() => {
      signInPromiseRef.current = null;
    });
    signInPromiseRef.current = promise;
    return promise;
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
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
      authError,
      clearAuthError,
    }),
    [
      user,
      profile,
      loading,
      signInWithGoogle,
      logout,
      getIdToken,
      authError,
      clearAuthError,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
