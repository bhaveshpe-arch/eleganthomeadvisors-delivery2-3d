import React, { useEffect, useState } from "react";
import { Phone, Mail, MessageCircle, MapPin, CalendarCheck, Users, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import StatusBadge from "@/components/admin/StatusBadge";
import api, { formatApiError } from "@/lib/api";
import { KINDS, STATUSES, fmtDate, fmtDateTime } from "@/lib/leadStatus";

const SLOTS = ["9 AM – 11 AM", "11 AM – 1 PM", "1 PM – 3 PM", "3 PM – 5 PM", "5 PM – 7 PM"];

const Row = ({ label, children }) => (children ? (
    <div className="flex justify-between gap-4 text-sm py-1.5"><dt className="text-slate-500">{label}</dt><dd className="text-right text-[var(--navy)]">{children}</dd></div>
) : null);

/**
 * Full lead view: contact, request details, assignment, status, site visit + follow-up dates,
 * notes and the activity timeline. mode="employee" hides assignment.
 */
export default function LeadDrawer({ lead, onClose, onUpdated, mode = "admin", employees = [] }) {
    const [cur, setCur] = useState(lead);
    const [visitDate, setVisitDate] = useState(lead.site_visit_date || "");
    const [visitTime, setVisitTime] = useState(lead.site_visit_time || "");
    const [followUp, setFollowUp] = useState(lead.follow_up_date || "");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState("");

    useEffect(() => {
        setCur(lead);
        setVisitDate(lead.site_visit_date || "");
        setVisitTime(lead.site_visit_time || "");
        setFollowUp(lead.follow_up_date || "");
    }, [lead]);

    const apply = (data) => { setCur(data); onUpdated?.(data); };
    const run = async (name, fn, okMsg) => {
        setBusy(name);
        try { apply(await fn()); if (okMsg) toast.success(okMsg); }
        catch (e) { toast.error(formatApiError(e.response?.data?.detail) || "That didn't save. Please try again."); }
        finally { setBusy(""); }
    };

    const setStatus = (status) => run("status", async () => (await api.patch(`/inquiries/${cur.id}/status`, { status })).data, "Status updated");
    const assign = (employee_id) => run("assign", async () => (await api.patch(`/inquiries/${cur.id}/assign`, { employee_id: employee_id || null })).data, employee_id ? "Lead assigned" : "Lead unassigned");
    const saveSchedule = () => run("schedule", async () => (await api.patch(`/inquiries/${cur.id}/schedule`, {
        site_visit_date: visitDate, site_visit_time: visitTime, follow_up_date: followUp,
    })).data, "Dates saved");
    const addNote = async () => {
        if (!note.trim()) return;
        await run("note", async () => (await api.post(`/inquiries/${cur.id}/notes`, { text: note.trim() })).data, "Note added");
        setNote("");
    };

    const phoneDigits = (cur.phone || "").replace(/\D/g, "").slice(-10);
    const scheduleChanged = visitDate !== (cur.site_visit_date || "") || visitTime !== (cur.site_visit_time || "") || followUp !== (cur.follow_up_date || "");

    return (
        <Sheet open onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="lead-drawer">
                <SheetHeader>
                    <SheetTitle className="font-serif-display text-3xl text-[var(--navy)] text-left">{cur.full_name}</SheetTitle>
                    <SheetDescription className="text-left flex flex-wrap items-center gap-2">
                        <StatusBadge status={cur.status} />
                        <span className="text-xs">{KINDS[cur.kind] || "Enquiry"} · received {fmtDateTime(cur.created_at)}</span>
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-5 grid grid-cols-3 gap-2">
                    <a href={`tel:${cur.phone}`} className="flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl bg-[var(--navy)] text-white"><Phone size={14} /> Call</a>
                    <a href={`https://wa.me/91${phoneDigits}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl bg-[#25D366] text-white"><MessageCircle size={14} /> WhatsApp</a>
                    {cur.email ? <a href={`mailto:${cur.email}`} className="flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-slate-300 text-slate-700"><Mail size={14} /> Email</a> : <span />}
                </div>

                <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
                    <Row label="Phone">{cur.phone}</Row>
                    <Row label="Email">{cur.email}</Row>
                    <Row label="Property">{cur.property_name}</Row>
                    <Row label="Area">{cur.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{cur.location}</span>}</Row>
                    <Row label="Source">{(cur.source || "").replace(/_/g, " ")}</Row>
                    <Row label="Preferred visit">{cur.preferred_date && `${fmtDate(cur.preferred_date)}${cur.preferred_time ? `, ${cur.preferred_time}` : ""}`}</Row>
                    {cur.visit_type && <Row label="Visit type"><span className="font-medium text-[var(--gold-dark)]">{cur.visit_type === "home_visit" ? "Home Visit" : "Site Visit"}</span></Row>}
                    {cur.home_address && <Row label="Home address"><span className="text-slate-800 font-medium">{cur.home_address}</span></Row>}
                    <Row label="Alternate">{cur.alternate_date && `${fmtDate(cur.alternate_date)}${cur.alternate_time ? `, ${cur.alternate_time}` : ""}`}</Row>
                    <Row label="Visitors">{cur.visitors > 0 ? String(cur.visitors) : ""}</Row>
                </dl>
                {cur.message && <div className="mt-3 text-sm text-slate-700 bg-slate-50 rounded-xl p-3 whitespace-pre-line">{cur.message}</div>}

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs text-slate-600">Status
                        <select value={cur.status || "new"} onChange={(e) => setStatus(e.target.value)} disabled={busy === "status"} className="field-input mt-1 bg-white" data-testid="drawer-status">
                            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </label>
                    {mode === "admin" && (
                        <label className="text-xs text-slate-600"><span className="inline-flex items-center gap-1"><Users size={12} /> Assigned to</span>
                            <select value={cur.assigned_employee_id || ""} onChange={(e) => assign(e.target.value)} disabled={busy === "assign"} className="field-input mt-1 bg-white" data-testid="drawer-assign">
                                <option value="">Unassigned</option>
                                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </label>
                    )}
                </div>

                <div className="mt-6 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2 font-medium text-[var(--navy)] text-sm"><CalendarCheck size={16} className="text-[var(--gold-dark)]" /> Site visit &amp; follow-up</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <label className="text-xs text-slate-600">Site visit date
                            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="field-input mt-1" data-testid="drawer-visit-date" />
                        </label>
                        <label className="text-xs text-slate-600">Time
                            <input list="slot-list" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} placeholder="e.g. 11:30 AM" className="field-input mt-1" data-testid="drawer-visit-time" />
                            <datalist id="slot-list">{SLOTS.map((s) => <option key={s} value={s} />)}</datalist>
                        </label>
                        <label className="text-xs text-slate-600 sm:col-span-2">Follow-up date
                            <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="field-input mt-1" data-testid="drawer-followup-date" />
                        </label>
                    </div>
                    <button type="button" onClick={saveSchedule} disabled={!scheduleChanged || busy === "schedule"} className="btn-primary text-sm mt-3 disabled:opacity-50" data-testid="drawer-save-dates">
                        <Save size={14} /> Save dates
                    </button>
                </div>

                <div className="mt-6">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Add a note</div>
                    <div className="flex gap-2">
                        <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} maxLength={500} placeholder="What happened on the call or visit?" className="field-input" aria-label="Note" />
                        <button type="button" onClick={addNote} disabled={busy === "note" || !note.trim()} className="btn-outline-gold text-sm disabled:opacity-50" aria-label="Add note"><Send size={14} /></button>
                    </div>
                </div>

                <div className="mt-6 pb-8">
                    <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Activity</div>
                    {(cur.activity || []).length === 0 ? (
                        <p className="text-sm text-slate-400">No activity recorded for this lead yet.</p>
                    ) : (
                        <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                            {cur.activity.map((a, i) => (
                                <li key={i} className="pl-5 relative">
                                    <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--gold)]" aria-hidden="true" />
                                    <div className="text-sm text-slate-800">{a.text}</div>
                                    <div className="text-[11px] text-slate-400">{fmtDateTime(a.at)}{a.by && a.by !== "system" ? ` · ${a.by}` : ""}</div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
