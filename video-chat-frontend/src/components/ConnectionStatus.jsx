const ConnectionStatus = ({ status, roomId, isHost, reconnecting }) => {
  const label = reconnecting ? 'reconnecting' : status;

  return (
    <div
      className="connection-status"
      data-status={reconnecting ? 'reconnecting' : status}
      role="status"
      aria-live="polite"
    >
      <div className="connection-status__inner">
        <div className="connection-status__left">
          <span className="connection-status__dot" aria-hidden />
          <span className="connection-status__label">{label}</span>
          {reconnecting ? (
            <span className="connection-status__hint">Reconnecting…</span>
          ) : null}
        </div>
        {roomId ? (
          <div className="connection-status__right">
            <span className="connection-status__room">Room {roomId}</span>
            {isHost ? <span className="connection-status__host-badge">Host</span> : null}
            <button
              type="button"
              className="connection-status__share"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Room link copied to clipboard!');
              }}
            >
              Share
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ConnectionStatus;
