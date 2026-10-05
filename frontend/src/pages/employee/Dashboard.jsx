import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { enablePushNotifications, isPushEnabled } from "@/lib/push";
import { Phone, Mail, MessageCircle, Bell, BellOff, MapPin, CalendarCheck, BellRing, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import LeadDrawer from "@/components/admin/LeadDrawer";
import StatusBadge from "@/components/admin/StatusBadge";
import { CLOSED, KINDS, STATUSES, fmtDate, todayIST } from "@/lib/leadStatus";

function timeAgo(iso) {
    if (!iso) return "";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
}

function LeadCard({ lead, onOpen, onChange }) {
    const wa = `https://wa.me/91${lead.phone.replace(/\D/g, "").slice(-10)}`;
    const today = todayIST();
    const setStatus = async (value) => {
        try {
            const { data } = await api.patch(`/inquiries/${lead.id}/status`, { status: value });
            onChange(data);
            toast.success("Status updated");
        } catch (e) {
            toast.error(formatApiError(e.response?.data?.detail) || "Couldn't update status");
        }
    };
    const overdue = lead.follow_up_date && lead.follow_up_date < today && !CLOSED.includes(lead.status);

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4" data-testid={`lead-${lead.id}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-medium text-[var(--navy)]">{lead.full_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{KINDS[lead.kind] || "Enquiry"}{lead.property_name ? ` · ${lead.property_name}` : ""}</div>
                    {lead.location && <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><MapPin size={11} /> {lead.location}</div>}
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo(lead.created_at)}</span>
            </div>

            {(lead.site_visit_date || (lead.kind === "site_visit" && lead.preferred_date) || lead.follow_up_date) && (
                <div className="mt-3 text-xs space-y-1">
                    {lead.site_visit_date
                        ? <div className="flex items-center gap-1.5 text-indigo-700"><CalendarCheck size={13} /> Visit {fmtDate(lead.site_visit_date)}{lead.site_visit_time ? `, ${lead.site_visit_time}` : ""}</div>
                        : lead.kind === "site_visit" && lead.preferred_date && <div className="flex items-center gap-1.5 text-amber-700"><CalendarCheck size={13} /> Requested {fmtDate(lead.preferred_date)}{lead.preferred_time ? `, ${lead.preferred_time}` : ""}</div>}
                    {lead.follow_up_date && <div className={`flex items-center gap-1.5 ${overdue ? "text-red-600" : "text-slate-600"}`}><BellRing size={13} /> Follow-up {fmtDate(lead.follow_up_date)}{overdue ? " (overdue)" : ""}</div>}
                </div>
            )}

            <div className="flex items-center gap-2 mt-3">
                <a href={`tel:${lead.phone}`} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl bg-[var(--navy)] text-white"><Phone size={13} /> Call</a>
                <a href={wa} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl bg-[#25D366] text-white"><MessageCircle size={13} /> WhatsApp</a>
                {lead.email && <a href={`mailto:${lead.email}`} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border border-slate-300 text-slate-600"><Mail size={13} /> Email</a>}
            </div>
            {lead.message && <div className="text-xs text-slate-600 mt-3 bg-slate-50 rounded-xl p-2.5 line-clamp-3">{lead.message}</div>}

            <div className="flex items-center justify-between gap-2 mt-3">
                <select value={lead.status} onChange={(e) => setStatus(e.target.value)} aria-label="Lead status" className="text-xs rounded-full px-3 py-1.5 border border-slate-200 bg-white" data-testid={`lead-status-${lead.id}`}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button type="button" onClick={() => onOpen(lead)} className="text-xs text-[var(--navy)] inline-flex items-center gap-1" data-testid={`lead-open-${lead.id}`}>Dates, notes &amp; history <ChevronRight size={13} /></button>
            </div>
        </div>
    );
}

export default function EmployeeDashboard() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [filter, setFilter] = useState("open");
    const [pushOn, setPushOn] = useState(false);
    const [open, setOpen] = useState(null);

    const load = useCallback(() => api.get("/inquiries/mine")
        .then((r) => { setLeads(r.data); setFailed(false); })
        .catch(() => setFailed(true))
        .finally(() => setLoading(false)), []);

    useEffect(() => {
        load();
        isPushEnabled().then(setPushOn);
        const t = setInterval(load, 45000); // fallback in case a push notification doesn't arrive
        return () => clearInterval(t);
    }, [load]);

    const turnOnAlerts = async () => {
        try { await enablePushNotifications(); setPushOn(true); toast.success("Lead alerts turned on"); }
        catch (e) { toast.error(e.message || "Couldn't enable notifications"); }
    };

    const updateLead = (u) => setLeads((prev) => prev.map((l) => (l.id === u.id ? u : l)));
    const today = todayIST();

    const counts = useMemo(() => ({
        visits: leads.filter((l) => l.site_visit_date === today && l.status !== "site_visit_cancelled").length,
        followups: leads.filter((l) => l.follow_up_date && l.follow_up_date <= today && !CLOSED.includes(l.status)).length,
    }), [leads, today]);

    const filtered = useMemo(() => {
        if (filter === "all") return leads;
        if (filter === "open") return leads.filter((l) => !CLOSED.includes(l.status));
        if (filter === "visits_today") return leads.filter((l) => l.site_visit_date === today && l.status !== "site_visit_cancelled");
        if (filter === "upcoming") return leads.filter((l) => l.site_visit_date > today && ["site_visit_scheduled", "site_visit_requested"].includes(l.status));
        if (filter === "followups") return leads.filter((l) => l.follow_up_date && !CLOSED.includes(l.status)).sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));
        return leads.filter((l) => l.status === filter);
    }, [leads, filter, today]);

    const tabs = [
        { value: "open", label: "Open" },
        { value: "visits_today", label: `Visits today${counts.visits ? ` (${counts.visits})` : ""}` },
        { value: "upcoming", label: "Upcoming visits" },
        { value: "followups", label: `Follow-ups${counts.followups ? ` (${counts.followups} due)` : ""}` },
        { value: "all", label: "All" },
        ...STATUSES.map((s) => ({ value: s.value, label: s.label })),
    ];
    const emptyText = { visits_today: "You currently have no scheduled site visits today.", upcoming: "No upcoming site visits.", followups: "No follow-ups set." }[filter] || "No leads here yet.";

    return (
        <div data-testid="employee-dashboard">
            {!pushOn && (
                <button onClick={turnOnAlerts} className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 mb-4" data-testid="enable-push">
                    <Bell size={14} /> Turn on lead alerts on this phone
                </button>
            )}

            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1" role="tablist" aria-label="Lead views">
                {tabs.map((t) => (
                    <button key={t.value} role="tab" aria-selected={filter === t.value} onClick={() => setFilter(t.value)}
                        className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border ${filter === t.value ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-slate-200 text-slate-600 bg-white"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl skeleton" />)}</div>
            ) : failed && leads.length === 0 ? (
                <div role="alert" className="text-center text-slate-600 text-sm py-10">
                    We couldn't load your leads. <button className="underline" onClick={load}>Try again</button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-10 flex flex-col items-center gap-2"><BellOff size={20} /> {emptyText}</div>
            ) : (
                <div className="space-y-3">{filtered.map((lead) => <LeadCard key={lead.id} lead={lead} onChange={updateLead} onOpen={setOpen} />)}</div>
            )}
            {open && <LeadDrawer mode="employee" lead={leads.find((l) => l.id === open.id) || open} onClose={() => setOpen(null)} onUpdated={updateLead} />}
        </div>
    );
}
