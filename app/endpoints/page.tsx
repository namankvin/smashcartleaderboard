"use client";
import Link from "next/link";
import { Code2, Flag } from "lucide-react";
import { WebhookSimulatorModal } from "@/components/WebhookSimulatorModal";

export default function EndpointsPage() {
  return <>
    <header className="app-header"><div className="header-inner"><div className="brand"><span className="brand-icon"><Flag size={22} /></span><div><strong>SmashKart</strong><small>Embedded team integration</small></div></div><nav className="header-actions" aria-label="Main navigation"><Link className="btn" href="/">Race control</Link><Link className="btn btn-primary" href="/endpoints" aria-current="page"><Code2 size={15} />Endpoint information</Link><Link className="btn" href="/leaderboard">Leaderboard</Link></nav></div></header>
    <main className="app-shell"><div className="page-heading"><div><p className="eyebrow">Developer tools</p><h1>Endpoint information</h1><p className="muted">Everything your embedded team needs to send RFID registrations.</p></div><span className="badge badge-good">POST · JSON</span></div><WebhookSimulatorModal isOpen presentation="page" onClose={() => {}} onSuccessEnqueued={() => {}} /></main>
  </>;
}
