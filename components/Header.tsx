"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Cpu,
  Database,
  Volume2,
  VolumeX,
  Code2,
  Users,
  Radio,
  Zap,
  Trophy,
} from "lucide-react";
import { soundFx } from "@/lib/sound";
import { DbStatus } from "@/lib/types";

interface HeaderProps {
  dbStatus: DbStatus | null;
  onOpenWebhookModal: () => void;
  onOpenStudentModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  dbStatus,
  onOpenWebhookModal,
  onOpenStudentModal,
}) => {
  const [audioEnabled, setAudioEnabled] = useState(true);

  const toggleAudio = () => {
    soundFx.enabled = !audioEnabled;
    setAudioEnabled(!audioEnabled);
    if (!audioEnabled) soundFx.playBlip();
  };

  const isMock = dbStatus?.source === "mock-in-memory" || !dbStatus?.connectedToMongo;

  return (
    <header className="border-b border-cyan-900/40 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Logo & Robotics Branding */}
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 shadow-cyan-glow">
              <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 font-mono">
                  ROBO-ARENA // QUEUE & TIMER OS
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  v2.0 Next.js
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Robotics Competition Arena Management System
              </p>
            </div>
          </div>

          {/* Controls & Status Bar */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* DB Status Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${
                isMock
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                  : "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                {isMock ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    TEST MODE (Mock DB Active)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    MongoDB Connected
                  </span>
                )}
              </span>
            </div>

            {/* Leaderboard Page Link Button */}
            <Link
              href="/leaderboard"
              onClick={() => soundFx.playBlip()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-bold bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/40 hover:shadow-amber-glow transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Leaderboard</span>
            </Link>

            {/* Students DB Button */}
            <button
              onClick={() => {
                soundFx.playBlip();
                onOpenStudentModal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 transition-all cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Students DB ({dbStatus?.totalStudents ?? 0})</span>
            </button>

            {/* Webhook API Button */}
            <button
              onClick={() => {
                soundFx.playBlip();
                onOpenWebhookModal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 hover:shadow-cyan-glow transition-all cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Webhook API Endpoint</span>
            </button>

            {/* Sound FX Toggle */}
            <button
              onClick={toggleAudio}
              title={audioEnabled ? "Disable SFX" : "Enable SFX"}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            >
              {audioEnabled ? (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

