export default function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-10 shadow-xs">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white font-bold text-lg">
            h
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              humix
            </span>
            <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Comment Intelligence
            </span>
          </div>
        </div>
        <p className="text-xs font-medium text-slate-500 hidden sm:block">
          Anti-Slop &bull; No Topic Hijacking &bull; SKIP Capable
        </p>
      </div>
    </header>
  );
}
