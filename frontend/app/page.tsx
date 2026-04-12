import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      {/* Hero */}
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 text-sm text-amber-400">
          🏀 2026 NBA Playoffs
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6">
          Predict the{" "}
          <span className="text-amber-400">NBA Postseason</span>
        </h1>

        <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
          Pick every matchup, series length, and Finals game. Compete on a live
          leaderboard as results come in.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-8 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-lg transition-colors"
          >
            Create Account
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3 rounded-lg border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold text-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="mt-20 grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto w-full px-4">
        {[
          {
            icon: "🎯",
            title: "Full Bracket",
            desc: "Pick Play-In, every playoff round, series length, and Finals game-by-game.",
          },
          {
            icon: "📊",
            title: "Live Leaderboard",
            desc: "Scores update automatically as postseason results come in.",
          },
          {
            icon: "⚔️",
            title: "Compare Brackets",
            desc: "See exactly where your picks differ from anyone in your pool.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl bg-slate-800 border border-slate-700 p-6 text-left"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-slate-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Scoring callout */}
      <div className="mt-16 rounded-xl bg-slate-800/50 border border-slate-700 p-8 max-w-2xl mx-auto w-full">
        <h2 className="font-bold text-xl mb-4">How Scoring Works</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { pts: "5 pts", label: "Play-In pick" },
            { pts: "10 pts", label: "Series winner" },
            { pts: "5 pts", label: "Correct # of games" },
            { pts: "5 pts", label: "Each Finals game" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-amber-400 font-black text-xl">{s.pts}</div>
              <div className="text-slate-400 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
