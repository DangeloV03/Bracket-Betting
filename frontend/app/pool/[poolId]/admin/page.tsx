"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type PoolOut } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

type Tab = "seed" | "results" | "tools" | "logs";

export default function AdminPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const router = useRouter();
  const [pool, setPool] = useState<PoolOut | null>(null);
  const [tab, setTab] = useState<Tab>("seed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teams, setTeams] = useState<Record<string, { id: string; abbreviation: string; city: string; name: string; conference: string }>>({});

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/auth/login");
        return;
      }

      try {
        const p = await api.pools.get(poolId);
        setPool(p);

        // Fetch all teams for the seed form
        const { data: teamsData } = await supabase
          .from("teams")
          .select("id, abbreviation, city, name, conference")
          .order("conference")
          .order("name");
        if (teamsData) {
          const map: typeof teams = {};
          for (const t of teamsData) map[t.id] = t;
          setTeams(map);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
      setLoading(false);
    });
  }, [poolId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading admin…</div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        {error || "Not found"}
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
        <span className="font-semibold">Admin Console</span>
        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
          {pool.status}
        </span>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Pool info */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <div className="text-slate-500 text-xs mb-0.5">Pool Name</div>
              <div className="font-semibold">{pool.name}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-0.5">Season</div>
              <div className="font-semibold">{pool.season}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-0.5">Lock Time</div>
              <div className="font-semibold">{formatDate(pool.lock_at)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-0.5">Invite Code</div>
              <div className="font-mono font-bold text-amber-400">{pool.invite_code}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1 w-fit">
          {(["seed", "results", "tools", "logs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "bg-amber-500 text-slate-900"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "seed" && <SeedTab poolId={poolId} teams={teams} />}
        {tab === "results" && <ResultsTab poolId={poolId} pool={pool} teams={teams} />}
        {tab === "tools" && <ToolsTab poolId={poolId} />}
        {tab === "logs" && <LogsTab poolId={poolId} />}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────
// Seed Tab
// ──────────────────────────────────────────────
function SeedTab({
  poolId,
  teams,
}: {
  poolId: string;
  teams: Record<string, { id: string; abbreviation: string; city: string; name: string; conference: string }>;
}) {
  const ROUNDS = [
    { id: "playin", label: "Play-In" },
    { id: "first_round", label: "First Round" },
    { id: "semifinals", label: "Semifinals" },
    { id: "conference_finals", label: "Conf. Finals" },
    { id: "finals", label: "Finals" },
  ];

  const [round, setRound] = useState("playin");
  const [conference, setConference] = useState("east");
  const [slot, setSlot] = useState(1);
  const [higherSeed, setHigherSeed] = useState("");
  const [lowerSeed, setLowerSeed] = useState("");
  const [bestOf, setBestOf] = useState(7);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const teamList = Object.values(teams).filter(
    (t) => round === "finals" || t.conference === conference
  );

  async function handleSeed(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await api.admin.seed(poolId, [
        {
          round_type: round,
          conference: round === "finals" ? "none" : conference,
          matchup_slot: slot,
          higher_seed_team_id: higherSeed || undefined,
          lower_seed_team_id: lowerSeed || undefined,
          best_of: bestOf,
        },
      ]);
      setSuccess("Matchup saved!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  }

  return (
    <div>
      <h2 className="font-bold mb-4">Seed Bracket</h2>
      <p className="text-slate-400 text-sm mb-6">
        Manually set up matchups. Run this for each series in the bracket.
      </p>

      <form onSubmit={handleSeed} className="space-y-4 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Round</label>
            <select
              value={round}
              onChange={(e) => setRound(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            >
              {ROUNDS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {round !== "finals" && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Conference</label>
              <select
                value={conference}
                onChange={(e) => setConference(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="east">East</option>
                <option value="west">West</option>
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Slot #</label>
            <input
              type="number"
              min={1}
              max={8}
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Best of</label>
            <select
              value={bestOf}
              onChange={(e) => setBestOf(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value={5}>5</option>
              <option value={7}>7</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Higher Seed</label>
          <select
            value={higherSeed}
            onChange={(e) => setHigherSeed(e.target.value)}
            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">— Select team —</option>
            {teamList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.abbreviation} — {t.city} {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Lower Seed</label>
          <select
            value={lowerSeed}
            onChange={(e) => setLowerSeed(e.target.value)}
            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">— Select team —</option>
            {teamList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.abbreviation} — {t.city} {t.name}
              </option>
            ))}
          </select>
        </div>

        {success && <div className="text-green-400 text-sm">{success}</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold text-sm transition-colors"
        >
          {saving ? "Saving…" : "Save Matchup"}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────
// Results Tab
// ──────────────────────────────────────────────
function ResultsTab({
  poolId,
  pool,
  teams,
}: {
  poolId: string;
  pool: PoolOut;
  teams: Record<string, { id: string; abbreviation: string; city: string; name: string; conference: string }>;
}) {
  const [matchupId, setMatchupId] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [seriesLength, setSeriesLength] = useState(4);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!matchupId || !winnerId) return;
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await api.admin.enterResults(poolId, {
        matchup_results: [
          {
            matchup_id: matchupId,
            winner_team_id: winnerId,
            series_length: seriesLength,
            status: "complete",
          },
        ],
        game_results: [],
      });
      setSuccess("Result saved!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  }

  return (
    <div>
      <h2 className="font-bold mb-4">Enter Results</h2>
      <p className="text-slate-400 text-sm mb-6">
        Manually record series outcomes. Scores will be recalculated automatically on next request.
      </p>

      <form onSubmit={handleSave} className="space-y-4 max-w-lg">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Matchup ID</label>
          <input
            type="text"
            value={matchupId}
            onChange={(e) => setMatchupId(e.target.value)}
            placeholder="UUID from postseason_matchups"
            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
          />
          <p className="text-slate-600 text-xs mt-1">
            Find matchup IDs in the Supabase dashboard or via the bracket template API.
          </p>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Winner</label>
          <select
            value={winnerId}
            onChange={(e) => setWinnerId(e.target.value)}
            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">— Select team —</option>
            {Object.values(teams).map((t) => (
              <option key={t.id} value={t.id}>
                {t.abbreviation} — {t.city} {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Series Length (games played)</label>
          <select
            value={seriesLength}
            onChange={(e) => setSeriesLength(Number(e.target.value))}
            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
          >
            {[4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} games
              </option>
            ))}
          </select>
        </div>

        {success && <div className="text-green-400 text-sm">{success}</div>}
        {error && <div className="text-red-400 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold text-sm transition-colors"
        >
          {saving ? "Saving…" : "Save Result"}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────
// Tools Tab
// ──────────────────────────────────────────────
function ToolsTab({ poolId }: { poolId: string }) {
  const [recalcResult, setRecalcResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRecalculate() {
    setLoading(true);
    setError("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await api.admin.recalculate(poolId) as any;
      setRecalcResult(`Recalculated ${result.recalculated} brackets.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  }

  return (
    <div>
      <h2 className="font-bold mb-4">Admin Tools</h2>

      <div className="space-y-4 max-w-lg">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <h3 className="font-semibold mb-2">Recalculate All Scores</h3>
          <p className="text-slate-400 text-sm mb-4">
            Recompute every member&apos;s score based on current results. Run this after entering results.
          </p>
          {recalcResult && (
            <div className="text-green-400 text-sm mb-3">{recalcResult}</div>
          )}
          {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
          <button
            onClick={handleRecalculate}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold text-sm transition-colors"
          >
            {loading ? "Recalculating…" : "Recalculate Scores"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Logs Tab
// ──────────────────────────────────────────────
function LogsTab({ poolId }: { poolId: string }) {
  const [overrides, setOverrides] = useState<{ id: string; entity_type: string; created_at: string; after_json: unknown }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await api.admin.overrides(poolId) as { overrides: typeof overrides };
      setOverrides(result.overrides);
    } catch {
      // ignore
    }
    setLoading(false);
    setLoaded(true);
  }

  return (
    <div>
      <h2 className="font-bold mb-4">Override Log</h2>

      {!loaded ? (
        <button
          onClick={load}
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
        >
          {loading ? "Loading…" : "Load Log"}
        </button>
      ) : (
        <div className="space-y-2">
          {overrides.length === 0 ? (
            <p className="text-slate-400 text-sm">No overrides recorded.</p>
          ) : (
            overrides.map((o) => (
              <div
                key={o.id}
                className="rounded-lg bg-slate-800 border border-slate-700 p-4 text-sm"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-amber-400">{o.entity_type}</span>
                  <span className="text-slate-500 text-xs">
                    {formatDate(o.created_at)}
                  </span>
                </div>
                <pre className="text-xs text-slate-400 overflow-auto">
                  {JSON.stringify(o.after_json, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
