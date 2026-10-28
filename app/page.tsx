"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { ManualRollInput } from "@/components/ManualRollInput";
import { LiveQueue } from "@/components/LiveQueue";
import { PlayingArena } from "@/components/PlayingArena";
import { MatchHistory } from "@/components/MatchHistory";
import { WebhookSimulatorModal } from "@/components/WebhookSimulatorModal";
import { StudentDatabaseModal } from "@/components/StudentDatabaseModal";
import { QueueItem, ActivePlayer, MatchRound, DbStatus, WithdrawnRecord } from "@/lib/types";
import { Cpu, ShieldCheck, Terminal, Radio, Info } from "lucide-react";
import { soundFx } from "@/lib/sound";

export default function RoboticsArenaPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([
    { slot: 1, rollNo: "", name: "Vacant Slot", isVacant: true, accumulatedMs: 0, isRunning: false, status: "vacant", startTime: null, stopTime: null },
    { slot: 2, rollNo: "", name: "Vacant Slot", isVacant: true, accumulatedMs: 0, isRunning: false, status: "vacant", startTime: null, stopTime: null },
    { slot: 3, rollNo: "", name: "Vacant Slot", isVacant: true, accumulatedMs: 0, isRunning: false, status: "vacant", startTime: null, stopTime: null },
  ]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [history, setHistory] = useState<MatchRound[]>([]);
  const [withdrawnList, setWithdrawnList] = useState<WithdrawnRecord[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  // Modals
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);

  // Fetch Queue & Arena data from backend
  const refreshAllData = useCallback(async () => {
    try {
      // 1. Fetch Queue
      const queueRes = await fetch("/api/queue");
      const queueData = await queueRes.json();
      if (queueData.success) {
        setQueue(queueData.queue);
      }

      // 2. Fetch Arena & History
      const gameRes = await fetch("/api/game");
      const gameData = await gameRes.json();
      if (gameData.success) {
        setActivePlayers(gameData.players);
        setRoundNumber(gameData.roundNumber);
        setHistory(gameData.history);
        setWithdrawnList(gameData.withdrawn || []);
      }

      // 3. Fetch DB status
      const statusRes = await fetch("/api/system/db-status");
      const statusData = await statusRes.json();
      if (statusData.success) {
        setDbStatus(statusData.status);
      }
    } catch (err) {
      console.error("Data refresh failed", err);
    }
  }, []);

  // Initial load & lightweight background poll for live multi-device syncing
  useEffect(() => {
    refreshAllData();
    const interval = setInterval(refreshAllData, 3000);
    return () => clearInterval(interval);
  }, [refreshAllData]);

  // Game Action: Start Game / Draw Top 3 from Queue
  const handleStartGame = async () => {
    try {
      const res = await fetch("/api/game/start-next", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setActivePlayers(data.players);
        await refreshAllData();
      } else {
        alert(data.message || "Failed to start game");
      }
    } catch (err) {
      console.error("Start game error", err);
    }
  };

  // Master Stopwatches Action (Start All / Stop All / Reset All)
  const handleMasterAction = async (action: "start_all" | "stop_all" | "reset_all") => {
    try {
      const res = await fetch("/api/game/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setActivePlayers(data.players);
      }
    } catch (err) {
      console.error("Master action error", err);
    }
  };

  // Individual Stopwatch Action
  const handleIndividualAction = async (
    slot: number,
    action: "start" | "stop" | "reset" | "penalty" | "disqualify",
    extra?: { penalty?: number }
  ) => {
    try {
      const res = await fetch("/api/game/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, slot, penaltySeconds: extra?.penalty }),
      });
      const data = await res.json();
      if (data.success) {
        setActivePlayers(data.players);
      }
    } catch (err) {
      console.error("Individual action error", err);
    }
  };

  // Vacate Slot (Contestant left / changed mind)
  const handleVacateSlot = async (
    slot: number,
    options: { reason: string; barFromNextRound: boolean; sendToQueue: boolean }
  ) => {
    try {
      soundFx.playBlip();
      const res = await fetch("/api/game/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vacate",
          slot,
          ...options,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActivePlayers(data.players);
        await refreshAllData();
      } else {
        alert(data.message || "Failed to vacate slot");
      }
    } catch (err) {
      console.error("Vacate slot error", err);
    }
  };

  // Assign Player to Slot (Direct seating from search or waiting list)
  const handleAssignSlot = async (slot: number, rollNo: string) => {
    try {
      soundFx.playEnqueueSound();
      const res = await fetch("/api/game/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          slot,
          rollNo,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActivePlayers(data.players);
        await refreshAllData();
      } else {
        alert(data.message || "Failed to assign player to slot");
      }
    } catch (err) {
      console.error("Assign slot error", err);
    }
  };

  // Edit Player in Slot
  const handleEditSlot = async (
    slot: number,
    playerData: { name: string; teamName: string; rollNo: string; department?: string }
  ) => {
    try {
      soundFx.playBlip();
      const res = await fetch("/api/game/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          slot,
          ...playerData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActivePlayers(data.players);
        await refreshAllData();
      } else {
        alert(data.message || "Failed to edit slot player");
      }
    } catch (err) {
      console.error("Edit slot error", err);
    }
  };

  // Unbar contestant
  const handleUnbarContestant = async (rollNo: string) => {
    try {
      soundFx.playBlip();
      const res = await fetch("/api/game/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unbar",
          rollNo,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawnList(data.withdrawn);
        await refreshAllData();
      }
    } catch (err) {
      console.error("Unbar error", err);
    }
  };

  // Finish Round & Save to Archives
  const handleFinishRound = async () => {
    try {
      const res = await fetch("/api/game/finish", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setActivePlayers([
          { slot: 1, rollNo: "", name: "Vacant Slot", isVacant: true, accumulatedMs: 0, isRunning: false, status: "vacant", startTime: null, stopTime: null },
          { slot: 2, rollNo: "", name: "Vacant Slot", isVacant: true, accumulatedMs: 0, isRunning: false, status: "vacant", startTime: null, stopTime: null },
          { slot: 3, rollNo: "", name: "Vacant Slot", isVacant: true, accumulatedMs: 0, isRunning: false, status: "vacant", startTime: null, stopTime: null },
        ]);
        setHistory(data.allHistory);
        await refreshAllData();
      } else {
        alert(data.message || "Failed to finish round");
      }
    } catch (err) {
      console.error("Finish round error", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14]">
      {/* Top Futuristic Header */}
      <Header
        dbStatus={dbStatus}
        onOpenWebhookModal={() => setWebhookModalOpen(true)}
        onOpenStudentModal={() => setStudentModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* Testing Mode Banner (When user does not have MongoDB setup yet) */}
        {(!dbStatus || dbStatus.source === "mock-in-memory") && (
          <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono shadow-lg">
            <div className="flex items-center gap-3">
              <span className="p-1.5 rounded bg-amber-500/20 text-amber-400">
                <Info className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-amber-300">
                  TESTING MODE ACTIVE: Built-in Mock Database Running!
                </span>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  Full organizer slot substitution, vacancy fill, and withdrawal rules are enabled without needing MongoDB.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStudentModalOpen(true)}
              className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              View Sample Students
            </button>
          </div>
        )}

        {/* Top Grid: Left Side (Manual Search) & Right Side Waiting List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Left / Center Arena Zone (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Contestant Search & Direct Dispatch */}
            <ManualRollInput
              activePlayers={activePlayers}
              onAddedToQueue={refreshAllData}
              onAssignToSlot={handleAssignSlot}
            />

            {/* Active 3-Robot Playing Arena & Stopwatches */}
            <PlayingArena
              activePlayers={activePlayers}
              roundNumber={roundNumber}
              waitingQueue={queue}
              withdrawnList={withdrawnList}
              onMasterAction={handleMasterAction}
              onIndividualAction={handleIndividualAction}
              onFinishRound={handleFinishRound}
              onVacateSlot={handleVacateSlot}
              onAssignSlot={handleAssignSlot}
              onEditSlot={handleEditSlot}
              onUnbarContestant={handleUnbarContestant}
            />

            {/* Match Archives & Fast Recorded Times */}
            <MatchHistory history={history} />
          </div>

          {/* Right Column: Waiting Queue (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-6">
            <LiveQueue
              queue={queue}
              activePlayers={activePlayers}
              onStartGame={handleStartGame}
              onRefresh={refreshAllData}
              onSeatInSlot={handleAssignSlot}
              isArenaOccupied={activePlayers.some((p) => !p.isVacant)}
            />

            {/* Quick Webhook Endpoint Helper Card */}
            <div className="bg-[#0b1220]/90 rounded-xl border border-cyan-500/20 p-4 text-xs font-mono text-slate-400">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cyan-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  Main Web Integration
                </span>
                <button
                  onClick={() => setWebhookModalOpen(true)}
                  className="text-[10px] text-cyan-300 hover:underline"
                >
                  Test Webhook →
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Send roll numbers from your main website to automatically look up their name from the DB and push them into the waiting list:
              </p>
              <div className="mt-2 p-2 rounded bg-black/60 border border-slate-800 text-[11px] text-emerald-400 select-all overflow-x-auto">
                POST /api/webhook/roll-no
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Modals */}
      <WebhookSimulatorModal
        isOpen={webhookModalOpen}
        onClose={() => setWebhookModalOpen(false)}
        onSuccessEnqueued={refreshAllData}
      />

      <StudentDatabaseModal
        isOpen={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        onStudentEnqueued={refreshAllData}
      />
    </div>
  );
}
