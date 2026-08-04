import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/RoomJoin.css';

const isDev = import.meta.env.DEV;
const devLog = (...args) => {
    if (isDev) console.log(...args);
};

const RoomJoin = ({ onJoinRoom, onCreateRoom }) => {
    const { profile } = useAuth();
    const [roomId, setRoomId] = useState('');

    // Mouse tracking state for card glow effect
    const [coords, setCoords] = useState({ x: '50%', y: '50%' });

    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            const card = document.querySelector('.interactive-glass');
            if (card) {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setCoords({ x: `${x}px`, y: `${y}px` });
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }, []);

    const handleJoinSubmit = (e) => {
        e.preventDefault();
        const finalRoomId = roomId.trim();
        if (!finalRoomId) {
            alert('Please enter a Room ID to join');
            return;
        }
        devLog('Joining room:', { roomId: finalRoomId });
        onJoinRoom(finalRoomId);
    };

    const handleCreateClick = (e) => {
        e.preventDefault();
        devLog('Creating new room...');
        onCreateRoom();
    };

    // Dynanmic user details or fallback to placeholders
    const avatarUrl = profile?.photoURL || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBO5nH7RMYvhn6ukgr5P1NOV64_eoquerCK0kxpKPUhKitoDHeD8SCY1RAMcsKGh69rwIZbYAxI0kKc4AGEHaSmKH4FjtWON4t8Rfj9Ug_tedV6qJC3oaPBKDrI3NPEs1eFfT3BUwc-x562O47-D7ueBA9_CLnliDw5T_VMuYrlhRQrAvULjWyFGQ45Yy6hMfV4b59b7gC4-X9TNPRr8T3hy5Exnvx3uOKXZ9kh8T1N3cmJA1cDuNZTQ96Gxk8rIhe2Z5wuo_o1Tes';
    const displayName = profile?.displayName || 'Guest';

    return (
        <div className="flex-grow flex flex-col items-center justify-center pt-[120px] pb-margin-desktop px-margin-mobile md:px-margin-desktop relative z-10 w-full max-w-container-max mx-auto animate-page-fade">
            {/* Global Background Elements */}
            <div className="fixed inset-0 z-[-2] pointer-events-none">
                <img 
                    alt="High-fidelity cinematic theater interior" 
                    className="w-full h-full object-cover opacity-30" 
                    src="https://lh3.googleusercontent.com/aida/AP1WRLsMUMqeL2vUN1_OXonKcIzO1v_ffmK9svlVEXqle0WUvIVLyyhj01pcpNsJQu2L8O37llcZ8qJjpCqHolIlXo_uhl2ptlwmTruWk1MVjztd7uYhxuLYmI3rpEnY7FGHzz5uiCIS0a_gyNUPTnJKljdvBe9M1MXSvZiFRc8B-oRF7fqcPNZU2LyLvUES12fBgEaV-ZyrRv2Fpl4DO_wSlW1soaIqg6IwOlYRj20Sq7TVq7a4cLWjhZTb8x4"
                />
            </div>
            <div className="fixed inset-0 z-[-1] pointer-events-none">
                <img 
                    alt="Abstract purple and blue light streaks" 
                    className="w-full h-full object-cover mix-blend-screen opacity-50" 
                    src="https://lh3.googleusercontent.com/aida/AP1WRLssTbIAoGIRWVyNqCsq60DvgddaImzr66kXUgFF1-P5qNG8HWePA0RpoiyBLULJve47L3f7s6pbz6M_REH7N9QawJo3JhYHZP9pwSPVkdYPAXSDXVoc-tqbbSKQvKUiyBg1uBWMwYlgduVhVt3qkE9r8y8oNM4-4ejNRviZUZsoIC1IFifaybWvVrRDj1yo7dIfOLZwBlSjL5Zvu7p1gvzsU2j5N4JoXlgR4OzGRDAvFqFjmPulo-SuoFU"
                />
                <div className="absolute inset-0 bg-gradient-cinematic"></div>
            </div>

            {/* Hero Header */}
            <div className="text-center mb-8 max-w-3xl mx-auto opacity-0 animate-[pageFadeIn_1s_ease-out_0.2s_forwards]">
                <h1 className="font-display-lg text-display-lg text-on-surface mb-3 text-glow">
                    Watch Together. <span className="text-primary">Anywhere.</span>
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
                    Create a private watch party or join friends instantly with synchronized playback, video chat, and live reactions.
                </p>
            </div>

            {/* Main Interaction Card Wrapper */}
            <div className="w-full max-w-md mx-auto mb-10 relative animate-fade-in-up-slide">
                {/* Ambient Glow */}
                <div className="ambient-glow-bg"></div>

                {/* Main Interaction Card */}
                <div 
                    className="glass-panel interactive-glass rounded-xl p-6 md:p-8 relative overflow-hidden animate-breathe z-10"
                    style={{
                        '--mouse-x': coords.x,
                        '--mouse-y': coords.y
                    }}
                >
                    {/* Subtle gradient overlay for extra depth */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>

                    {/* Profile Section */}
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img 
                                    alt="Profile avatar" 
                                    className="w-12 h-12 rounded-full object-cover border-2 border-primary/30" 
                                    src={avatarUrl}
                                />
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4ade80] rounded-full border-2 border-background"></div>
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4ade80] rounded-full pulse-ring pointer-events-none"></div>
                            </div>
                            <div>
                                <div className="font-title-md text-title-md text-on-surface">{displayName}</div>
                                <div className="font-label-md text-[#4ade80] flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">cell_tower</span> Ready
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Join Room Section */}
                    <form className="space-y-4 mb-6 relative z-10" onSubmit={handleJoinSubmit}>
                        <div>
                            <label className="font-label-md text-label-md text-on-surface-variant mb-2 block">
                                Join Existing Room
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">meeting_room</span>
                                <input 
                                    className="w-full bg-surface-container-highest/50 border border-outline-variant rounded-lg py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-300" 
                                    placeholder="Enter Room ID" 
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-gradient-to-r from-primary to-inverse-primary text-on-primary font-title-md text-title-md py-3.5 rounded-lg hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(221,183,255,0.6)] neon-glow transition-all duration-300 flex justify-center items-center gap-2 group cursor-pointer"
                        >
                            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform duration-300">login</span>
                            Join Room
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                        <div className="h-px bg-white/10 flex-grow"></div>
                        <div className="font-label-md text-label-md text-on-surface-variant">OR</div>
                        <div className="h-px bg-white/10 flex-grow"></div>
                    </div>

                    {/* Create Room Section */}
                    <button 
                        onClick={handleCreateClick}
                        className="w-full relative z-10 bg-surface-container-highest/30 border border-primary/30 text-primary font-title-md text-title-md py-3.5 rounded-lg hover:-translate-y-1 hover:bg-primary/10 hover:border-primary/60 hover:shadow-[0_0_15px_rgba(221,183,255,0.3)] transition-all duration-300 flex justify-center items-center gap-2 group cursor-pointer"
                    >
                        <span className="material-symbols-outlined group-hover:rotate-90 transition-transform duration-300">add_circle</span>
                        Create New Room
                    </button>
                </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-container-max relative z-10 opacity-0 animate-[pageFadeIn_1s_ease-out_0.4s_forwards]">
                {/* Feature 1 */}
                <div className="glass-panel rounded-lg p-5 flex flex-col items-start gap-3 transition-all duration-500 hover:scale-105 hover:border-primary/80 hover:shadow-[0_8px_30px_rgba(221,183,255,0.15)] group animate-breathe" style={{ animationDelay: '0s' }}>
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                        <span className="material-symbols-outlined text-[24px]">sync</span>
                    </div>
                    <div>
                        <h3 className="font-title-md text-title-md text-on-surface mb-1">Real-Time Sync</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant text-sm">Everyone watches together with perfectly synchronized playback.</p>
                    </div>
                </div>
                {/* Feature 2 */}
                <div className="glass-panel rounded-lg p-5 flex flex-col items-start gap-3 transition-all duration-500 hover:scale-105 hover:border-primary/80 hover:shadow-[0_8px_30px_rgba(221,183,255,0.15)] group animate-breathe" style={{ animationDelay: '0.2s' }}>
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                        <span className="material-symbols-outlined text-[24px]">videocam</span>
                    </div>
                    <div>
                        <h3 className="font-title-md text-title-md text-on-surface mb-1">Video Calling</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant text-sm">See and talk to friends while watching the big screen.</p>
                    </div>
                </div>
                {/* Feature 3 */}
                <div className="glass-panel rounded-lg p-5 flex flex-col items-start gap-3 transition-all duration-500 hover:scale-105 hover:border-primary/80 hover:shadow-[0_8px_30px_rgba(221,183,255,0.15)] group animate-breathe" style={{ animationDelay: '0.4s' }}>
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                        <span className="material-symbols-outlined text-[24px]">add_reaction</span>
                    </div>
                    <div>
                        <h3 className="font-title-md text-title-md text-on-surface mb-1">Live Reactions</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant text-sm">Share emojis and reactions instantly during the movie.</p>
                    </div>
                </div>
                {/* Feature 4 */}
                <div className="glass-panel rounded-lg p-5 flex flex-col items-start gap-3 transition-all duration-500 hover:scale-105 hover:border-primary/80 hover:shadow-[0_8px_30px_rgba(221,183,255,0.15)] group animate-breathe" style={{ animationDelay: '0.6s' }}>
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                        <span className="material-symbols-outlined text-[24px]">lock</span>
                    </div>
                    <div>
                        <h3 className="font-title-md text-title-md text-on-surface mb-1">Private Rooms</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant text-sm">Secure, invite-only environments for your chosen guests.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomJoin;