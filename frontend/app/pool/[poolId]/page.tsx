"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type PoolOut } from "@/lib/api";
import { formatDate, isLocked } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

export default function PoolDashboardPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const router = useRouter();
  const [pool, setPool] = useState<PoolOut | null>(null);
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
        const p = await api.pools.get(poolId);
        setPool(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pool");
      }
      setLoading(false);
    });
  }, [poolId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading pool…</div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">{error || "Pool not found"}</div>
      </div>
    );
  }

  const locked = isLocked(pool.lock_at);
  const isAdmin = pool.created_by === currentUserId;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">
            ← Dashboard
          </Link>
          <span className="text-slate-600">/</span>
          <span className="font-semibold">{pool.name}</span>
        </div>
        {isAdmin && (
          <Link
            href={`/pool/${poolId}/admin`}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Admin
          </Link>
        )}
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Pool header */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">{pool.name}</h1>
              <p className="text-slate-400 text-sm">Season {pool.season}</p>
            </div>
            <div className="text-right">
              {locked ? (
                <div className="text-amber-400 font-medium">🔒 Bracket Locked</div>
              ) : (
                <div>
                  <div className="text-slate-400 text-xs">Locks</div>
                  <div className="text-sm font-medium">{formatDate(pool.lock_at)}</div>
                </div>
              )}
            </div>
          </div>

          {!locked && (
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3">
              <p className="text-amber-400 text-sm font-medium">
                Brackets are open. Submit yours before the deadline!
              </p>
              <p className="text-amber-300/70 text-xs mt-0.5">
                Invite code: <code className="font-mono font-bold">{pool.invite_code}</code>
              </p>
            </div>
          )}
        </div>

        {/* Action cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href={`/pool/${poolId}/bracket`}
            className="rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/50 p-6 transition-colors"
          >
            <div className="text-2xl mb-3">🎯</div>
            <h2 className="font-bold text-lg mb-1">
              {locked ? "View My Bracket" : "My Bracket"}
            </h2>
            <p className="text-slate-400 text-sm">
              {locked
                ? "Your locked bracket"
                : "Fill out your predictions and submit before the deadline"}
            </p>
          </Link>

          <Link
            href={`/pool/${poolId}/leaderboard`}
            className="rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/50 p-6 transition-colors"
          >
            <div className="text-2xl mb-3">📊</div>
            <h2 className="font-bold text-lg mb-1">Leaderboard</h2>
            <p className="text-slate-400 text-sm">
              See how everyone ranks as results come in
            </p>
          </Link>

          {locked && (
            <Link
              href={`/pool/${poolId}/compare`}
              className="rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/50 p-6 transition-colors"
            >
              <div className="text-2xl mb-3">⚔️</div>
              <h2 className="font-bold text-lg mb-1">Compare Brackets</h2>
              <p className="text-slate-400 text-sm">
                See where your picks differ from others
              </p>
            </Link>
          )}
        </div>

        {/* Scoring reference */}
        <div className="mt-8 rounded-xl bg-slate-800/50 border border-slate-700 p-6">
          <h3 className="font-semibold mb-4 text-sm text-slate-400 uppercase tracking-wider">
            Scoring
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { pts: pool.scoring_config_json.playin_correct, label: "Play-In pick" },
              { pts: pool.scoring_config_json.series_winner_correct, label: "Series winner" },
              { pts: pool.scoring_config_json.series_length_correct, label: "Correct # of games" },
              { pts: pool.scoring_config_json.finals_game_correct, label: "Finals game" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-amber-400 font-black text-lg">{s.pts} pts</div>
                <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
