const DONATE_URL = "https://bondin.io/amulya/support";

export function DonateButton() {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Donate to support PaperZero (opens in a new tab)"
      className="fixed z-50 inline-flex min-h-11 items-center gap-2 rounded-full border border-violet-300 bg-white/95 px-4 py-2.5 text-sm font-bold text-violet-700 shadow-lg shadow-violet-950/15 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-400 hover:bg-violet-50 hover:shadow-xl active:translate-y-0 motion-reduce:transform-none dark:border-violet-700 dark:bg-slate-900/95 dark:text-violet-200 dark:hover:border-violet-500 dark:hover:bg-violet-950"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
        left: "max(1rem, env(safe-area-inset-left))",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-rose-500"
      >
        <path d="M12 21s-7.2-4.35-9.55-8.47C.42 8.97 2.04 4.5 6.17 3.66A5.4 5.4 0 0 1 12 6.18a5.4 5.4 0 0 1 5.83-2.52c4.13.84 5.75 5.31 3.72 8.87C19.2 16.65 12 21 12 21Z" />
      </svg>
      Donate
    </a>
  );
}
