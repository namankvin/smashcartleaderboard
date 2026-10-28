"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Bot,
  Sparkles,
  UserCheck,
  Zap,
  UserPlus,
} from "lucide-react";
import { Student, ActivePlayer } from "@/lib/types";
import { soundFx } from "@/lib/sound";

interface ManualRollInputProps {
  activePlayers: ActivePlayer[];
  onAddedToQueue: () => void;
  onAssignToSlot: (slot: number, rollNo: string) => Promise<void>;
}

export const ManualRollInput: React.FC<ManualRollInputProps> = ({
  activePlayers,
  onAddedToQueue,
  onAssignToSlot,
}) => {
  const [rollNo, setRollNo] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Identify which arena slots are currently vacant
  const vacantSlots = activePlayers.filter((p) => p.isVacant);

  // Quick 1-click test roll numbers
  const sampleRolls = ["24ROB101", "24ROB102", "24EC205", "24CS312", "24ME401", "24EE118", "24AI505"];

  // Real-time lookup debounced as user types
  useEffect(() => {
    if (!rollNo.trim() || rollNo.trim().length < 3) {
      setPreviewStudent(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/students/${encodeURIComponent(rollNo.trim())}`);
        const data = await res.json();
        if (data.success && data.student) {
          setPreviewStudent(data.student);
        } else {
          setPreviewStudent(null);
        }
      } catch {
        setPreviewStudent(null);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [rollNo]);

  // Add to Waiting Queue
  const handleAddToQueue = async (targetRoll?: string) => {
    const finalRoll = (targetRoll || rollNo).trim();
    if (!finalRoll) {
      setFeedback({ type: "error", message: "Please enter a roll number." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo: finalRoll }),
      });
      const data = await res.json();

      if (data.success) {
        soundFx.playEnqueueSound();
        setFeedback({
          type: "success",
          message: data.message || `Roll #${finalRoll} added to queue!`,
        });
        setRollNo("");
        setPreviewStudent(null);
        onAddedToQueue();
      } else {
        setFeedback({
          type: "error",
          message: data.message || "Failed to add to queue.",
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: "Network error: could not connect to server.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Seat Directly in a specific Arena Lane (e.g. if a player backed out or changed mind)
  const handleDirectSeatInSlot = async (slot: number, targetRoll?: string) => {
    const finalRoll = (targetRoll || rollNo).trim();
    if (!finalRoll) return;

    setSubmitting(true);
    setFeedback(null);
    soundFx.playEnqueueSound();

    try {
      await onAssignToSlot(slot, finalRoll);
      setFeedback({
        type: "success",
        message: `Assigned Roll #${finalRoll} directly to Arena Lane #${slot}!`,
      });
      setRollNo("");
      setPreviewStudent(null);
    } catch (err) {
      setFeedback({
        type: "error",
        message: "Failed to seat contestant in arena slot.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If there is an empty slot, prompt or add to queue
      handleAddToQueue();
    }
  };

  return (
    <div className="bg-[#0d1527]/90 rounded-xl border border-cyan-500/30 p-5 shadow-lg relative overflow-hidden tech-frame">
      {/* Decorative header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyan-500/20 text-cyan-400">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-300 font-mono">
              CONTESTANT SEARCH & ORGANIZER DISPATCH
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Lookup Roll No to add to Queue or assign directly to an Arena Lane
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Organizer Master Control
        </span>
      </div>

      {/* Input Group */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={rollNo}
            onChange={(e) => setRollNo(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Type Roll No (e.g. 24ROB101, 24EC205)..."
            className="w-full bg-[#080d1a] border border-cyan-900/60 focus:border-cyan-400 rounded-lg px-4 py-3 text-cyan-100 placeholder-slate-500 font-mono text-sm tracking-wider outline-none transition-all shadow-inner uppercase"
          />
          {searching && (
            <span className="absolute right-3 top-3.5 text-xs text-cyan-400 font-mono animate-pulse">
              Searching DB...
            </span>
          )}
        </div>

        {/* Action Button: Add to Queue */}
        <button
          onClick={() => handleAddToQueue()}
          disabled={submitting || !rollNo.trim()}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-500 border border-cyan-400/40 shadow-cyan-glow transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{submitting ? "Processing..." : "Add to Queue"}</span>
        </button>
      </div>

      {/* Direct Arena Lane Seating Shortcuts (If an Arena seat is vacant or organizer wants to seat) */}
      {rollNo.trim() && (
        <div className="mt-3 p-3 rounded-lg bg-[#080f1d] border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono animate-fadeIn">
          <div className="flex items-center gap-1.5 text-amber-300">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold">Direct Lane Placement:</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              (Seats immediately in active match)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[1, 2, 3].map((slotNum) => {
              const isVacant = activePlayers.some((p) => p.slot === slotNum && p.isVacant);
              return (
                <button
                  key={slotNum}
                  onClick={() => handleDirectSeatInSlot(slotNum)}
                  disabled={submitting}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                    isVacant
                      ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-amber-glow animate-pulse"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                  }`}
                >
                  {isVacant ? `⚡ Fill Vacant Lane #${slotNum}` : `Seat in Lane #${slotNum}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Real-time DB Student Preview Card */}
      {previewStudent && (
        <div className="mt-3 p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between text-xs font-mono animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-cyan-500/20 text-cyan-300">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-300">{previewStudent.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-200">
                  {previewStudent.rollNo}
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Team: <span className="text-slate-200">{previewStudent.teamName || "Independent"}</span> • {previewStudent.department || "Robotics"}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
            <UserCheck className="w-3.5 h-3.5" />
            Verified in DB
          </span>
        </div>
      )}

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`mt-3 p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300"
              : feedback.type === "error"
              ? "bg-rose-950/60 border border-rose-500/40 text-rose-300"
              : "bg-slate-800/80 border border-slate-700 text-slate-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Quick 1-Click Roll Number Chips for Testing */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Quick Test Rolls:
          </span>
          {sampleRolls.map((roll) => (
            <button
              key={roll}
              onClick={() => {
                setRollNo(roll);
                handleAddToQueue(roll);
              }}
              className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-800/80 hover:bg-cyan-950 hover:text-cyan-300 hover:border-cyan-500/40 border border-slate-700 text-slate-300 transition-all cursor-pointer"
            >
              + {roll}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
