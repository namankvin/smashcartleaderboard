"use client";

import React, { useState } from "react";
import { ActivePlayer, QueueItem, WithdrawnRecord } from "@/lib/types";
import { StopwatchCard } from "./StopwatchCard";
import {
  Play,
  Square,
  RotateCcw,
  Trophy,
  Crosshair,
  ShieldAlert,
  UserX,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { soundFx } from "@/lib/sound";

interface PlayingArenaProps {
  activePlayers: ActivePlayer[];
  roundNumber: number;
  waitingQueue: QueueItem[];
  withdrawnList: WithdrawnRecord[];
  onMasterAction: (action: "start_all" | "stop_all" | "reset_all") => Promise<void>;
  onIndividualAction: (
    slot: number,
    action: "start" | "stop" | "reset" | "penalty" | "disqualify",
    extra?: { penalty?: number }
  ) => Promise<void>;
  onFinishRound: () => Promise<void>;
  onVacateSlot: (
    slot: number,
    options: { reason: string; barFromNextRound: boolean; sendToQueue: boolean }
  ) => Promise<void>;
  onAssignSlot: (slot: number, rollNo: string) => Promise<void>;
  onEditSlot: (
    slot: number,
    data: { name: string; teamName: string; rollNo: string; department?: string }
  ) => Promise<void>;
  onUnbarContestant: (rollNo: string) => Promise<void>;
}

export const PlayingArena: React.FC<PlayingArenaProps> = ({
  activePlayers,
  roundNumber,
  waitingQueue,
  withdrawnList,
  onMasterAction,
  onIndividualAction,
  onFinishRound,
  onVacateSlot,
  onAssignSlot,
  onEditSlot,
  onUnbarContestant,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const activeNonVacant = activePlayers.filter((p) => !p.isVacant);
  const anyRunning = activeNonVacant.some((p) => p.isRunning);
  const allFinishedOrStopped =
    activeNonVacant.length > 0 &&
    activeNonVacant.every(
      (p) =>
        p.status === "finished" ||
        p.status === "disqualified" ||
        (!p.isRunning && p.accumulatedMs > 0)
    );

  const handleMasterStart = async () => {
    soundFx.playStartBuzzer();
    await onMasterAction("start_all");
  };

  const handleMasterStop = async () => {
    soundFx.playStopChime();
    await onMasterAction("stop_all");
  };

  const handleMasterReset = async () => {
    soundFx.playBlip();
    await onMasterAction("reset_all");
  };

  const handleFinishRound = async () => {
    setSubmitting(true);
    soundFx.playVictoryFanfare();
    try {
      await onFinishRound();
    } finally {
      setSubmitting(false);
    }
  };

  // Ensure always 3 slots for visual matrix
  const displaySlots: ActivePlayer[] = [1, 2, 3].map((slotNum) => {
    const found = activePlayers.find((p) => p.slot === slotNum);
    return (
      found || {
        slot: slotNum,
        rollNo: "",
        name: "Vacant Slot",
        teamName: "Standby",
        department: "",
        startTime: null,
        stopTime: null,
        accumulatedMs: 0,
        isRunning: false,
        status: "vacant",
        isVacant: true,
      }
    );
  });

  return (
    <div className="bg-[#0b1222]/95 rounded-2xl border border-cyan-500/40 p-6 shadow-2xl relative tech-frame">
      
      {/* Arena Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-5 border-b border-cyan-900/50 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 text-cyan-400">
            <Crosshair className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black uppercase tracking-wider text-cyan-300 font-mono">
                ARENA COMBAT ZONE // 3-ROBOT ACTIVE SLOTS
              </h2>
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-bold">
                Round #{roundNumber}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {activeNonVacant.length} / 3 Seated
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Individual & Master Stopwatch Controls • Seat Vacating & Swapping Supported
            </p>
          </div>
        </div>

        {/* Master Stopwatches Controls Bar */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Master Start All */}
          <button
            onClick={handleMasterStart}
            disabled={activeNonVacant.length === 0 || anyRunning}
            className="px-4 py-2.5 rounded-lg font-mono text-xs font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 flex items-center gap-2 shadow-green-glow transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>START ALL TIMERS</span>
          </button>

          {/* Master Stop All */}
          <button
            onClick={handleMasterStop}
            disabled={activeNonVacant.length === 0 || !anyRunning}
            className="px-4 py-2.5 rounded-lg font-mono text-xs font-black uppercase tracking-wider bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 flex items-center gap-2 shadow-rose-glow transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>STOP ALL TIMERS</span>
          </button>

          {/* Master Reset All */}
          <button
            onClick={handleMasterReset}
            disabled={activeNonVacant.length === 0}
            className="px-3 py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-300 disabled:text-slate-700 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET ALL</span>
          </button>

          {/* Finish & Record Round */}
          {activeNonVacant.length > 0 && (
            <button
              onClick={handleFinishRound}
              disabled={submitting}
              className={`px-4 py-2.5 rounded-lg font-mono text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                allFinishedOrStopped
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-amber-glow animate-pulse"
                  : "bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40"
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>{submitting ? "RECORDING..." : "SAVE & END ROUND"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Robot Slots Grid (Always 3 fixed slots) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {displaySlots.map((player) => (
          <StopwatchCard
            key={player.slot}
            player={player}
            waitingQueue={waitingQueue}
            onIndividualAction={onIndividualAction}
            onVacateSlot={onVacateSlot}
            onAssignSlot={onAssignSlot}
            onEditSlot={onEditSlot}
          />
        ))}
      </div>

      {/* Barred Contestants Banner (Changed mind / left arena) */}
      {withdrawnList && withdrawnList.length > 0 && (
        <div className="mt-5 p-3.5 rounded-xl bg-[#170a0e] border border-rose-500/50 text-xs font-mono">
          <div className="flex items-center justify-between mb-2">
            <span className="text-rose-300 font-bold uppercase flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Withdrawn Contestants (Changed Mind - Barred from Next Round)
            </span>
            <span className="text-[10px] text-slate-400">
              Organizer Ineligibility List
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {withdrawnList.map((w) => (
              <div
                key={w.rollNo}
                className="p-2 rounded bg-rose-950/40 border border-rose-500/30 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-rose-200">{w.name}</span>
                    <span className="text-[10px] text-rose-300 font-mono px-1 rounded bg-black/40">
                      {w.rollNo}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Left Lane #{w.slot} • Round #{w.roundNumber}
                  </span>
                </div>
                <button
                  onClick={() => onUnbarContestant(w.rollNo)}
                  title="Remove ban and allow to play"
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 cursor-pointer"
                >
                  Unbar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
