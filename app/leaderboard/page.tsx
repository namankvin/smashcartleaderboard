"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LeaderboardEntry } from "@/lib/types";

const podium = [
  { medal: "🥇", label: "1st place", tone: "gold" },
  { medal: "🥈", label: "2nd place", tone: "silver" },
  { medal: "🥉", label: "3rd place", tone: "bronze" },
];

export default function Leaderboard() {
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [top, setTop] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/leaderboard?q=${encodeURIComponent(search)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error();
        if (!controller.signal.aborted) {
          setPlayers(data.allParticipants); setTop(data.topThree); setTotal(data.totalParticipantsCount); setError("");
        }
      } catch {
        if (!controller.signal.aborted) setError("Could not load lap times. Retrying shortly.");
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const timeout = setTimeout(refresh, 200);
    const interval = setInterval(refresh, 5000);
    return () => { clearTimeout(timeout); clearInterval(interval); controller.abort(); };
  }, [search]);
  return <>
    <header className="app-header"><div className="header-inner">
      <div className="brand"><strong>SmashKart · Leaderboard</strong></div>
      <Link className="btn" href="/">← Back to race control</Link>
    </div></header>
    <main className="app-shell">
      <div className="page-heading">
        <div><p className="eyebrow">Every lap counts</p><h1>Leaderboard</h1>
          <p className="muted">Ranked by each player’s fastest single lap. Completed laps count even if the race is unfinished.</p></div>
        <span className="badge">{total} {total === 1 ? "player has" : "players have"} recorded a lap</span>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!!top.length && <section className="leaderboard-podium" aria-label="Fastest three players">
        {top.map((player, index) => <article className={`panel podium-card podium-${podium[index].tone}`} key={player.rollNo}>
          <div className="podium-place"><span className="podium-medal" aria-hidden="true">{podium[index].medal}</span><span>{podium[index].label}</span></div>
          <h2>{player.name}</h2><p className="person-meta">{player.rollNo.startsWith("GUEST-") ? "Walk-in participant" : player.rollNo}</p>
          <p className="podium-time">{player.bestTimeFormatted}</p><p className="muted">Personal best lap</p>
        </article>)}
      </section>}
      <section className="panel">
        <div className="panel-heading"><h2>Lap standings</h2>
          <input style={{ maxWidth: 320 }} className="field" aria-label="Search leaderboard" placeholder="Search name or roll number" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <p className="muted">Loading lap times…</p> : !players.length ?
          <div className="empty-state">{total ? "No players match your search." : "The first completed lap will appear here automatically."}</div> :
          <div style={{ overflowX: "auto" }}><table className="results-table"><thead><tr><th>Rank</th><th>Player</th><th>Best lap</th><th>Laps recorded</th><th>Races with laps</th></tr></thead>
            <tbody>{players.map(player => <tr className={player.rank <= 3 ? `leaderboard-row podium-${podium[player.rank - 1].tone}` : ""} key={player.rollNo}>
              <td><span className="leaderboard-rank">{player.rank <= 3 && <span aria-hidden="true">{podium[player.rank - 1].medal}</span>}<span>{player.rank}</span></span></td>
              <td><strong>{player.name}</strong><p className="person-meta">{player.rollNo.startsWith("GUEST-") ? "Walk-in" : player.rollNo}</p></td>
              <td className="leaderboard-lap">{player.bestTimeFormatted}</td><td>{player.lapsCompleted}</td><td>{player.roundsPlayed}</td>
            </tr>)}</tbody>
          </table></div>}
      </section>
    </main>
  </>;
}
