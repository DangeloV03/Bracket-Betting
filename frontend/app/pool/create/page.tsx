"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function CreatePoolPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [season, setSeason] = useState(2026);
  const [lockAt, setLockAt] = useState("2026-04-14T19:00");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const pool = await api.pools.create({
        name,
        season,
        lock_at: new Date(lockAt).toISOString(),
        is_public: isPublic,
        scoring_config: {
          playin_correct: 5,
          series_winner_correct: 10,
          series_length_correct: 5,
          finals_game_correct: 5,
          series_length_requires_winner: true,
        },
      });
      router.push(`/pool/${pool.id}/admin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pool");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-xl mx-auto">
        <Link
          href="/dashboard"
          className="text-slate-400 hover:text-white text-sm mb-6 inline-block"
        >
          ← Back to dashboard
        </Link>

        <h1 className="text-2xl font-bold mb-8">Create Pool</h1>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Pool Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-4 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="Friday Night Bracket"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Season</label>
              <input
                type="number"
                value={season}
                onChange={(e) => setSeason(Number(e.target.value))}
                required
                min={2020}
                max={2030}
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-4 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Lock Date & Time
                <span className="text-slate-400 ml-1">(first Play-In tipoff)</span>
              </label>
              <input
                type="datetime-local"
                value={lockAt}
                onChange={(e) => setLockAt(e.target.value)}
                required
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-4 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-slate-500 text-xs mt-1">
                2026 Play-In starts April 14. Recommended: April 14 at 7:00 PM ET.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <label htmlFor="isPublic" className="text-sm">
                Public pool (anyone can find and join)
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold transition-colors"
            >
              {loading ? "Creating…" : "Create Pool"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
