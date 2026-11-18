import { useState, useEffect, type FormEvent, type MouseEvent } from 'react';
import { useAuth } from '../contexts/useAuth';
import './LoginScreen.css';

interface FirebaseErrorLike {
  code?: string;
  message?: string;
}

export default function LoginScreen() {
  const { signInWithGoogle, firebaseReady } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const [coords, setCoords] = useState({ x: '50%', y: '50%' });
  const [glowOffset, setGlowOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      const card = document.querySelector('.card-wrapper');
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCoords({ x: `${x}px`, y: `${y}px` });
      }

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const moveX = (e.clientX - centerX) * 0.05;
      const moveY = (e.clientY - centerY) * 0.05;
      setGlowOffset({ x: moveX, y: moveY });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  const onGoogle = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setErr('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      const fe = e as FirebaseErrorLike;
      console.error('GOOGLE LOGIN ERROR:', e);
      console.error('CODE:', fe?.code);
      console.error('MESSAGE:', fe?.message);
      setErr(`${fe?.code ?? 'auth/error'} : ${fe?.message ?? 'Sign-in failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr('Email/password authentication is currently disabled. Please use Google Sign-In.');
  };

  const bgImage = isSignUp
    ? "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDtzKTBrpJP58irWVMQWLRCZu8jsK4q3vWi3k20_3FI-bQYqfNzTUDKAH72htH-_gztwajGTCFZA_PDtYxVjrgplaV0UPObZw4_jcuPiY0Pej6RdtHYzuhmT587_ISONuDYUzZz6r0ZukcRSiLgLejtMFdokex8aHudZiGeg_xM6KepCoOSlEuPhboKY-jJu_jaZuDQL5lCyai2rqKrW5E769fZileKsyUTMQc21fsq7TQZJRaYZjbtUp3y-DzsRrT7hGLkBVO7i_k')"
    : "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBwQo-XiWAdeqsN9kRcR6VR221-36imYH9FbLCOKBZiN86gMUjp9qr-if9ABQoGef2wWrERRePdtQP_ZR_1JAjgWnqyAG_WF_-Ucvbhx1dCRwHVKvFjrNLZKPG_tNmM3T74zaddzBDuVkWR4ATOpWqbuvbs_jVq64A51W2KSgTkM87qp9bNVboaCI5YWG0i2_KchaaN7nkMwNXufkz4A5SsqfpcFCV-F1oi4Ue06JZXqw8I8a2F1j708wHZI-3MHknUwJQne-rBV7k')";

  return (
    <div className="login-screen-root bg-background text-on-surface min-h-screen flex flex-col relative overflow-hidden font-body-md">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-80 mix-blend-screen transition-all duration-700"
          style={{ backgroundImage: bgImage }}
        />
        <div className="absolute inset-0 bg-background/60"></div>
      </div>

      <div
        className="bg-glow-effect absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(221,183,255,0.15)_0%,transparent_70%)] pointer-events-none z-0 transition-transform duration-75 ease-out"
        style={{
          transform: `translate(calc(-50% + ${glowOffset.x}px), calc(-50% + ${glowOffset.y}px))`,
        }}
      />

      <main className="flex-grow flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop relative z-10 w-full max-w-container-max mx-auto">
        <div className="mb-[64px] flex flex-col items-center content-layer">
          <img
            alt="Movie Party Logo"
            className="w-24 h-24 mb-4 rounded-full border border-outline-variant/30 shadow-[0_0_20px_rgba(221,183,255,0.2)] object-contain"
            src="https://lh3.googleusercontent.com/aida/AP1WRLtk7jOn5vraPksFVFRImwXt3TaWyTUMdviV9-jZs-XzekeQnh1W8jUhYolnMs_9_mu8_9q8ej3ews3nhSgKEp2_o5Ui6Hmpi4x3pHbmVytta2-AcR0S_9lponRdaHUvRT_XU_dDgQnkrm5jqNds5zKq84voX6-5rZJVu5DKFURdtEIec3Yi8fGGwv3kMAdYFOn61dv9JWqP1XA1Llt7m8zEN9NXupBsycwAGaHWfthCtYKYckk_J-KbgY0"
          />
          <h1 className="font-display-lg text-display-lg text-white tracking-tight text-center md:hidden font-headline-lg-mobile text-headline-lg-mobile drop-shadow-md">Movie Party</h1>
          <h1 className="font-display-lg text-display-lg text-white tracking-tight text-center hidden md:block drop-shadow-md">Movie Party</h1>
        </div>

        <div
          className="card-wrapper w-full max-w-md floating-card relative"
          style={{
            ['--mouse-x' as string]: coords.x,
            ['--mouse-y' as string]: coords.y,
          }}
        >
          <div className="ambient-glow rounded-2xl"></div>
          <div className="w-full glass-panel rounded-xl p-8 relative overflow-hidden">
            <div className="glass-shimmer"></div>
            <div className="absolute inset-0 border border-primary/10 rounded-xl pointer-events-none"></div>
            <div className="content-layer">
              {!isSignUp ? (
                <>
                  <div className="text-center mb-8">
                    <h2 className="font-headline-lg text-headline-lg text-white mb-2 md:hidden font-headline-lg-mobile text-headline-lg-mobile drop-shadow-sm">Welcome Back</h2>
                    <h2 className="font-headline-lg text-headline-lg text-white mb-2 hidden md:block drop-shadow-sm">Welcome Back</h2>
                    <p className="font-body-md text-body-md text-gray-300">Log in to resume your watch parties.</p>
                  </div>
                  {!firebaseReady && (
                    <div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-sm">Firebase is not configured. Google Sign-In is disabled.</div>
                  )}
                  {err && (
                    <div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-sm">{err}</div>
                  )}
                  <form className="space-y-6" onSubmit={handleFormSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label className="block font-label-md text-label-md text-gray-300 mb-2" htmlFor="email">Email Address</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><span className="material-symbols-outlined text-[20px]">mail</span></span>
                          <input className="block w-full pl-10 pr-3 py-3 bg-black/40 border border-white/10 rounded-lg text-white font-body-md focus:outline-none input-glow transition-all placeholder:text-gray-500" id="email" name="email" placeholder="you@example.com" required type="email" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block font-label-md text-label-md text-gray-300" htmlFor="password">Password</label>
                          <a className="font-label-md text-label-md text-primary hover:text-primary-fixed transition-colors" href="#" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
                        </div>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><span className="material-symbols-outlined text-[20px]">lock</span></span>
                          <input className="block w-full pl-10 pr-10 py-3 bg-black/40 border border-white/10 rounded-lg text-white font-body-md focus:outline-none input-glow transition-all placeholder:text-gray-500" id="password" name="password" placeholder="••••••••" required type="password" />
                        </div>
                      </div>
                    </div>
                    <button className="w-full flex items-center justify-center py-3 px-4 bg-primary text-on-primary font-label-md text-label-md rounded-lg pulse-glow transition-all duration-300 transform active:scale-[0.98] border border-primary-fixed/30 relative overflow-hidden group" type="submit">
                      <span className="relative z-10">Log In</span>
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                  </form>
                  <div className="mt-8 mb-6 flex items-center justify-between">
                    <div className="w-full h-[1px] bg-white/10"></div>
                    <span className="px-4 font-label-md text-label-md text-gray-400 uppercase tracking-widest whitespace-nowrap">Or continue with</span>
                    <div className="w-full h-[1px] bg-white/10"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={onGoogle} disabled={!firebaseReady || loading} className="flex items-center justify-center py-3 px-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="material-symbols-outlined mr-2 text-gray-300 group-hover:text-white">login</span>
                      <span className="font-label-md text-label-md text-white">Google</span>
                    </button>
                    <button type="button" onClick={(e) => { e.preventDefault(); setErr('Discord authentication is currently disabled.'); }} className="flex items-center justify-center py-3 px-4 bg-[#5865F2]/20 border border-[#5865F2]/30 rounded-lg hover:bg-[#5865F2]/30 transition-colors group">
                      <span className="material-symbols-outlined mr-2 text-[#5865F2]">forum</span>
                      <span className="font-label-md text-label-md text-white">Discord</span>
                    </button>
                  </div>
                  <div className="mt-8 text-center">
                    <p className="font-body-md text-body-md text-gray-300">
                      Don&apos;t have an account?{' '}
                      <a className="text-primary hover:text-primary-fixed font-semibold transition-colors" href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(true); setErr(''); }}>Sign up</a>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h2 className="font-headline-lg text-headline-lg text-white mb-2 md:hidden font-headline-lg-mobile text-headline-lg-mobile drop-shadow-sm">Create Account</h2>
                    <h2 className="font-headline-lg text-headline-lg text-white mb-2 hidden md:block drop-shadow-sm">Create Account</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">Join the premiere social viewing experience.</p>
                  </div>
                  {!firebaseReady && (<div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-sm">Firebase is not configured. Google Sign-In is disabled.</div>)}
                  {err && (<div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-sm">{err}</div>)}
                  <div className="space-y-4 mb-8">
                    <button onClick={onGoogle} disabled={!firebaseReady || loading} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-high/60 backdrop-blur-md hover:bg-surface-container-highest/80 border border-outline-variant/50 rounded-lg transition-colors duration-300 font-label-md text-label-md text-white disabled:opacity-50 disabled:cursor-not-allowed">
                      Continue with Google
                    </button>
                    <button onClick={(e) => { e.preventDefault(); setErr('Discord authentication is currently disabled.'); }} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#5865F2]/10 backdrop-blur-md hover:bg-[#5865F2]/30 border border-[#5865F2]/40 rounded-lg transition-colors duration-300 font-label-md text-label-md text-white">Continue with Discord</button>
                  </div>
                  <div className="relative flex items-center py-4 mb-4">
                    <div className="flex-grow border-t border-outline-variant/30"></div>
                    <span className="flex-shrink-0 mx-4 text-on-surface-variant font-label-md text-label-md">OR</span>
                    <div className="flex-grow border-t border-outline-variant/30"></div>
                  </div>
                  <form className="space-y-5" onSubmit={handleFormSubmit}>
                    <div><label className="block font-label-md text-label-md text-white mb-1" htmlFor="name">Display Name</label><input className="w-full bg-[#050505]/40 backdrop-blur-md border border-outline-variant/60 rounded-lg py-3 px-4 text-white placeholder:text-on-surface-variant/50 focus:outline-none input-glow transition-all duration-300 font-body-md text-body-md" id="name" placeholder="CinemaLover99" type="text" required /></div>
                    <div><label className="block font-label-md text-label-md text-white mb-1" htmlFor="email-signup">Email Address</label><input className="w-full bg-[#050505]/40 backdrop-blur-md border border-outline-variant/60 rounded-lg py-3 px-4 text-white placeholder:text-on-surface-variant/50 focus:outline-none input-glow transition-all duration-300 font-body-md text-body-md" id="email-signup" placeholder="you@example.com" type="email" required /></div>
                    <div><label className="block font-label-md text-label-md text-white mb-1" htmlFor="password-signup">Password</label><input className="w-full bg-[#050505]/40 backdrop-blur-md border border-outline-variant/60 rounded-lg py-3 px-4 text-white placeholder:text-on-surface-variant/50 focus:outline-none input-glow transition-all duration-300 font-body-md text-body-md" id="password-signup" placeholder="••••••••" type="password" required /></div>
                    <button className="w-full bg-primary-container/90 backdrop-blur-sm text-on-primary-container font-label-md text-label-md py-3 px-4 rounded-lg mt-6 btn-primary-glow transition-all duration-300 flex items-center justify-center gap-2" type="submit"><span>Join the Party</span></button>
                  </form>
                  <p className="mt-6 text-center font-body-md text-body-md text-white/80 text-sm">Already have an account? <a className="text-primary hover:text-primary-fixed-dim transition-colors font-medium" href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(false); setErr(''); }}>Sign in</a></p>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="mt-12 max-w-lg text-center content-layer">
          <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 rounded-full py-2 px-4 backdrop-blur-xl">
            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-error"></span></span>
            <p className="font-label-md text-label-md text-white drop-shadow-sm">Join 10,000+ movie fans already hosting parties.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
