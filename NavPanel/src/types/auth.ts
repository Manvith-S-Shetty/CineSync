import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { UserProfile } from './models';

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  firebaseReady: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

export interface AuthProviderProps {
  children: ReactNode;
}
