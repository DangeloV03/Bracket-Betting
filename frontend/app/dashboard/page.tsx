"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatDate, isLocked } from "@/lib/utils";
import type { PoolOut } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [pools, setPools] = useState<PoolOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/auth/login");
        return;
      }
      const u = data.session.user;
      setUser({ id: u.id, email: u.email ?? "" });

      // Fetch pools the user belongs to
      const { data: memberData } = await supabase
        .from("pool_members")
        .select("pool_id, role, pools(*)")
        .eq("user_id", u.id);

      if (memberData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPools(memberData.map((m: any) => m.pools).filter(Boolean));
      }
      setLoading(false);
    });
  }, [router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/pools/join-by-code?code=${inviteCode.trim()}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setJoinError(err.detail ?? "Invalid code");
    } else {
      const data = await res.json();
      router.push(`/pool/${data.pool_id}`);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-amber-400">🏀 Bracket Betting</span>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">My Pools</h1>
          <Link
            href="/pool/create"
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors"
          >
            + Create Pool
          </Link>
        </div>

        {pools.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <div className="text-4xl mb-4">🏀</div>
            <p className="mb-2">You haven&apos;t joined any pools yet.</p>
            <p className="text-sm">Create a pool or join with an invite code below.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {pools.map((pool) => (
              <Link
                key={pool.id}
                href={`/pool/${pool.id}`}
                className="rounded-xl bg-slate-800 border border-slate-700 p-6 hover:border-amber-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-bold text-lg">{pool.name}</h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      pool.status === "locked"
                        ? "bg-amber-500/20 text-amber-400"
                        : pool.status === "complete"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {pool.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">Season {pool.season}</p>
                <p className="text-slate-500 text-xs mt-1">
                  Locks: {formatDate(pool.lock_at)}
                </p>
                {isLocked(pool.lock_at) && (
                  <p className="text-amber-400 text-xs mt-1 font-medium">🔒 Bracket locked</p>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Join by code */}
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
          <h2 className="font-semibold mb-4">Join a Pool</h2>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              className="flex-1 rounded-lg bg-slate-900 border border-slate-600 px-4 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm transition-colors"
            >
              Join
            </button>
          </form>
          {joinError && (
            <p className="text-red-400 text-sm mt-2">{joinError}</p>
          )}
        </div>
      </main>
    </div>
  );
}
