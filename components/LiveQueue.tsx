"use client";

import React, { useState } from "react";
import { QueueItem, ActivePlayer } from "@/lib/types";
import {
  ListOrdered,
  Trash2,
  Play,
  Clock,
  Bot,
  UserX,
  ShieldAlert,
  ArrowRight,
  Flame,
  Search,
  Zap,
} from "lucide-react";
import { soundFx } from "@/lib/sound";

interface LiveQueueProps {
  queue: QueueItem[];
  activePlayers: ActivePlayer[];
  onStartGame: () => Promise<void>;
  onRefresh: () => void;
  onSeatInSlot: (slot: number, rollNo: string) => Promise<void>;
  isArenaOccupied: boolean;
}

export const LiveQueue: React.FC<LiveQueueProps> = ({
  queue,
  activePlayers,
  onStartGame,
  onRefresh,
  onSeatInSlot,
  isArenaOccupied,
}) => {
  const [starting, setStarting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const vacantSlots = activePlayers.filter((p) => p.isVacant);

  const filteredQueue = queue.filter((item) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.rollNo.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.teamName && item.teamName.toLowerCase().includes(q))
    );
  });

  const handleStartGameClick = async () => {
    if (queue.length === 0) return;
    setStarting(true);
    soundFx.playStartBuzzer();
    try {
      await onStartGame();
    } finally {
      setStarting(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Delete contestant ${name} from waiting list?`)) return;
    try {
      const res = await fetch(`/api/queue?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        soundFx.playBlip();
        onRefresh();
      }
    } catch (err) {
      console.error("Remove failed", err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear the ENTIRE waiting list?")) return;
    setClearing(true);
    try {
      await fetch("/api/queue?clearAll=true", { method: "DELETE" });
      soundFx.playBlip();
      onRefresh();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-[#0d1527]/90 rounded-xl border border-cyan-500/30 p-5 shadow-lg relative flex flex-col h-full tech-frame">
      
      {/* Queue Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyan-500/20 text-cyan-400">
            <ListOrdered className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-300 font-mono">
              WAITING LIST
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Contestants Queue ({queue.length} Total)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold">
            {queue.length} Waiting
          </span>
          {queue.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              title="Clear all waiting queue"
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Action Button: Start Game / Dispatch 3 Robots */}
      <div className="mb-3">
        <button
          onClick={handleStartGameClick}
          disabled={queue.length === 0 || starting}
          className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            queue.length === 0
              ? "bg-slate-800/60 text-slate-500 border border-slate-700/60 cursor-not-allowed"
              : isArenaOccupied
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 border border-amber-400/50 shadow-amber-glow hover:brightness-110"
              : "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 border border-emerald-400/50 shadow-green-glow hover:brightness-110 active:scale-[0.99]"
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>
            {starting
              ? "DISPATCHING..."
              : queue.length === 0
              ? "WAITING LIST EMPTY"
              : isArenaOccupied
              ? "RE-DISPATCH 3 TO ARENA"
              : "START GAME (DISPATCH 3 ROBOTS)"}
          </span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>

      {/* Queue Search Filter */}
      {queue.length > 0 && (
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search waiting list by Roll No or Name..."
            className="w-full bg-[#060a14] border border-slate-800 focus:border-cyan-500/60 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 outline-none placeholder:text-slate-600"
          />
        </div>
      )}

      {/* Queue Items List */}
      <div className="flex-1 overflow-y-auto max-h-[460px] space-y-2 pr-1">
        {queue.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 rounded-lg border border-dashed border-slate-800 bg-[#080d19]/60">
            <Bot className="w-8 h-8 text-slate-600 mb-1.5" />
            <p className="text-xs font-mono text-slate-400">Waiting list is empty</p>
            <p className="text-[11px] font-mono text-slate-500 mt-1">
              Add roll numbers manually or receive via Webhook
            </p>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="p-4 text-center font-mono text-xs text-slate-500">
            No contestants matching "{filterQuery}"
          </div>
        ) : (
          filteredQueue.map((item) => {
            const originalIndex = queue.findIndex((q) => q.id === item.id);
            const isTopThree = originalIndex < 3;

            return (
              <div
                key={item.id}
                className={`p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 font-mono text-xs ${
                  isTopThree
                    ? "bg-cyan-950/30 border-cyan-500/50 shadow-sm shadow-cyan-950"
                    : "bg-[#090f1e]/80 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Position Badge */}
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] shrink-0 ${
                        originalIndex === 0
                          ? "bg-amber-400 text-slate-950"
                          : originalIndex === 1
                          ? "bg-slate-300 text-slate-950"
                          : originalIndex === 2
                          ? "bg-amber-700 text-amber-100"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      #{originalIndex + 1}
                    </div>

                    {/* Student Details */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-100 truncate max-w-[130px]">
                          {item.name}
                        </span>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {item.rollNo}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Bot: <span className="text-slate-300">{item.teamName || "Bot"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Delete action */}
                  <button
                    onClick={() => handleRemove(item.id, item.name)}
                    title="Delete from waiting list"
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Organizer Shortcut: Seat into Vacant Arena Slot */}
                {vacantSlots.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Seat Now:
                    </span>
                    <div className="flex items-center gap-1">
                      {vacantSlots.map((slot) => (
                        <button
                          key={slot.slot}
                          onClick={() => onSeatInSlot(slot.slot, item.rollNo)}
                          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold transition-all cursor-pointer"
                        >
                          → Lane #{slot.slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
