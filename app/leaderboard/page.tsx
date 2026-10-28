"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Trophy,
  Medal,
  Award,
  Users,
  Search,
  ArrowLeft,
  Bot,
  Clock,
  Sparkles,
  RotateCcw,
  Shield,
  Zap,
} from "lucide-react";
import { LeaderboardEntry } from "@/lib/types";
import { soundFx } from "@/lib/sound";

export default function LeaderboardPage() {
  const [totalCount, setTotalCount] = useState<number>(0);
  const [topThree, setTopThree] = useState<LeaderboardEntry[]>([]);
  const [allParticipants, setAllParticipants] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchRollNo, setSearchRollNo] = useState<string>("");

  const fetchLeaderboard = async (query = "") => {
    try {
      const url = query
        ? `/api/leaderboard?rollNo=${encodeURIComponent(query)}`
        : "/api/leaderboard";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTotalCount(data.totalParticipantsCount);
        setTopThree(data.topThree);
        setAllParticipants(data.allParticipants);
      }
    } catch (err) {
      console.error("Failed to load leaderboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(searchRollNo);
  }, [searchRollNo]);

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100 cyber-grid">
      
      {/* Top Header */}
      <header className="border-b border-amber-500/30 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={() => soundFx.playBlip()}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-mono"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Arena</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-glow">
                <Trophy className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 font-mono">
                  OVERALL COMPETITION LEADERBOARD
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Official Rankings & Verified Performance Standings
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => {
                soundFx.playBlip();
                fetchLeaderboard(searchRollNo);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh Leaderboard"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* 1. Total Number of Players HUD (Only Count) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Main Total Count Card */}
          <div className="md:col-span-1 bg-gradient-to-br from-[#121a2f] to-[#0a101d] border border-cyan-500/40 rounded-2xl p-5 shadow-lg relative overflow-hidden tech-frame flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                TOTAL PARTICIPANTS COUNT
              </span>
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="my-3">
              <div className="text-5xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 digital-lcd">
                {loading ? "--" : totalCount}
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Total candidates who took part in competition
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-500">
              Only count of unique players recorded in arena matches
            </div>
          </div>

          {/* Quick Info & Criteria Cards */}
          <div className="md:col-span-2 bg-[#0d1527]/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between tech-frame">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-200">
                OFFICIAL RANKING METRICS & ARENA RULES
              </h3>
            </div>
            <p className="text-xs font-mono text-slate-400 leading-relaxed">
              Leaderboard rankings are calculated automatically from all completed arena match rounds. If a contestant participates in multiple matches, their <strong>fastest recorded lap time (lowest ms)</strong> is used for their final standing.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 mt-2 border-t border-slate-800 font-mono text-xs">
              <div className="p-2 rounded bg-black/40 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">CRITERIA</span>
                <span className="text-cyan-300 font-bold">Fastest Course Time</span>
              </div>
              <div className="p-2 rounded bg-black/40 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">PRECISION</span>
                <span className="text-emerald-300 font-bold">1ms (0.001s) Accuracy</span>
              </div>
              <div className="p-2 rounded bg-black/40 border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-slate-500 text-[10px] block">PENALTIES</span>
                <span className="text-amber-300 font-bold">+5s Obstacle Penalty</span>
              </div>
            </div>
          </div>

        </div>

        {/* 2. Top Three Performers Podium Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-amber-500/20 text-amber-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-300 font-mono">
                TOP THREE PERFORMERS // ARENA PODIUM
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Fastest 3 contestants from all participating candidates
              </p>
            </div>
          </div>

          {topThree.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-[#080d1a]/50 text-slate-500 font-mono text-xs">
              No completed match results yet. Complete a round in the Arena to establish rankings!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topThree.map((performer, idx) => {
                const isFirst = idx === 0;
                const isSecond = idx === 1;
                const isThird = idx === 2;

                return (
                  <div
                    key={performer.rollNo}
                    className={`rounded-2xl border p-5 relative overflow-hidden flex flex-col justify-between transition-all tech-frame ${
                      isFirst
                        ? "bg-gradient-to-b from-[#1c1809] via-[#12131f] to-[#080c14] border-amber-400 shadow-amber-glow"
                        : isSecond
                        ? "bg-gradient-to-b from-[#0f1929] to-[#080c14] border-cyan-400 shadow-cyan-glow"
                        : "bg-gradient-to-b from-[#1a1215] to-[#080c14] border-amber-600/70"
                    }`}
                  >
                    {/* Position Label & Trophy Icon */}
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs font-mono ${
                            isFirst
                              ? "bg-amber-400 text-slate-950 shadow-amber-glow"
                              : isSecond
                              ? "bg-cyan-300 text-slate-950 shadow-cyan-glow"
                              : "bg-amber-700 text-amber-100"
                          }`}
                        >
                          #{performer.rank}
                        </span>
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                          {isFirst
                            ? "🥇 1ST PLACE CHAMPION"
                            : isSecond
                            ? "🥈 2ND PLACE RUNNER UP"
                            : "🥉 3RD PLACE BRONZE"}
                        </span>
                      </div>

                      {isFirst && <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />}
                      {isSecond && <Medal className="w-5 h-5 text-cyan-300" />}
                      {isThird && <Award className="w-5 h-5 text-amber-600" />}
                    </div>

                    {/* Candidate Details */}
                    <div className="space-y-1.5 my-2">
                      <div className="text-lg font-black font-mono text-slate-100 truncate">
                        {performer.name}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-black/60 border border-slate-700 text-cyan-300 font-bold">
                          {performer.rollNo}
                        </span>
                        <span className="text-slate-400 truncate">
                          {performer.teamName || "Autonomous Bot"}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-slate-500">
                        {performer.roundsPlayed} match(es) completed
                      </div>
                    </div>

                    {/* Best Time Display */}
                    <div className="mt-3 p-3 rounded-xl bg-[#050810] border border-slate-800 text-center">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-0.5">
                        BEST TIME RECORDED
                      </span>
                      <div
                        className={`text-2xl font-black font-mono tracking-wider ${
                          isFirst
                            ? "text-amber-400 digital-lcd-amber"
                            : isSecond
                            ? "text-cyan-400 digital-lcd"
                            : "text-amber-200 digital-lcd"
                        }`}
                      >
                        {performer.bestTimeFormatted}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Search Title for Roll Number & Candidate Table */}
        <section className="bg-[#0d1527]/90 rounded-2xl border border-cyan-500/30 p-6 shadow-lg relative tech-frame space-y-4">
          
          {/* SEARCH TITLE FOR THE ROLL NUMBER (Explicitly Requested) */}
          <div className="border-b border-slate-800 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-cyan-500/20 text-cyan-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-black uppercase tracking-wider text-cyan-300 font-mono">
                    SEARCH BY ROLL NUMBER // CANDIDATE DIRECTORY
                  </h2>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Filter candidate standings by typing their student roll number
                </p>
              </div>

              {/* Matching Count Pill */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-3 py-1 rounded-lg bg-[#060a14] border border-cyan-900/60 text-cyan-300 font-bold">
                  {allParticipants.length} of {totalCount} Candidates Shown
                </span>
                {searchRollNo && (
                  <button
                    onClick={() => setSearchRollNo("")}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            {/* Roll Number Search Input */}
            <div className="mt-3.5 relative">
              <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchRollNo}
                onChange={(e) => setSearchRollNo(e.target.value.toUpperCase())}
                placeholder="Type Candidate Roll Number (e.g. 24ROB101, 24CS312, 24EC205)..."
                className="w-full bg-[#060a14] border border-cyan-900/80 focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-cyan-100 placeholder:text-slate-600 outline-none uppercase tracking-wider shadow-inner transition-all"
              />
            </div>
          </div>

          {/* Candidate List Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#070c17]">
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#09101f] text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Robot / Team</th>
                    <th className="py-3 px-4">Best Time</th>
                    <th className="py-3 px-4 text-center">Rounds</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {allParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                        {searchRollNo
                          ? `No candidates found matching roll number "${searchRollNo}".`
                          : "No participants have completed a round yet."}
                      </td>
                    </tr>
                  ) : (
                    allParticipants.map((candidate) => {
                      const isTop3 = candidate.rank <= 3;

                      return (
                        <tr
                          key={candidate.rollNo}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            candidate.rank === 1
                              ? "bg-amber-950/20"
                              : candidate.rank === 2
                              ? "bg-cyan-950/20"
                              : candidate.rank === 3
                              ? "bg-amber-950/10"
                              : ""
                          }`}
                        >
                          {/* Rank Badge */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                candidate.rank === 1
                                  ? "bg-amber-400 text-slate-950 shadow-amber-glow"
                                  : candidate.rank === 2
                                  ? "bg-cyan-300 text-slate-950 shadow-cyan-glow"
                                  : candidate.rank === 3
                                  ? "bg-amber-700 text-amber-100"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              #{candidate.rank}
                            </span>
                          </td>

                          {/* Roll Number */}
                          <td className="py-3 px-4 font-bold text-cyan-300 tracking-wider">
                            {candidate.rollNo}
                          </td>

                          {/* Candidate Name */}
                          <td className="py-3 px-4 font-medium text-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span>{candidate.name}</span>
                              {isTop3 && (
                                <Medal
                                  className={`w-3.5 h-3.5 ${
                                    candidate.rank === 1
                                      ? "text-amber-400"
                                      : candidate.rank === 2
                                      ? "text-cyan-300"
                                      : "text-amber-600"
                                  }`}
                                />
                              )}
                            </div>
                          </td>

                          {/* Team Name */}
                          <td className="py-3 px-4 text-slate-400">
                            {candidate.teamName || "Autonomous Bot"}
                          </td>

                          {/* Best Recorded Lap Time */}
                          <td className="py-3 px-4">
                            <span
                              className={`font-black tracking-wider ${
                                candidate.status === "disqualified"
                                  ? "text-rose-500 line-through"
                                  : candidate.rank === 1
                                  ? "text-amber-300 digital-lcd"
                                  : candidate.rank === 2
                                  ? "text-cyan-300 digital-lcd"
                                  : "text-emerald-400 digital-lcd-green"
                              }`}
                            >
                              {candidate.bestTimeFormatted}
                            </span>
                          </td>

                          {/* Rounds Played */}
                          <td className="py-3 px-4 text-center text-slate-400">
                            {candidate.roundsPlayed}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                candidate.status === "disqualified"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {candidate.status === "disqualified" ? "DQ" : "Verified"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </section>

      </main>

    </div>
  );
}

