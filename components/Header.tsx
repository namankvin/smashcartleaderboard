"use client";
import { useState } from "react";
import Link from "next/link";
import { Flag, Trophy, Users, Volume2, VolumeX } from "lucide-react";
import { DbStatus } from "@/lib/types";
import { soundFx } from "@/lib/sound";
export function Header({ dbStatus, onOpenStudentModal }: { dbStatus: DbStatus | null; onOpenStudentModal: () => void; onOpenWebhookModal?: () => void }) {
  const [audio, setAudio] = useState(soundFx.enabled);
  return <header className="app-header"><div className="header-inner"><div className="brand"><span className="brand-icon"><Flag size={22} /></span><div><strong>SmashKart</strong><small>Event control</small></div></div><div className="header-actions"><span className={`badge ${dbStatus?.connectedToMongo ? "badge-good" : "badge-warn"}`}>{dbStatus ? dbStatus.connectedToMongo ? "Database connected" : "Local session" : "Connecting…"}</span><button className="btn" onClick={onOpenStudentModal}><Users size={15} />Student directory</button><Link href="/leaderboard" className="btn"><Trophy size={15} />Leaderboard</Link><button className="btn btn-quiet" aria-label={audio ? "Mute sounds" : "Enable sounds"} onClick={() => { soundFx.enabled = !audio; setAudio(!audio); }}>{audio ? <Volume2 size={17} /> : <VolumeX size={17} />}</button></div></div></header>;
}
