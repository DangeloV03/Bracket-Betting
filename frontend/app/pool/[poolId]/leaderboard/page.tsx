"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type LeaderboardEntry } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/auth/login");
        return;
      }
      setCurrentUserId(data.session.user.id);

      try {
        const lb = await api.leaderboard.get(poolId);
        setEntries(lb.entries);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load leaderboard");
      }
      setLoading(false);
    });
  }, [poolId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading leaderboard…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href={`/pool/${poolId}`} className="text-slate-400 hover:text-white text-sm">
          ← Pool
        </Link>
        <span className="text-slate-600">/</span>
        <span className="font-semibold">Leaderboard</span>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="text-red-400 mb-4 text-sm">{error}</div>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <div className="text-4xl mb-4">📊</div>
            <p>No scores yet. Brackets may still be open or no results have been entered.</p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem_4rem_5rem] gap-2 px-4 py-2 text-xs text-slate-500 uppercase tracking-wider mb-2">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Play-In</span>
              <span className="text-right">Series</span>
              <span className="text-right">Length</span>
              <span className="text-right">Finals</span>
              <span className="text-right font-semibold text-slate-400">Total</span>
            </div>

            <div className="space-y-2">
              {entries.map((entry) => {
                const isMe = entry.user_id === currentUserId;
                return (
                  <div
                    key={entry.user_id}
                    className={cn(
                      "grid grid-cols-[2rem_1fr_4rem_4rem_4rem_4rem_5rem] gap-2 items-center rounded-xl px-4 py-3 border transition-colors",
                      isMe
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-slate-800 border-slate-700"
                    )}
                  >
                    <span
                      className={cn(
                        "font-bold text-sm",
                        entry.rank === 1 && "text-amber-400",
                        entry.rank === 2 && "text-slate-300",
                        entry.rank === 3 && "text-amber-600"
                      )}
                    >
                      {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                    </span>

                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {entry.display_name || entry.username}
                        {isMe && (
                          <span className="ml-2 text-xs text-amber-400 font-normal">you</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate">@{entry.username}</div>
                    </div>

                    <span className="text-right text-sm text-slate-400">
                      {entry.playin_points}
                    </span>
                    <span className="text-right text-sm text-slate-400">
                      {entry.series_winner_points}
                    </span>
                    <span className="text-right text-sm text-slate-400">
                      {entry.series_length_points}
                    </span>
                    <span className="text-right text-sm text-slate-400">
                      {entry.finals_game_points}
                    </span>
                    <span className="text-right font-bold text-amber-400">
                      {entry.total_points}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Score legend */}
            <div className="mt-6 text-xs text-slate-600 text-right">
              Play-In · Series Winners · Series Length · Finals Games · Total
            </div>

            {/* Compare link */}
            <div className="mt-8 text-center">
              <Link
                href={`/pool/${poolId}/compare`}
                className="text-amber-400 hover:underline text-sm"
              >
                Compare brackets →
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
