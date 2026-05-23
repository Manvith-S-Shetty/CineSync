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
              className={`participant-item ${
                participant.id === activeParticipant ? "active-speaker" : ""
              }`}
            >
              <div className="participant-avatar">
                {participant.photoURL ? (
                  <img
                    src={participant.photoURL}
                    alt=""
                    className="participant-avatar__img"
                    width={32}
                    height={32}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="participant-avatar__initials">{getInitials(label)}</span>
                )}
              </div>
              <div className="participant-info">
                <div className="participant-name">
                  <span className="participant-name__text">{label}</span>
                  {isYou ? <span className="participant-you">You</span> : null}
                  {participant.isHost ? (
                    <span className="host-badge" title="Room host">
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
