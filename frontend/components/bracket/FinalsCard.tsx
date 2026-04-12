"use client";

import { cn } from "@/lib/utils";
import type { Matchup, Team, BracketPick, FinalsGamePick } from "@/lib/api";

interface FinalsCardProps {
  matchup: Matchup | undefined;
  teams: Record<string, Team>;
  seriesPick: BracketPick | undefined;
  gamePicks: FinalsGamePick[];
  onSeriesPick: (matchupId: string, winnerId: string, seriesLength: number | null) => void;
  onGamePick: (gameNumber: number, winnerId: string) => void;
  readonly?: boolean;
  showResult?: boolean;
}

const SERIES_OPTIONS = [4, 5, 6, 7];

export function FinalsCard({
  matchup,
  teams,
  seriesPick,
  gamePicks,
  onSeriesPick,
  onGamePick,
  readonly = false,
  showResult = false,
}: FinalsCardProps) {
  if (!matchup) {
    return (
      <div className="rounded-xl bg-slate-800 border border-slate-700 border-dashed p-6 text-center text-slate-600">
        Finals teams TBD
      </div>
    );
  }

  const teamA = matchup.higher_seed_team_id ? teams[matchup.higher_seed_team_id] : null;
  const teamB = matchup.lower_seed_team_id ? teams[matchup.lower_seed_team_id] : null;

  const seriesPickedLength = seriesPick?.picked_series_length ?? null;
  const gamePickMap = Object.fromEntries(gamePicks.map((g) => [g.game_number, g]));

  const gameCount = seriesPickedLength ?? 7;

  function TeamButton({
    team,
    gameNum,
    isSeries,
  }: {
    team: Team | null;
    gameNum?: number;
    isSeries?: boolean;
  }) {
    if (!team)
      return (
        <div className="flex-1 py-2 rounded-lg bg-slate-700/30 text-center text-slate-500 text-xs">
          TBD
        </div>
      );

    const isSeriesPicked = isSeries && seriesPick?.picked_winner_team_id === team.id;
    const isGamePicked = !isSeries && gameNum !== undefined && gamePickMap[gameNum]?.picked_winner_team_id === team.id;
    const isPicked = isSeries ? isSeriesPicked : isGamePicked;

    function handleClick() {
      if (readonly) return;
      if (isSeries && matchup) {
        onSeriesPick(matchup.id, team!.id, seriesPickedLength);
      } else if (gameNum !== undefined) {
        onGamePick(gameNum, team!.id);
      }
    }

    return (
      <button
        onClick={handleClick}
        disabled={readonly}
        className={cn(
          "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
          readonly ? "cursor-default" : "cursor-pointer",
          isPicked
            ? "bg-amber-500 text-slate-900"
            : "bg-slate-700 hover:bg-slate-600 text-slate-300"
        )}
      >
        {team.abbreviation}
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800 border border-amber-500/30 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-amber-400">🏆 NBA Finals</h3>
        {showResult && matchup.winner_team_id && (
          <span className="text-xs text-green-400 font-medium">
            {teams[matchup.winner_team_id]?.abbreviation} wins in {matchup.series_length}
          </span>
        )}
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-2">Pick the Finals winner</div>
        <div className="flex gap-2">
          <TeamButton team={teamA} isSeries />
          <TeamButton team={teamB} isSeries />
        </div>

        {seriesPick?.picked_winner_team_id && (
          <div className="mt-3">
            <div className="text-xs text-slate-500 mb-1.5">Series length</div>
            <div className="flex gap-1.5">
              {SERIES_OPTIONS.map((n) => (
                <button
                  key={n}
                  disabled={readonly}
                  onClick={() => {
                    if (!readonly && matchup && seriesPick?.picked_winner_team_id) {
                      onSeriesPick(matchup.id, seriesPick.picked_winner_team_id, n);
                    }
                  }}
                  className={cn(
                    "flex-1 py-1 rounded text-sm font-medium transition-colors",
                    seriesPickedLength === n
                      ? "bg-amber-500 text-slate-900"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-300",
                    readonly && "cursor-default"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Game-by-game picks */}
      {(teamA || teamB) && (
        <div>
          <div className="text-xs text-slate-500 mb-2">Game-by-game picks</div>
          <div className="space-y-2">
            {Array.from({ length: gameCount }, (_, i) => i + 1).map((gn) => {
              const gp = gamePickMap[gn];
              return (
                <div key={gn} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-12 shrink-0">Game {gn}</span>
                  <div className="flex gap-2 flex-1">
                    <TeamButton team={teamA} gameNum={gn} />
                    <TeamButton team={teamB} gameNum={gn} />
                  </div>
                  {showResult && (() => {
                    // check actual result for this game
                    return null; // requires game data from API
                  })()}
                  {!readonly && !gp?.picked_winner_team_id && (
                    <span className="text-slate-600 text-xs">pick</span>
                  )}
                </div>
              );
            })}
          </div>
          {!readonly && seriesPickedLength && (
            <p className="text-slate-600 text-xs mt-2">
              Showing {gameCount} games (based on your series length pick).
              You can still pick all 7 if you change your mind.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
