"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RFIDSetup } from "@/components/RFIDSetup";
import { soundFx } from "@/lib/sound";
import { Header } from "@/components/Header";
import { ManualRollInput } from "@/components/ManualRollInput";
import { WalkInRegistration } from "@/components/WalkInRegistration";
import { LiveQueue } from "@/components/LiveQueue";
import { PlayingArena } from "@/components/PlayingArena";
import { MatchHistory } from "@/components/MatchHistory";
import { StudentDatabaseModal } from "@/components/StudentDatabaseModal";
import { WebhookSimulatorModal } from "@/components/WebhookSimulatorModal";
import { ActivePlayer, QueueItem, MatchRound, DbStatus } from "@/lib/types";

export default function RaceControl() {
  const [queue, setQueue] = useState<QueueItem[]>([]); const [players, setPlayers] = useState<ActivePlayer[]>([]); const [history, setHistory] = useState<MatchRound[]>([]); const [round, setRound] = useState(1); const [raceStarted, setRaceStarted] = useState(false); const [raceId, setRaceId] = useState(""); const [targetLaps, setTargetLaps] = useState(3); const [db, setDb] = useState<DbStatus | null>(null);
  const [busy, setBusy] = useState(false); const busyRef = useRef(false); const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const [tab, setTab] = useState("student"); const [directory, setDirectory] = useState(false); const [webhook, setWebhook] = useState(false); const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const [waiting, game, status] = await Promise.all(["/api/queue", "/api/game", "/api/system/db-status"].map(async path => (await fetch(path, { cache: "no-store" })).json()));
      if (sequence !== refreshSequence.current) return;
      if (!waiting.success || !game.success || !status.success) throw new Error("Unable to refresh the event. Please retry.");
      setQueue(waiting.queue); setPlayers(game.players); setRound(game.roundNumber); setRaceStarted(game.raceStarted); setRaceId(game.raceId); setTargetLaps(game.targetLaps); setHistory(game.history); setDb(status.status);
    } catch { if (sequence === refreshSequence.current) setError("Could not refresh the event. Check your connection and retry."); }
  }, []);
  useEffect(() => { refresh(); const interval = setInterval(() => { if (!busyRef.current) refresh(); }, raceStarted ? 1000 : 3000); const openWalkIn = () => setTab("walkin"); window.addEventListener("edit-walk-in", openWalkIn); return () => { clearInterval(interval); window.removeEventListener("edit-walk-in", openWalkIn); }; }, [refresh, raceStarted]);
  async function action(path: string, body: Record<string, unknown>, method = "POST") {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(""); setNotice(""); ++refreshSequence.current;
    try {
      const data = await (await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      if (!data.success) throw new Error(data.message || data.error || "Could not complete this action.");
      if (method === "DELETE" && path.startsWith("/api/queue")) window.dispatchEvent(new Event("walk-ins-changed"));
      if (body.action === "start_all") soundFx.playStartBuzzer();
      else if (body.action === "stop_all" || body.action === "stop") soundFx.playStopChime();
      else if (path === "/api/game/finish") soundFx.playVictoryFanfare();
      setNotice(data.message || (path.includes("timer") ? "Race timers updated." : "Changes saved.")); await refresh(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please retry."); await refresh(); return false; }
    finally { setBusy(false); busyRef.current = false; }
  }
  return <><Header dbStatus={db} onOpenStudentModal={() => setDirectory(true)} /><main className="app-shell"><div className="page-heading"><div><p className="eyebrow">Organizer workspace</p><h1>Race control</h1><p className="muted">Register players, prepare the tracks, and run the next round.</p></div><div className="stats"><div className="stat"><strong>{queue.length}</strong><span>Waiting to play</span></div><div className="stat"><strong>{players.filter(player => !player.isVacant).length}<span style={{ fontSize: 16 }}> / 3</span></strong><span>On the tracks</span></div><div className="stat"><strong>{history.length}</strong><span>Rounds completed</span></div></div></div>
    {notice && <div className="notice" role="status">{notice}<button className="btn btn-quiet btn-small" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
    {error && <div className="error" role="alert" style={{ marginBottom: 18 }}>{error} <button className="link-button" onClick={() => { setError(""); refresh(); }}>Refresh</button></div>}
    <section className="panel registration-panel" id="register"><div className="panel-heading"><h2><span className="step-number">1</span>Register a player</h2><div className="tabs" role="tablist" aria-label="Registration type" onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const next = tab === "student" ? "walkin" : "student"; setTab(next); document.getElementById(next === "student" ? "student-tab" : "walkin-tab")?.focus(); } }}><button role="tab" aria-selected={tab === "student"} aria-controls="student-registration" id="student-tab" onClick={() => setTab("student")}>Student</button><button role="tab" aria-selected={tab === "walkin"} aria-controls="walkin-registration" id="walkin-tab" onClick={() => setTab("walkin")}>Walk-in / visitor</button></div></div><div role="tabpanel" aria-labelledby="student-tab" id="student-registration" hidden={tab !== "student"}><ManualRollInput onAddedToQueue={refresh} /></div><div role="tabpanel" aria-labelledby="walkin-tab" id="walkin-registration" hidden={tab !== "walkin"}><WalkInRegistration onChanged={refresh} /></div></section>
    <div className="workspace-grid"><LiveQueue queue={queue} players={players} busy={busy} locked={raceStarted} onAction={action} /><PlayingArena raceId={raceId} targetLaps={targetLaps} players={players} queue={queue} round={round} raceStarted={raceStarted} busy={busy} onAction={action} /></div>
    <MatchHistory history={history} />
    <details className="panel tools-panel"><summary>RFID connection & setup tools</summary><p className="muted">Card pairing and background registration are ready. Connect your reader to send card UIDs to the registration endpoint.</p><RFIDSetup /><div className="button-row" style={{ marginTop: 12 }}><button className="btn" onClick={() => setWebhook(true)}>Test RFID registration</button><button className="btn" onClick={() => setDirectory(true)}>Open student directory</button></div></details>
  </main><StudentDatabaseModal isOpen={directory} onClose={() => setDirectory(false)} onStudentEnqueued={refresh} /><WebhookSimulatorModal isOpen={webhook} onClose={() => setWebhook(false)} onSuccessEnqueued={refresh} /></>;
}
