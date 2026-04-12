"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type CompareResponse, type LeaderboardEntry } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { cn, ROUND_LABELS } from "@/lib/utils";

export default function ComparePage() {
  const { poolId } = useParams<{ poolId: string }>();
  const router = useRouter();

  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userA, setUserA] = useState<string>("");
  const [userB, setUserB] = useState<string>("");
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [init, setInit] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/auth/login");
        return;
      }
      const uid = data.session.user.id;
      setCurrentUserId(uid);
      setUserA(uid);

      try {
        const lb = await api.leaderboard.get(poolId);
        setPlayers(lb.entries);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load players");
      }
      setInit(false);
    });
  }, [poolId, router]);

  async function handleCompare() {
    if (!userA || !userB || userA === userB) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.leaderboard.compare(poolId, userA, userB);
      setComparison(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
    }
    setLoading(false);
  }

  function playerName(uid: string) {
    const p = players.find((x) => x.user_id === uid);
    return p?.display_name || p?.username || uid;
  }

  if (init) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  const roundedPicks = comparison?.picks.reduce(
    (acc, p) => {
      if (!acc[p.round_type]) acc[p.round_type] = [];
      acc[p.round_type].push(p);
      return acc;
    },
    {} as Record<string, typeof comparison.picks>
  );

  return (
    <div className="min-h-screen">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href={`/pool/${poolId}/leaderboard`} className="text-slate-400 hover:text-white text-sm">
          ← Leaderboard
        </Link>
        <span className="text-slate-600">/</span>
        <span className="font-semibold">Compare Brackets</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Selector */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
          <h2 className="font-bold mb-4">Select players to compare</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Player A</label>
              <select
                value={userA}
                onChange={(e) => setUserA(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
              >
                <option value="">Select player</option>
                {players.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.display_name || p.username}
                    {p.user_id === currentUserId ? " (you)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Player B</label>
              <select
                value={userB}
                onChange={(e) => setUserB(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500 text-sm"
              >
                <option value="">Select player</option>
                {players
                  .filter((p) => p.user_id !== userA)
                  .map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.display_name || p.username}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={handleCompare}
            disabled={!userA || !userB || userA === userB || loading}
            className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold text-sm transition-colors"
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </div>

        {comparison && roundedPicks && (
          <div className="space-y-8">
            {/* Column headers */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="text-amber-400 font-bold">{playerName(comparison.user_a_id)}</div>
              <div className="text-slate-500 text-xs self-center">MATCHUP</div>
              <div className="text-amber-400 font-bold">{playerName(comparison.user_b_id)}</div>
            </div>

            {Object.entries(roundedPicks).map(([round, picks]) => (
              <div key={round}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {ROUND_LABELS[round] || round}
                </h3>
                <div className="space-y-2">
                  {picks.map((p) => {
                    const nameA = p.user_a_pick ? "Team" : "—";
                    const nameB = p.user_b_pick ? "Team" : "—";

                    return (
                      <div
                        key={p.matchup_id}
                        className="grid grid-cols-3 gap-3 items-center"
                      >
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 text-center text-sm font-medium",
                            p.a_correct
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : p.actual_winner && p.user_a_pick && !p.a_correct
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          )}
                        >
                          {p.user_a_pick ? nameA : "—"}
                        </div>

                        <div className="text-center">
                          {p.picks_match ? (
                            <span className="text-xs text-green-400">match</span>
                          ) : (
                            <span className="text-xs text-slate-600">diff</span>
                          )}
                        </div>

                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 text-center text-sm font-medium",
                            p.b_correct
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : p.actual_winner && p.user_b_pick && !p.b_correct
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          )}
                        >
                          {p.user_b_pick ? nameB : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Finals games */}
            {comparison.finals_picks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Finals Game Picks
                </h3>
                <div className="space-y-2">
                  {comparison.finals_picks.map((fp) => (
                    <div
                      key={fp.game_number}
                      className="grid grid-cols-3 gap-3 items-center text-sm"
                    >
                      <div className="rounded-lg px-3 py-2 text-center bg-slate-800 border border-slate-700 text-slate-300">
                        {fp.user_a_pick ?? "—"}
                      </div>
                      <div className="text-center text-slate-500 text-xs">
                        Game {fp.game_number}
                      </div>
                      <div className="rounded-lg px-3 py-2 text-center bg-slate-800 border border-slate-700 text-slate-300">
                        {fp.user_b_pick ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
