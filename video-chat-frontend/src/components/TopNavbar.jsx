/**
 * Cinematic top bar: branding, load file, paste URL, sample.
 * Presentational only — handlers come from Room.
 */
export default function TopNavbar({
  roomId,
  fileInputId,
  pasteUrl,
  onPasteChange,
  onFileChange,
  onLoadUrl,
  onSample,
  isHost = true,
}) {
  const guest = !isHost;

  return (
    <header
      className={`relative shrink-0 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.06)_inset,0_0_0_1px_rgba(0,0,0,0.2)_inset] backdrop-blur-2xl backdrop-saturate-150 transition-opacity duration-300 md:px-6 md:py-4 ${
        guest ? 'top-navbar--guest opacity-[0.88]' : ''
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-blue-500/[0.04]"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-3.5">
          <div className="min-w-0">
            <h1 className="bg-gradient-to-br from-white via-zinc-100 to-zinc-500 bg-clip-text text-lg font-bold tracking-[-0.03em] text-transparent drop-shadow-sm md:text-[1.35rem]">
              CineSync
            </h1>
            <p className="mt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500/90">
              Watch Party
            </p>
          </div>
          {roomId ? (
            <span className="max-w-[200px] truncate rounded-lg border border-white/[0.12] bg-black/25 px-2.5 py-1.5 font-mono text-[11px] leading-none text-zinc-300 shadow-inner backdrop-blur-sm transition-colors duration-300 hover:border-white/20">
              {roomId}
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex min-w-0 flex-[1_1_280px] flex-wrap items-center justify-end gap-2.5 md:flex-[1_1_420px]">
          {guest ? (
            <p className="m-0 max-w-[320px] text-right text-[11px] font-medium leading-snug text-amber-200/90 md:text-xs">
              Only the host can change the video. Playback stays synced from the host.
            </p>
          ) : null}
          <input
            type="file"
            id={fileInputId}
            className="sr-only"
            accept="video/*"
            onChange={onFileChange}
            disabled={guest}
          />
          <label
            htmlFor={fileInputId}
            aria-disabled={guest}
            className={`inline-flex items-center justify-center rounded-xl border border-blue-400/40 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 px-4 py-2.5 text-xs font-semibold tracking-wide text-white shadow-[0_4px_20px_rgba(37,99,235,0.45),0_1px_0_rgba(255,255,255,0.15)_inset] transition-all duration-300 ease-out md:text-sm ${
              guest
                ? 'pointer-events-none cursor-not-allowed opacity-40'
                : 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-300/50 hover:shadow-[0_8px_28px_rgba(37,99,235,0.55)] active:translate-y-0 active:scale-[0.98]'
            }`}
          >
            Load video
          </label>

          <div className="flex min-w-0 flex-[1_1_220px] flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={pasteUrl}
              onChange={(e) => onPasteChange(e.target.value)}
              placeholder="Paste video URL (https://…)"
              disabled={guest}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !guest) onLoadUrl();
              }}
              className="min-w-[140px] flex-1 rounded-xl border border-white/[0.12] bg-black/20 px-3.5 py-2.5 text-xs text-zinc-100 shadow-inner placeholder:text-zinc-500 outline-none ring-0 backdrop-blur-md transition-all duration-300 focus:border-blue-400/40 focus:bg-black/30 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] disabled:cursor-not-allowed disabled:opacity-40 md:text-sm"
            />
            <button
              type="button"
              onClick={onLoadUrl}
              disabled={guest}
              className="shrink-0 rounded-xl border border-white/[0.14] bg-white/[0.06] px-3.5 py-2.5 text-xs font-semibold tracking-wide text-zinc-100 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.12] hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-40 md:text-sm"
            >
              Load URL
            </button>
            <button
              type="button"
              onClick={onSample}
              disabled={guest}
              className="shrink-0 rounded-xl border border-white/[0.14] bg-white/[0.06] px-3.5 py-2.5 text-xs font-semibold tracking-wide text-zinc-100 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.12] hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-40 md:text-sm"
            >
              Sample
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
