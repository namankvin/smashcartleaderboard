"use client";

import React, { useState, useEffect, useRef } from "react";
import { ActivePlayer, QueueItem } from "@/lib/types";
import {
  Play,
  Square,
  RotateCcw,
  Bot,
  AlertTriangle,
  UserX,
  Edit2,
  UserPlus,
  RefreshCw,
  LogOut,
  Check,
  X,
  Search,
} from "lucide-react";
import { soundFx } from "@/lib/sound";

interface StopwatchCardProps {
  player: ActivePlayer;
  waitingQueue: QueueItem[];
  onIndividualAction: (
    slot: number,
    action: "start" | "stop" | "reset" | "penalty" | "disqualify",
    extra?: { penalty?: number }
  ) => Promise<void>;
  onVacateSlot: (
    slot: number,
    options: { reason: string; barFromNextRound: boolean; sendToQueue: boolean }
  ) => Promise<void>;
  onAssignSlot: (slot: number, rollNo: string) => Promise<void>;
  onEditSlot: (
    slot: number,
    data: { name: string; teamName: string; rollNo: string; department?: string }
  ) => Promise<void>;
}

export const StopwatchCard: React.FC<StopwatchCardProps> = ({
  player,
  waitingQueue,
  onIndividualAction,
  onVacateSlot,
  onAssignSlot,
  onEditSlot,
}) => {
  const [displayTime, setDisplayTime] = useState(0);
  const animRef = useRef<number | null>(null);

  // Vacant fill state
  const [fillRollNo, setFillRollNo] = useState("");
  const [fillSearching, setFillSearching] = useState(false);

  // Edit modal / drawer
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(player.name || "");
  const [editTeam, setEditTeam] = useState(player.teamName || "");
  const [editRoll, setEditRoll] = useState(player.rollNo || "");

  // Leave / Withdraw menu
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

  // High precision timer loop
  useEffect(() => {
    if (player.isVacant) return;

    const updateTime = () => {
      let current = player.accumulatedMs;
      if (player.isRunning && player.startTime) {
        current += Date.now() - player.startTime;
      }
      setDisplayTime(current);

      if (player.isRunning) {
        animRef.current = requestAnimationFrame(updateTime);
      }
    };

    updateTime();

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [player.isRunning, player.startTime, player.accumulatedMs, player.isVacant]);

  // Sync edit state
  useEffect(() => {
    setEditName(player.name || "");
    setEditTeam(player.teamName || "");
    setEditRoll(player.rollNo || "");
  }, [player]);

  const formatTime = (totalMs: number, penaltySec = 0) => {
    const adjusted = Math.max(0, totalMs + penaltySec * 1000);
    const minutes = Math.floor(adjusted / 60000);
    const seconds = Math.floor((adjusted % 60000) / 1000);
    const millis = Math.floor(adjusted % 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
      millis
    ).padStart(3, "0")}`;
  };

  const handleStart = () => {
    soundFx.playBlip();
    onIndividualAction(player.slot, "start");
  };

  const handleStop = () => {
    soundFx.playStopChime();
    onIndividualAction(player.slot, "stop");
  };

  const handleReset = () => {
    soundFx.playBlip();
    onIndividualAction(player.slot, "reset");
  };

  const handleAddPenalty = () => {
    soundFx.playBlip();
    onIndividualAction(player.slot, "penalty", { penalty: 5 });
  };

  const handleDisqualify = () => {
    if (confirm(`Disqualify Lane #${player.slot} (${player.name})?`)) {
      soundFx.playBlip();
      onIndividualAction(player.slot, "disqualify");
    }
  };

  const handleSaveEdit = async () => {
    await onEditSlot(player.slot, {
      name: editName,
      teamName: editTeam,
      rollNo: editRoll,
    });
    setIsEditing(false);
  };

  const handleAssignSubmit = async (targetRoll?: string) => {
    const roll = (targetRoll || fillRollNo).trim();
    if (!roll) return;
    setFillSearching(true);
    soundFx.playEnqueueSound();
    try {
      await onAssignSlot(player.slot, roll);
      setFillRollNo("");
    } finally {
      setFillSearching(false);
    }
  };

  // ------------------ RENDER: VACANT SEAT ------------------
  if (player.isVacant) {
    return (
      <div className="relative rounded-xl border border-dashed border-amber-500/50 bg-[#0c121f]/90 p-5 flex flex-col justify-between min-h-[360px] tech-frame animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-900/40 pb-2.5 mb-3">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-black tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40">
            LANE #{player.slot} [VACANT]
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
            Ready to Seat
          </span>
        </div>

        {/* Center Prompt */}
        <div className="my-auto py-2 space-y-3">
          <div className="text-center">
            <UserPlus className="w-8 h-8 text-amber-400/80 mx-auto mb-1.5 animate-bounce" />
            <p className="font-mono text-xs font-bold text-slate-200 uppercase">
              SEAT VACANT // CHOOSE WHO TO PLAY NEXT
            </p>
            <p className="font-mono text-[11px] text-slate-400 mt-0.5">
              Fill by searching roll number or pick from waiting list
            </p>
          </div>

          {/* Quick Roll Search for this slot */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={fillRollNo}
              onChange={(e) => setFillRollNo(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleAssignSubmit()}
              placeholder="Enter Roll No (e.g. 24ROB101)..."
              className="flex-1 bg-[#060a14] border border-amber-900/60 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-200 uppercase outline-none"
            />
            <button
              onClick={() => handleAssignSubmit()}
              disabled={fillSearching || !fillRollNo.trim()}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-mono text-xs font-bold uppercase cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              Seat
            </button>
          </div>

          {/* Waiting Queue Quick Pick */}
          {waitingQueue.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1.5">
                Seat from Waiting Queue:
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {waitingQueue.slice(0, 4).map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => handleAssignSubmit(q.rollNo)}
                    className="w-full text-left p-1.5 rounded bg-slate-900/80 hover:bg-amber-950/60 border border-slate-800 hover:border-amber-500/50 flex items-center justify-between text-[11px] font-mono transition-all cursor-pointer group"
                  >
                    <span className="truncate text-slate-300 group-hover:text-amber-200">
                      #{idx + 1} {q.name} ({q.rollNo})
                    </span>
                    <span className="text-[9px] text-amber-400 group-hover:underline">
                      Seat Here →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-[10px] font-mono text-slate-500 text-center pt-2 border-t border-slate-800">
          Organizer controls • Any contestant can be placed here
        </div>
      </div>
    );
  }

  // ------------------ RENDER: ACTIVE PLAYER SEAT ------------------
  const isDisqualified = player.status === "disqualified";
  const isFinished = player.status === "finished";

  return (
    <div
      className={`relative rounded-xl border p-5 flex flex-col justify-between transition-all tech-frame ${
        player.isRunning
          ? "bg-gradient-to-b from-[#0f2137] to-[#0c1626] border-cyan-400 shadow-cyan-glow"
          : isFinished
          ? "bg-[#0c1824] border-emerald-500/60 shadow-green-glow"
          : isDisqualified
          ? "bg-[#1c0d12] border-rose-500/50"
          : "bg-[#0b1220]/90 border-slate-800"
      }`}
    >
      {/* Top Banner Header with Slot & Actions */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-black tracking-widest ${
              player.slot === 1
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : player.slot === 2
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
            }`}
          >
            LANE #{player.slot}
          </span>
          <span className="text-xs font-mono font-bold text-slate-100 truncate max-w-[110px]">
            {player.name}
          </span>
        </div>

        {/* Organizer Quick Actions (Edit, Withdraw / Leave) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsEditing(!isEditing)}
            title="Edit player info"
            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowWithdrawDialog(!showWithdrawDialog)}
            title="Contestant left / changed mind / vacate seat"
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          {/* Status Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ml-1 ${
              player.isRunning
                ? "bg-cyan-400 text-slate-950 animate-pulse-fast shadow-cyan-glow"
                : isFinished
                ? "bg-emerald-500 text-slate-950 font-bold"
                : isDisqualified
                ? "bg-rose-500 text-slate-950"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {player.status}
          </span>
        </div>
      </div>

      {/* Organizer Withdraw / Vacate Dropdown Popover */}
      {showWithdrawDialog && (
        <div className="mb-3 p-3 rounded-lg bg-[#140b10] border border-rose-500/40 animate-fadeIn text-xs font-mono">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-rose-300 uppercase flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5 text-rose-400" />
              Contestant Leaving Position?
            </span>
            <button
              onClick={() => setShowWithdrawDialog(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5">
            If {player.name} changes their mind and leaves, they will vacate this seat so you can pick someone else.
          </p>
          <div className="space-y-1.5">
            <button
              onClick={async () => {
                setShowWithdrawDialog(false);
                await onVacateSlot(player.slot, {
                  reason: "Changed mind & left position",
                  barFromNextRound: true,
                  sendToQueue: false,
                });
              }}
              className="w-full text-left p-2 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-[11px] font-bold cursor-pointer"
            >
              🚫 Changed Mind (Bar from Next Round & Free Seat)
            </button>
            <button
              onClick={async () => {
                setShowWithdrawDialog(false);
                await onVacateSlot(player.slot, {
                  reason: "Moved back to waiting list",
                  barFromNextRound: false,
                  sendToQueue: true,
                });
              }}
              className="w-full text-left p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
            >
              ↩ Return to Waiting Queue (Keep eligible)
            </button>
            <button
              onClick={async () => {
                setShowWithdrawDialog(false);
                await onVacateSlot(player.slot, {
                  reason: "Organizer removed",
                  barFromNextRound: false,
                  sendToQueue: false,
                });
              }}
              className="w-full text-left p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 text-[11px] cursor-pointer"
            >
              🗑️ Just Vacate Seat (Don't return to queue)
            </button>
          </div>
        </div>
      )}

      {/* Edit Form Modal/Drawer */}
      {isEditing ? (
        <div className="mb-3 p-3 rounded-lg bg-[#070d18] border border-cyan-500/40 space-y-2 animate-fadeIn text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-300 uppercase">Edit Lane #{player.slot} Player</span>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Roll No:</label>
            <input
              type="text"
              value={editRoll}
              onChange={(e) => setEditRoll(e.target.value.toUpperCase())}
              className="w-full bg-[#050811] border border-slate-700 rounded px-2 py-1 text-slate-200 uppercase"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Student Name:</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-[#050811] border border-slate-700 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Team / Robot:</label>
            <input
              type="text"
              value={editTeam}
              onChange={(e) => setEditTeam(e.target.value)}
              className="w-full bg-[#050811] border border-slate-700 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <button
            onClick={handleSaveEdit}
            className="w-full py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase text-[11px] cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      ) : (
        /* Robot & Student Metadata */
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-xs text-slate-300 truncate">
              {player.teamName || "Autonomous Robot"}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
              {player.rollNo}
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-500 truncate">
            {player.department || "Robotics Engineering"}
          </p>
        </div>
      )}

      {/* Digital LCD Stopwatch Readout */}
      <div className="my-3 py-4 px-3 rounded-xl bg-[#050810] border border-cyan-950 shadow-inner flex flex-col items-center justify-center">
        <div
          className={`text-3xl sm:text-4xl font-mono font-black tracking-widest ${
            player.isRunning
              ? "text-cyan-400 digital-lcd"
              : isFinished
              ? "text-emerald-400 digital-lcd-green"
              : isDisqualified
              ? "text-rose-500 line-through"
              : "text-slate-400"
          }`}
        >
          {formatTime(displayTime, player.penaltySeconds)}
        </div>

        {/* Penalty Indicator if any */}
        {(player.penaltySeconds ?? 0) > 0 && (
          <div className="mt-1 text-[11px] font-mono text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>+{player.penaltySeconds}s Penalty Added</span>
          </div>
        )}
      </div>

      {/* Individual Controls: Start, Stop, Reset */}
      <div className="space-y-2 pt-2">
        <div className="grid grid-cols-2 gap-2">
          {!player.isRunning ? (
            <button
              onClick={handleStart}
              disabled={isDisqualified}
              className="py-2.5 px-3 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 flex items-center justify-center gap-1.5 shadow-green-glow transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>START TIME</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="py-2.5 px-3 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-rose-500 hover:bg-rose-400 text-slate-950 flex items-center justify-center gap-1.5 shadow-rose-glow transition-all cursor-pointer animate-pulse-fast"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP TIME</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="py-2.5 px-3 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>

        {/* Extra competition actions: +5s penalty / DQ / Vacate */}
        <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-400">
          <button
            onClick={handleAddPenalty}
            disabled={isDisqualified}
            className="hover:text-amber-300 hover:underline cursor-pointer disabled:text-slate-600"
          >
            +5s Penalty
          </button>

          <button
            onClick={() => setShowWithdrawDialog(true)}
            className="text-amber-400/80 hover:text-amber-300 hover:underline cursor-pointer"
          >
            Changed Mind?
          </button>

          {!isDisqualified ? (
            <button
              onClick={handleDisqualify}
              className="hover:text-rose-400 hover:underline text-slate-500 cursor-pointer"
            >
              Disqualify
            </button>
          ) : (
            <span className="text-rose-400 font-bold">DQ</span>
          )}
        </div>
      </div>

    </div>
  );
};
