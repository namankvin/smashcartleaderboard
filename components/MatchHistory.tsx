"use client";

import React from "react";
import Link from "next/link";
import { MatchRound } from "@/lib/types";
import { Trophy, History, Medal, Clock, CheckCircle, ArrowRight } from "lucide-react";

interface MatchHistoryProps {
  history: MatchRound[];
}

export const MatchHistory: React.FC<MatchHistoryProps> = ({ history }) => {
  if (history.length === 0) return null;

  return (
    <div className="bg-[#0d1527]/90 rounded-xl border border-cyan-500/30 p-5 shadow-lg relative tech-frame">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-amber-500/20 text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-300 font-mono">
              ARENA MATCH ARCHIVES
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Completed rounds & verified stop times
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/leaderboard"
            className="px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-amber-glow"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Overall Leaderboard →</span>
          </Link>
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            {history.length} Round(s) Completed
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {history.map((round) => {
          // Sort players by time to determine 1st place winner
          const sortedPlayers = [...round.players].sort((a, b) => {
            if (a.status === "disqualified") return 1;
            if (b.status === "disqualified") return -1;
            return a.timeMs - b.timeMs;
          });

          return (
            <div
              key={round.id}
              className="p-3.5 rounded-lg bg-[#070b16] border border-slate-800/80 hover:border-slate-700 font-mono text-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-cyan-400">ROUND #{round.roundNumber}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(round.completedAt).toLocaleTimeString()}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                {sortedPlayers.map((player, idx) => (
                  <div
                    key={`${round.id}_${player.slot}`}
                    className={`p-2 rounded border flex flex-col justify-between ${
                      idx === 0 && player.status !== "disqualified"
                        ? "bg-amber-950/20 border-amber-500/40 text-amber-200"
                        : "bg-slate-900/60 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold truncate">{player.name}</span>
                      {idx === 0 && player.status !== "disqualified" && (
                        <Medal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {player.rollNo} • Lane #{player.slot}
                    </div>
                    <div className="mt-1 font-mono font-bold text-xs text-right">
                      {player.status === "disqualified" ? (
                        <span className="text-rose-400">DISQUALIFIED</span>
                      ) : (
                        <span className={idx === 0 ? "text-amber-300" : "text-cyan-300"}>
                          {player.timeFormatted}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

