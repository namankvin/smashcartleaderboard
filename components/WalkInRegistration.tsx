"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WalkInProfile } from "@/lib/types";

export function WalkInEditButton({ id }: { id: string }) {
  if (!id.startsWith("GUEST-")) return null;
  return <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("edit-walk-in", { detail: id }))} className="link-button">Edit walk-in</button>;
}

const empty = { name: "", email: "", phone: "", extras: "" };
export function WalkInRegistration({ onChanged }: { onChanged: () => void }) {
  const [profiles, setProfiles] = useState<WalkInProfile[]>([]);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<string | null>(null);
  const [fields, setFields] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [directoryError, setDirectoryError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    setTarget(null); setError("");
    returnFocus.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await (await fetch(`/api/walk-ins?q=${encodeURIComponent(search)}`, { signal: controller.signal })).json();
        if (!controller.signal.aborted) {
          if (!data.success) throw new Error(data.message);
          setProfiles(data.profiles); setDirectoryError("");
        }
      } catch { if (!controller.signal.aborted) setDirectoryError("Could not load walk-in profiles. Change the search to retry."); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, revision]);

  useEffect(() => {
    const refreshProfiles = () => setRevision(value => value + 1);
    window.addEventListener("walk-ins-changed", refreshProfiles);
    return () => window.removeEventListener("walk-ins-changed", refreshProfiles);
  }, []);

  useEffect(() => {
    const edit = (event: Event) => {
      returnFocus.current = document.activeElement as HTMLElement;
      setFields(empty); setError(""); setTarget((event as CustomEvent<string>).detail);
    };
    window.addEventListener("edit-walk-in", edit);
    return () => window.removeEventListener("edit-walk-in", edit);
  }, []);

  useEffect(() => {
    if (!target) return;
    if (target === "new") { nameRef.current?.focus(); return; }
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const data = await (await fetch(`/api/walk-ins/${encodeURIComponent(target)}`, { signal: controller.signal })).json();
        if (!data.success) throw new Error(data.message);
        if (!controller.signal.aborted) { setFields({ name: data.profile.name, email: data.profile.email, phone: data.profile.phone, extras: data.profile.extras }); setTimeout(() => nameRef.current?.focus(), 0); }
      } catch { if (!controller.signal.aborted) setError("Could not load this profile. Close and try again."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [target]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!fields.name.trim() || saving || loading) return;
    setSaving(true); setError("");
    try {
      const creating = target === "new";
      const data = await (await fetch(creating ? "/api/walk-ins" : `/api/walk-ins/${encodeURIComponent(target!)}`, {
        method: creating ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
      })).json();
      if (!data.success) throw new Error(data.message);
      setNotice(data.message); setRevision(value => value + 1); onChanged(); close();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Please retry."); }
    finally { setSaving(false); }
  }

  return <section className="walk-in-section">
    <div className="panel-heading"><div><h2 className="person-name">Visitors without a roll number</h2><p className="muted">No college roll number needed. Only a name is required.</p></div><button type="button" onClick={() => { returnFocus.current = document.activeElement as HTMLElement; setTarget("new"); setFields(empty); setError(""); setLoading(false); }} className="btn btn-primary">Add walk-in</button></div>
    <p className="muted">Edit details here at any time—even during a race or after results are saved. Race times stay unchanged.</p>
    {notice && <p role="status" className="info-box">{notice}</p>}
    <label className="form-label form-group">Find a walk-in<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone or notes" className="field mt-1" /></label>
    {directoryError && <p role="alert" className="error">{directoryError}</p>}
    <div className="profile-list">{profiles.map(profile => <div key={profile.id} className="profile-row"><div className="min-w-0"><p className="person-name">{profile.name}</p><p className="person-meta">{[profile.email, profile.phone].filter(Boolean).join(" · ") || "No contact details added"}</p>{profile.extras && <p className="person-meta whitespace-pre-wrap">{profile.extras}</p>}</div><div className="button-row"><WalkInEditButton id={profile.id} /><button type="button" className="btn btn-small" onClick={async () => {
      try {
        const data = await (await fetch("/api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rollNo: profile.id }) })).json();
        setNotice(data.message || "Registration failed."); if (data.success) onChanged();
      } catch { setNotice("Could not add to queue. Please retry."); }
    }}>Add to queue</button></div></div>)}</div>
    {!profiles.length && !directoryError && <p className="muted">No matching walk-ins yet.</p>}
    {profiles.length === 100 && <p className="muted">Showing 100 matches. Search to narrow the list.</p>}
    {target && <div className="modal-backdrop" onKeyDown={e => {
      if (e.key === "Escape" && !saving) close();
      if (e.key === "Tab") {
        const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)');
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}><div role="dialog" aria-modal="true" aria-labelledby="walk-in-title" className="modal-card">
      <h3 id="walk-in-title" className="person-name">{target === "new" ? "Add a walk-in participant" : "Edit walk-in details"}</h3>
      <p className="muted">{target === "new" ? "Saving adds this person to the waiting queue." : "Changes update the participant’s profile, queue and displayed results. Their identity and race times stay the same."}</p>
      <form onSubmit={save} className="mt-4 space-y-3">
        {([['name', 'Name (required)', 'text'], ['email', 'Email (optional)', 'email'], ['phone', 'Phone number (optional)', 'tel']] as const).map(([key, label, type]) => <label key={key} className="form-label">{label}<input ref={key === "name" ? nameRef : undefined} type={type} required={key === "name"} disabled={loading || saving} maxLength={250} value={fields[key]} onChange={e => setFields(current => ({ ...current, [key]: e.target.value }))} className="field mt-1" /></label>)}
        <label className="form-label">Extras / notes (optional)<textarea disabled={loading || saving} rows={3} maxLength={4000} value={fields.extras} onChange={e => setFields(current => ({ ...current, extras: e.target.value }))} className="field mt-1" /></label>
        {loading && <p role="status" className="muted">Loading profile…</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="button-row justify-end"><button type="button" disabled={saving} onClick={close} className="btn">Cancel</button><button disabled={loading || saving || !fields.name.trim()} className="btn btn-primary">{saving ? "Saving…" : target === "new" ? "Register & add to queue" : "Save changes"}</button></div>
      </form>
    </div></div>}
  </section>;
}
