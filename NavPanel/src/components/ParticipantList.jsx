import React from "react";
import "../styles/ParticipantList.css";

const ParticipantList = ({ participants, activeParticipant, localUser, showParticipants }) => {
  const getInitials = (name) => {
    const s = (name || "?").trim();
    return s
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isLocalParticipant = (participant) => {
    if (!localUser || !participant) return false;
    if (localUser.firebaseUid && participant.firebaseUid) {
      return participant.firebaseUid === localUser.firebaseUid;
    }
    return participant.id === localUser.id;
  };

  return (
    <div className={`participants-panel ${showParticipants ? "show" : ""}`}>
      <h3>Participants ({participants.length})</h3>
      <div className="participants-list">
        {participants.filter((p) => p?.id).map((participant) => {
          const label = participant.displayName || participant.username || "Guest";
          const isYou = isLocalParticipant(participant);
          return (
            <div
              key={participant.id}
              className={`participant-item animate-fade-in mb-4 flex items-center gap-4 rounded-[16px] bg-white/[0.03] border border-white/[0.03] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl transition-all duration-300 ease-apple hover:-translate-y-[2px] hover:bg-white/[0.05] hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:border-white/[0.05] ${
                participant.id === activeParticipant ? "active-speaker ring-2 ring-[#4f46e5]/50 bg-[#4f46e5]/[0.05]" : ""
              }`}
            >
              <div className="participant-avatar">
                {participant.photoURL ? (
                  <img
                    src={participant.photoURL}
                    alt=""
                    className="participant-avatar__img w-10 h-10 rounded-full object-cover shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="participant-avatar__initials flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-[0_2px_10px_rgba(0,0,0,0.2)] border border-white/10">{getInitials(label)}</span>
                )}
              </div>
              <div className="participant-info">
                <div className="participant-name flex items-center gap-2">
                  <span className="participant-name__text font-semibold text-zinc-50">{label}</span>
                  {isYou ? <span className="participant-you text-xs font-medium text-[#93c5fd]">You</span> : null}
                  {participant.isHost ? (
                    <span className="host-badge rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-300 border border-amber-500/30 shadow-sm" title="Room host">
                      Host
                    </span>
                  ) : null}
                </div>
                <div className="participant-status">
                  {participant.isAudioMuted && (
                    <span className="status-indicator">
                      <span className="material-symbols-outlined">mic_off</span>
                    </span>
                  )}
                  {participant.isVideoOff && (
                    <span className="status-indicator">
                      <span className="material-symbols-outlined">videocam_off</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParticipantList;
