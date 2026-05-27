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
      className={`animate-fade-in-down relative shrink-0 overflow-hidden rounded-[24px] border border-white/[0.04] bg-white/[0.03] px-6 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-[40px] backdrop-saturate-150 transition-all duration-300 ease-apple mx-2 mt-2 md:mx-4 md:mt-4 md:px-8 md:py-5 ${
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
            <h1 className="bg-gradient-to-br from-white via-zinc-100 to-zinc-500 bg-clip-text text-3xl font-bold tracking-[-0.03em] text-transparent drop-shadow-sm md:text-4xl">
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
          <p className="m-0 max-w-[320px] text-right text-[11px] font-medium leading-snug text-amber-200/90 md:text-xs">
            Everyone can load the same video. Playback stays synced with the host.
          </p>
          <input
            type="file"
            id={fileInputId}
            className="sr-only"
            accept="video/*"
            onChange={onFileChange}
            disabled={false}
          />
          <label
            htmlFor={fileInputId}
            aria-disabled={false}
            className="inline-flex items-center justify-center rounded-[14px] border border-[#4f46e5]/40 bg-gradient-to-br from-[#2563eb] to-[#4f46e5] px-5 py-2.5 text-xs font-semibold tracking-wide text-white shadow-[0_8px_30px_rgba(37,99,235,0.4),0_1px_0_rgba(255,255,255,0.2)_inset] transition-all duration-300 ease-apple md:text-sm cursor-pointer hover:-translate-y-[2px] hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(37,99,235,0.7)] active:translate-y-0 active:scale-[0.98]"
          >
            Load video
          </label>

          <div className="flex min-w-0 flex-[1_1_220px] flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={pasteUrl}
              onChange={(e) => onPasteChange(e.target.value)}
              placeholder="Paste video URL (https://…)"
              disabled={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onLoadUrl();
              }}
              className="min-w-[140px] flex-1 rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-2.5 text-xs text-zinc-100 shadow-inner placeholder:text-zinc-500 outline-none ring-0 backdrop-blur-md transition-all duration-300 ease-apple focus:border-[#4f46e5]/60 focus:bg-black/30 focus:ring-2 focus:ring-[#2563eb]/50 disabled:cursor-not-allowed disabled:opacity-40 md:text-sm"
            />
            <button
              type="button"
              onClick={onLoadUrl}
              disabled={false}
              className="shrink-0 rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold tracking-wide text-zinc-100 shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md transition-all duration-300 ease-apple hover:-translate-y-[2px] hover:scale-[1.02] hover:border-white/[0.15] hover:bg-white/[0.08] hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 md:text-sm"
            >
              Load URL
            </button>
            <button
              type="button"
              onClick={onSample}
              disabled={false}
              className="shrink-0 rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold tracking-wide text-zinc-100 shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md transition-all duration-300 ease-apple hover:-translate-y-[2px] hover:scale-[1.02] hover:border-white/[0.15] hover:bg-white/[0.08] hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 md:text-sm"
            >
              Sample
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
