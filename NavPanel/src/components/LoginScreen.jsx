import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginScreen.css';

export default function LoginScreen() {
  const { signInWithGoogle, firebaseReady } = useAuth();
  const [err, setErr] = useState('');

  const onGoogle = async () => {
    setErr('');
    try {
      await signInWithGoogle();
    } catch (e) {
      setErr(e?.message || 'Sign-in failed');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-screen__card">
        <h1 className="login-screen__title">CineSync</h1>
        <p className="login-screen__subtitle">
          Sign in with Google to create or join watch-party rooms.
        </p>
        {!firebaseReady ? (
          <p className="login-screen__warn">
            Firebase is not configured. Add <code>VITE_FIREBASE_*</code> keys to{' '}
            <code>.env</code> (see <code>.env.example</code>).
          </p>
        ) : null}
        {err ? <p className="login-screen__error">{err}</p> : null}
        <button
          type="button"
          className="login-screen__google"
          onClick={onGoogle}
          disabled={!firebaseReady}
        >
          <span className="login-screen__google-icon" aria-hidden />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
