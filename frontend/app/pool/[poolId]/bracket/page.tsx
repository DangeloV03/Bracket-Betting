"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type BracketPick, type BracketTemplate, type FinalsGamePick } from "@/lib/api";
import { isLocked, ROUND_LABELS } from "@/lib/utils";
import { MatchupCard } from "@/components/bracket/MatchupCard";
import { FinalsCard } from "@/components/bracket/FinalsCard";
import { createClient } from "@/lib/supabase";

const ROUND_ORDER = [
  "playin",
  "first_round",
  "semifinals",
  "conference_finals",
  "finals",
] as const;

export default function BracketPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const router = useRouter();

  const [template, setTemplate] = useState<BracketTemplate | null>(null);
  const [picks, setPicks] = useState<Record<string, BracketPick>>({});
  const [finalsGamePicks, setFinalsGamePicks] = useState<Record<number, FinalsGamePick>>({});
  const [submitted, setSubmitted] = useState(false);
  const [lockAt, setLockAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/auth/login");
        return;
      }

      const [tmpl, pool, bracket] = await Promise.all([
        api.brackets.template(poolId),
        api.pools.get(poolId),
        api.brackets.mine(poolId),
      ]);

      setTemplate(tmpl);
      setLockAt(pool.lock_at);
      setSubmitted(bracket.is_submitted);

      // Hydrate existing picks
      const pickMap: Record<string, BracketPick> = {};
      for (const p of bracket.picks) {
        pickMap[p.matchup_id] = p;
      }
      setPicks(pickMap);

      const fgMap: Record<number, FinalsGamePick> = {};
      for (const fp of bracket.finals_picks) {
        fgMap[fp.game_number] = fp;
      }
      setFinalsGamePicks(fgMap);
      setLoading(false);
    });
  }, [poolId, router]);

  const locked = lockAt ? isLocked(lockAt) : false;
  const readOnly = submitted || locked;

  const autoSave = useCallback(
    (
      nextPicks: Record<string, BracketPick>,
      nextFinals: Record<number, FinalsGamePick>
    ) => {
      if (readOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await api.brackets.save(poolId, {
            picks: Object.values(nextPicks),
            finals_picks: Object.values(nextFinals),
          });
        } catch {
          // Silent fail — user can manually save
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [poolId, readOnly]
  );

  function handlePick(matchupId: string, winnerId: string, seriesLength: number | null) {
    if (readOnly) return;
    const next = {
      ...picks,
      [matchupId]: {
        matchup_id: matchupId,
        picked_winner_team_id: winnerId,
        picked_series_length: seriesLength,
      },
    };
    setPicks(next);
    autoSave(next, finalsGamePicks);
  }

  function handleFinalsGamePick(gameNumber: number, winnerId: string) {
    if (readOnly) return;
    const next = {
      ...finalsGamePicks,
      [gameNumber]: {
        game_number: gameNumber,
        picked_winner_team_id: winnerId,
      },
    };
    setFinalsGamePicks(next);
    autoSave(picks, next);
  }

  async function handleSubmit() {
    setSubmitError("");
    try {
      await api.brackets.submit(poolId);
      setSubmitted(true);
      setShowSubmitConfirm(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    }
  }

  if (loading || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading bracket…</div>
      </div>
    );
  }

  const matchupsByRound = ROUND_ORDER.reduce(
    (acc, round) => {
      acc[round] = template.matchups.filter((m) => m.round_type === round);
      return acc;
    },
    {} as Record<string, typeof template.matchups>
  );

  const finalsMatchup = matchupsByRound["finals"]?.[0];
  const totalPicks = template.matchups.filter((m) => m.round_type !== "finals").length;
  const completedPicks = Object.keys(picks).filter(
    (mid) =>
      picks[mid].picked_winner_team_id &&
      template.matchups.find((m) => m.id === mid)?.round_type !== "finals"
  ).length;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/pool/${poolId}`}
            className="text-slate-400 hover:text-white text-sm"
          >
            ← Pool
          </Link>
          <span className="text-slate-600">/</span>
          <span className="font-semibold text-sm">My Bracket</span>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-slate-500 text-xs">Saving…</span>}
          {!readOnly && (
            <span className="text-slate-500 text-xs">
              {completedPicks}/{totalPicks} picks
            </span>
          )}
          {submitted ? (
            <span className="text-green-400 text-xs font-medium px-3 py-1 rounded-full bg-green-400/10 border border-green-400/30">
              ✓ Submitted
            </span>
          ) : locked ? (
            <span className="text-amber-400 text-xs font-medium">🔒 Locked</span>
          ) : (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors"
            >
              Submit
            </button>
          )}
        </div>
      </nav>

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <h2 className="font-bold text-xl mb-2">Submit Bracket?</h2>
            <p className="text-slate-400 text-sm mb-6">
              Once submitted, your bracket cannot be edited. Make sure all your
              picks are finalized.
            </p>
            <div className="text-slate-300 text-sm mb-6">
              <strong>{completedPicks}</strong> of <strong>{totalPicks}</strong> series picks complete.
            </div>
            {submitError && (
              <div className="text-red-400 text-sm mb-4">{submitError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors"
              >
                Submit Bracket
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        {readOnly && (
          <div className="mb-6 rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-slate-400">
            {submitted
              ? "Your bracket has been submitted and is locked."
              : "The bracket deadline has passed."}
          </div>
        )}

        {/* Play-In */}
        {matchupsByRound["playin"].length > 0 && (
          <Section title="Play-In Tournament">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs text-slate-500 mb-3 uppercase tracking-wider">East</h4>
                <div className="space-y-3">
                  {matchupsByRound["playin"]
                    .filter((m) => m.conference === "east")
                    .map((m) => (
                      <MatchupCard
                        key={m.id}
                        matchup={m}
                        teams={template.teams}
                        pick={picks[m.id]}
                        onPick={handlePick}
                        readonly={readOnly}
                        showResult={locked}
                      />
                    ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs text-slate-500 mb-3 uppercase tracking-wider">West</h4>
                <div className="space-y-3">
                  {matchupsByRound["playin"]
                    .filter((m) => m.conference === "west")
                    .map((m) => (
                      <MatchupCard
                        key={m.id}
                        matchup={m}
                        teams={template.teams}
                        pick={picks[m.id]}
                        onPick={handlePick}
                        readonly={readOnly}
                        showResult={locked}
                      />
                    ))}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* First Round */}
        {(["first_round", "semifinals", "conference_finals"] as const).map((round) =>
          matchupsByRound[round]?.length > 0 ? (
            <Section key={round} title={ROUND_LABELS[round]}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs text-slate-500 mb-3 uppercase tracking-wider">East</h4>
                  <div className="space-y-3">
                    {matchupsByRound[round]
                      .filter((m) => m.conference === "east")
                      .map((m) => (
                        <MatchupCard
                          key={m.id}
                          matchup={m}
                          teams={template.teams}
                          pick={picks[m.id]}
                          onPick={handlePick}
                          readonly={readOnly}
                          showResult={locked}
                        />
                      ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs text-slate-500 mb-3 uppercase tracking-wider">West</h4>
                  <div className="space-y-3">
                    {matchupsByRound[round]
                      .filter((m) => m.conference === "west")
                      .map((m) => (
                        <MatchupCard
                          key={m.id}
                          matchup={m}
                          teams={template.teams}
                          pick={picks[m.id]}
                          onPick={handlePick}
                          readonly={readOnly}
                          showResult={locked}
                        />
                      ))}
                  </div>
                </div>
              </div>
            </Section>
          ) : null
        )}

        {/* Finals */}
        <Section title="NBA Finals">
          <div className="max-w-md mx-auto">
            <FinalsCard
              matchup={finalsMatchup}
              teams={template.teams}
              seriesPick={finalsMatchup ? picks[finalsMatchup.id] : undefined}
              gamePicks={Object.values(finalsGamePicks)}
              onSeriesPick={handlePick}
              onGamePick={handleFinalsGamePick}
              readonly={readOnly}
              showResult={locked}
            />
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-bold mb-4 text-amber-400">{title}</h2>
      {children}
    </div>
  );
}
