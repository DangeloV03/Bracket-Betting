"use client";

import { cn } from "@/lib/utils";
import type { Matchup, Team, BracketPick } from "@/lib/api";

interface MatchupCardProps {
  matchup: Matchup;
  teams: Record<string, Team>;
  pick: BracketPick | undefined;
  onPick: (matchupId: string, winnerId: string, seriesLength: number | null) => void;
  readonly?: boolean;
  showResult?: boolean;
}

const SERIES_OPTIONS = [4, 5, 6, 7];

export function MatchupCard({
  matchup,
  teams,
  pick,
  onPick,
  readonly = false,
  showResult = false,
}: MatchupCardProps) {
  const higher = matchup.higher_seed_team_id ? teams[matchup.higher_seed_team_id] : null;
  const lower = matchup.lower_seed_team_id ? teams[matchup.lower_seed_team_id] : null;

  if (!higher && !lower) {
    return (
      <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 border-dashed p-4 text-center text-slate-600 text-xs">
        TBD
      </div>
    );
  }

  const isPlayIn = matchup.round_type === "playin";
  const isFinals = matchup.round_type === "finals";
  const pickedWinner = pick?.picked_winner_team_id;
  const pickedLength = pick?.picked_series_length;
  const actualWinner = matchup.winner_team_id;

  function pickTeam(teamId: string) {
    if (readonly) return;
    onPick(matchup.id, teamId, isPlayIn ? null : (pickedLength ?? null));
  }

  function pickLength(len: number) {
    if (readonly || !pickedWinner) return;
    onPick(matchup.id, pickedWinner, len);
  }

  function TeamRow({ team }: { team: Team | null }) {
    if (!team) return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/30 text-slate-500 text-sm">
        TBD
      </div>
    );

    const isPicked = pickedWinner === team.id;
    const isActualWinner = showResult && actualWinner === team.id;
    const isWrong = showResult && actualWinner && pickedWinner === team.id && actualWinner !== team.id;
    const isCorrect = showResult && actualWinner && pickedWinner === team.id && actualWinner === team.id;

    return (
      <button
        onClick={() => pickTeam(team.id)}
        disabled={readonly}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all text-left",
          readonly ? "cursor-default" : "cursor-pointer hover:bg-slate-600/50",
          isPicked && !showResult && "bg-amber-500/20 border border-amber-500/50",
          isCorrect && "bg-green-500/20 border border-green-500/50",
          isWrong && "bg-red-500/20 border border-red-500/30",
          isActualWinner && !isPicked && showResult && "bg-slate-700/40",
          !isPicked && !isActualWinner && "bg-slate-700/30",
        )}
      >
        <span className="text-slate-500 text-xs w-4 shrink-0">
          {/* seed indicator placeholder */}
        </span>
        <span className="font-semibold text-amber-300 text-xs mr-1">
          {team.abbreviation}
        </span>
        <span className="truncate">{team.city} {team.name}</span>
        <span className="ml-auto shrink-0">
          {isCorrect && "✅"}
          {isWrong && "❌"}
          {isPicked && !showResult && "◀"}
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 space-y-2">
      <TeamRow team={higher} />
      <div className="text-center text-slate-600 text-xs">vs</div>
      <TeamRow team={lower} />

      {/* Series length picker (non-Play-In only) */}
      {!isPlayIn && !isFinals && pickedWinner && !readonly && (
        <div className="pt-2 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 mb-1.5">Games</div>
          <div className="flex gap-1.5">
            {SERIES_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => pickLength(n)}
                className={cn(
                  "flex-1 py-1 rounded text-sm font-medium transition-colors",
                  pickedLength === n
                    ? "bg-amber-500 text-slate-900"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Read-only series length display */}
      {!isPlayIn && !isFinals && pickedWinner && readonly && pickedLength && (
        <div className="text-xs text-slate-500 pt-1">
          Picked in <span className="text-slate-300 font-medium">{pickedLength}</span>
          {showResult && matchup.series_length && (
            <span className={cn(
              "ml-1",
              pickedLength === matchup.series_length ? "text-green-400" : "text-red-400"
            )}>
              (actual: {matchup.series_length})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
