import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginScreen.css';

export default function LoginScreen() {
  const { signInWithGoogle, firebaseReady } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Mouse tracking state for shimmers & glows
  const [coords, setCoords] = useState({ x: '50%', y: '50%' });
  const [glowOffset, setGlowOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      // Find the card wrapper to compute local mouse coordinates
      const card = document.querySelector('.card-wrapper');
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCoords({ x: `${x}px`, y: `${y}px` });
      }

      // Compute ambient glow movement offset
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const moveX = (e.clientX - centerX) * 0.05;
      const moveY = (e.clientY - centerY) * 0.05;
      setGlowOffset({ x: moveX, y: moveY });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  const onGoogle = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setErr(e?.message || 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setErr('Email/password authentication is currently disabled. Please use Google Sign-In.');
  };

  // Determine background image based on isSignUp
  const bgImage = isSignUp
    ? "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDtzKTBrpJP58irWVMQWLRCZu8jsK4q3vWi3k20_3FI-bQYqfNzTUDKAH72htH-_gztwajGTCFZA_PDtYxVjrgplaV0UPObZw4_jcuPiY0Pej6RdtHYzuhmT587_ISONuDYUzZz6r0ZukcRSiLgLejtMFdokex8aHudZiGeg_xM6KepCoOSlEuPhboKY-jJu_jaZuDQL5lCyai2rqKrW5E769fZileKsyUTMQc21fsq7TQZJRaYZjbtUp3y-DzsRrT7hGLkBVO7i_k')"
    : "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBwQo-XiWAdeqsN9kRcR6VR221-36imYH9FbLCOKBZiN86gMUjp9qr-if9ABQoGef2wWrERRePdtQP_ZR_1JAjgWnqyAG_WF_-Ucvbhx1dCRwHVKvFjrNLZKPG_tNmM3T74zaddzBDuVkWR4ATOpWqbuvbs_jVq64A51W2KSgTkM87qp9bNVboaCI5YWG0i2_KchaaN7nkMwNXufkz4A5SsqfpcFCV-F1oi4Ue06JZXqw8I8a2F1j708wHZI-3MHknUwJQne-rBV7k')";

  return (
    <div className="login-screen-root bg-background text-on-surface min-h-screen flex flex-col relative overflow-hidden font-body-md">
      {/* Ambient Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-80 mix-blend-screen transition-all duration-700" 
          style={{ backgroundImage: bgImage }}
        />
        <div className="absolute inset-0 bg-background/60"></div>
      </div>

      {/* Glowing Screen Effect Behind Card */}
      <div 
        className="bg-glow-effect absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(221,183,255,0.15)_0%,transparent_70%)] pointer-events-none z-0 transition-transform duration-75 ease-out"
        style={{
          transform: `translate(calc(-50% + ${glowOffset.x}px), calc(-50% + ${glowOffset.y}px))`
        }}
      />

      <main className="flex-grow flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop relative z-10 w-full max-w-container-max mx-auto">
        
        {/* Logo Area */}
        <div className="mb-[64px] flex flex-col items-center content-layer">
          <img 
            alt="Movie Party Logo" 
            className="w-24 h-24 mb-4 rounded-full border border-outline-variant/30 shadow-[0_0_20px_rgba(221,183,255,0.2)] object-contain" 
            src="https://lh3.googleusercontent.com/aida/AP1WRLtk7jOn5vraPksFVFRImwXt3TaWyTUMdviV9-jZs-XzekeQnh1W8jUhYolnMs_9_mu8_9q8ej3ews3nhSgKEp2_o5Ui6Hmpi4x3pHbmVytta2-AcR0S_9lponRdaHUvRT_XU_dDgQnkrm5jqNds5zKq84voX6-5rZJVu5DKFURdtEIec3Yi8fGGwv3kMAdYFOn61dv9JWqP1XA1Llt7m8zEN9NXupBsycwAGaHWfthCtYKYckk_J-KbgY0"
          />
          <h1 className="font-display-lg text-display-lg text-white tracking-tight text-center md:hidden font-headline-lg-mobile text-headline-lg-mobile drop-shadow-md">
            Movie Party
          </h1>
          <h1 className="font-display-lg text-display-lg text-white tracking-tight text-center hidden md:block drop-shadow-md">
            Movie Party
          </h1>
        </div>

        {/* Card Wrapper for Floating & Ambient Effects */}
        <div 
          className="card-wrapper w-full max-w-md floating-card relative"
          style={{
            '--mouse-x': coords.x,
            '--mouse-y': coords.y
          }}
        >
          <div className="ambient-glow rounded-2xl"></div>

          {/* Glassmorphism Auth Card */}
          <div className="w-full glass-panel rounded-xl p-8 relative overflow-hidden">
            
            {/* Mouse Tracking Shimmer */}
            <div className="glass-shimmer"></div>

            {/* Inner Glow Highlight */}
            <div className="absolute inset-0 border border-primary/10 rounded-xl pointer-events-none"></div>

            <div className="content-layer">
              {!isSignUp ? (
                /* LOGIN CARD */
                <>
                  <div className="text-center mb-8">
                    <h2 className="font-headline-lg text-headline-lg text-white mb-2 md:hidden font-headline-lg-mobile text-headline-lg-mobile drop-shadow-sm">
                      Welcome Back
                    </h2>
                    <h2 className="font-headline-lg text-headline-lg text-white mb-2 hidden md:block drop-shadow-sm">
                      Welcome Back
                    </h2>
                    <p className="font-body-md text-body-md text-gray-300">
                      Log in to resume your watch parties.
                    </p>
                  </div>

                  {!firebaseReady && (
                    <div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-sm">
                      Firebase is not configured. Google Sign-In is disabled.
                    </div>
                  )}

                  {err && (
                    <div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-sm">
                      {err}
                    </div>
                  )}

                  <form className="space-y-6" onSubmit={handleFormSubmit}>
                    <div className="space-y-4">
                      {/* Email */}
                      <div>
                        <label className="block font-label-md text-label-md text-gray-300 mb-2" htmlFor="email">
                          Email Address
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <span className="material-symbols-outlined text-[20px]">mail</span>
                          </span>
                          <input 
                            className="block w-full pl-10 pr-3 py-3 bg-black/40 border border-white/10 rounded-lg text-white font-body-md focus:outline-none input-glow transition-all placeholder:text-gray-500" 
                            id="email" 
                            name="email" 
                            placeholder="you@example.com" 
                            required 
                            type="email"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block font-label-md text-label-md text-gray-300" htmlFor="password">
                            Password
                          </label>
                          <a 
                            className="font-label-md text-label-md text-primary hover:text-primary-fixed transition-colors" 
                            href="#" 
                            onClick={(e) => e.preventDefault()}
                          >
                            Forgot Password?
                          </a>
                        </div>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <span className="material-symbols-outlined text-[20px]">lock</span>
                          </span>
                          <input 
                            className="block w-full pl-10 pr-10 py-3 bg-black/40 border border-white/10 rounded-lg text-white font-body-md focus:outline-none input-glow transition-all placeholder:text-gray-500" 
                            id="password" 
                            name="password" 
                            placeholder="••••••••" 
                            required 
                            type="password"
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      className="w-full flex items-center justify-center py-3 px-4 bg-primary text-on-primary font-label-md text-label-md rounded-lg pulse-glow transition-all duration-300 transform active:scale-[0.98] border border-primary-fixed/30 relative overflow-hidden group" 
                      type="submit"
                    >
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
                    <button 
                      onClick={onGoogle} 
                      disabled={!firebaseReady || loading} 
                      className="flex items-center justify-center py-3 px-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined mr-2 text-gray-300 group-hover:text-white">login</span>
                      <span className="font-label-md text-label-md text-white">Google</span>
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); setErr("Discord authentication is currently disabled."); }} 
                      className="flex items-center justify-center py-3 px-4 bg-[#5865F2]/20 border border-[#5865F2]/30 rounded-lg hover:bg-[#5865F2]/30 transition-colors group"
                    >
                      <span className="material-symbols-outlined mr-2 text-[#5865F2]">forum</span>
                      <span className="font-label-md text-label-md text-white">Discord</span>
                    </button>
                  </div>

                  <div className="mt-8 text-center">
                    <p className="font-body-md text-body-md text-gray-300">
                      Don't have an account?{' '}
                      <a 
                        className="text-primary hover:text-primary-fixed font-semibold transition-colors" 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); setIsSignUp(true); setErr(''); }}
                      >
                        Sign up
                      </a>
                    </p>
                  </div>
                </>
              ) : (
                /* SIGN UP CARD */
                <>
                  <div className="text-center mb-8">
                    <h2 className="font-headline-lg text-headline-lg text-white mb-2 md:hidden font-headline-lg-mobile text-headline-lg-mobile drop-shadow-sm">
                      Create Account
                    </h2>
                    <h2 className="font-headline-lg text-headline-lg text-white mb-2 hidden md:block drop-shadow-sm">
                      Create Account
                    </h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      Join the premiere social viewing experience.
                    </p>
                  </div>

                  {!firebaseReady && (
                    <div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-sm">
                      Firebase is not configured. Google Sign-In is disabled.
                    </div>
                  )}

                  {err && (
                    <div className="mb-4 p-3 bg-error-container/30 border border-error-container text-error rounded-lg text-sm">
                      {err}
                    </div>
                  )}

                  <div className="space-y-4 mb-8">
                    <button 
                      onClick={onGoogle} 
                      disabled={!firebaseReady || loading} 
                      className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-high/60 backdrop-blur-md hover:bg-surface-container-highest/80 border border-outline-variant/50 rounded-lg transition-colors duration-300 font-label-md text-label-md text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                      </svg>
                      Continue with Google
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); setErr("Discord authentication is currently disabled."); }} 
                      className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#5865F2]/10 backdrop-blur-md hover:bg-[#5865F2]/30 border border-[#5865F2]/40 rounded-lg transition-colors duration-300 font-label-md text-label-md text-white"
                    >
                      <svg className="w-5 h-5 text-[#5865F2]" fill="currentColor" viewBox="0 0 127.14 96.36">
                        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77.7,77.7,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.33,46,96.22,53,91.08,65.69,84.69,65.69Z"></path>
                      </svg>
                      Continue with Discord
                    </button>
                  </div>

                  <div className="relative flex items-center py-4 mb-4">
                    <div className="flex-grow border-t border-outline-variant/30"></div>
                    <span className="flex-shrink-0 mx-4 text-on-surface-variant font-label-md text-label-md">OR</span>
                    <div className="flex-grow border-t border-outline-variant/30"></div>
                  </div>

                  <form className="space-y-5" onSubmit={handleFormSubmit}>
                    <div>
                      <label className="block font-label-md text-label-md text-white mb-1" htmlFor="name">Display Name</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">person</span>
                        <input className="w-full bg-[#050505]/40 backdrop-blur-md border border-outline-variant/60 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-on-surface-variant/50 focus:outline-none input-glow transition-all duration-300 font-body-md text-body-md" id="name" placeholder="CinemaLover99" type="text" required />
                      </div>
                    </div>
                    <div>
                      <label className="block font-label-md text-label-md text-white mb-1" htmlFor="email">Email Address</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">mail</span>
                        <input className="w-full bg-[#050505]/40 backdrop-blur-md border border-outline-variant/60 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-on-surface-variant/50 focus:outline-none input-glow transition-all duration-300 font-body-md text-body-md" id="email" placeholder="you@example.com" type="email" required />
                      </div>
                    </div>
                    <div>
                      <label className="block font-label-md text-label-md text-white mb-1" htmlFor="password">Password</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">lock</span>
                        <input className="w-full bg-[#050505]/40 backdrop-blur-md border border-outline-variant/60 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-on-surface-variant/50 focus:outline-none input-glow transition-all duration-300 font-body-md text-body-md" id="password" placeholder="••••••••" type="password" required />
                      </div>
                    </div>
                    <button className="w-full bg-primary-container/90 backdrop-blur-sm text-on-primary-container font-label-md text-label-md py-3 px-4 rounded-lg mt-6 btn-primary-glow transition-all duration-300 flex items-center justify-center gap-2" type="submit">
                      <span>Join the Party</span>
                      <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                  </form>

                  <p className="mt-6 text-center font-body-md text-body-md text-white/80 text-sm">
                    Already have an account?{' '}
                    <a 
                      className="text-primary hover:text-primary-fixed-dim transition-colors font-medium" 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setIsSignUp(false); setErr(''); }}
                    >
                      Sign in
                    </a>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Benefit Callout */}
        <div className="mt-12 max-w-lg text-center content-layer">
          <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 rounded-full py-2 px-4 backdrop-blur-xl">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-error"></span>
            </span>
            <p className="font-label-md text-label-md text-white drop-shadow-sm">Join 10,000+ movie fans already hosting parties.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
