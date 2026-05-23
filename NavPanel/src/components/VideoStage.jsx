/**
 * Main watch area: alerts, sync note, cinematic frame around the video slot.
 * Renders {children} (typically VideoPlayer) without touching player logic.
 */
export default function VideoStage({ mediaWarning, children }) {
  return (
    <>
      {mediaWarning ? (
        <div className="room-main__alert status-error shrink-0 rounded-xl border border-red-500/20 px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
          {mediaWarning}
        </div>
      ) : null}
      <p className="room-main__sync">
        Sync uses time only — everyone should load the same file or use the sample so
        playback lines up.
      </p>

      <div className="room-main__stage">
        <div
          className="pointer-events-none absolute inset-0 z-[1] opacity-100"
          style={{
            background: `
              radial-gradient(ellipse 90% 65% at 50% 42%, rgba(55, 65, 85, 0.25) 0%, transparent 58%),
              radial-gradient(ellipse 140% 100% at 50% 100%, rgba(0, 0, 0, 0.85) 0%, transparent 45%),
              linear-gradient(180deg, rgba(15, 18, 28, 0.5) 0%, transparent 22%, transparent 78%, rgba(0, 0, 0, 0.75) 100%),
              linear-gradient(90deg, rgba(0,0,0,0.35) 0%, transparent 12%, transparent 88%, rgba(0,0,0,0.35) 100%)
            `,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-[2] opacity-[0.35]"
          style={{
            background:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
          }}
          aria-hidden
        />
        <div className="room-main__stage-inner">
          {children}
        </div>
      </div>
    </>
  );
}
