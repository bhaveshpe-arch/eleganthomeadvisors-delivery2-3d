import React, { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarClock, Hourglass, CheckCircle2, XCircle, BellRing, Search, Phone } from "lucide-react";
import api from "@/lib/api";
import LeadDrawer from "@/components/admin/LeadDrawer";
import StatusBadge from "@/components/admin/StatusBadge";
import { STATUSES, fmtDate } from "@/lib/leadStatus";

const SCOPES = [
    { key: "today", label: "Today", icon: CalendarCheck, tone: "bg-indigo-600" },
    { key: "upcoming", label: "Upcoming", icon: CalendarClock, tone: "bg-[var(--navy)]" },
    { key: "pending", label: "Pending requests", icon: Hourglass, tone: "bg-amber-500" },
    { key: "completed", label: "Completed", icon: CheckCircle2, tone: "bg-emerald-600" },
    { key: "cancelled", label: "Cancelled", icon: XCircle, tone: "bg-rose-500" },
    { key: "followups", label: "Follow-ups", icon: BellRing, tone: "bg-orange-500" },
];
const EMPTY = {
    today: "You currently have no site visits scheduled for today.",
    upcoming: "No upcoming site visits yet.",
    pending: "No pending requests. New requests from the website will show up here.",
    completed: "No completed visits yet.",
    cancelled: "No cancelled visits.",
    followups: "No follow-ups are set.",
};

export default function AdminSiteVisits() {
    const [scope, setScope] = useState("today");
    const [summary, setSummary] = useState(null);
    const [items, setItems] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [state, setState] = useState("loading");
    const [f, setF] = useState({ employee_id: "", property_id: "", status: "", date_from: "", date_to: "", q: "" });
    const [properties, setProperties] = useState([]);
    const [open, setOpen] = useState(null);

    const loadSummary = useCallback(() => api.get("/site-visits/summary", { params: f.employee_id ? { employee_id: f.employee_id } : {} }).then((r) => setSummary(r.data)).catch(() => {}), [f.employee_id]);
    const load = useCallback(() => {
        setState("loading");
        const params = { scope, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) };
        api.get("/site-visits", { params }).then((r) => { setItems(r.data); setState("ready"); }).catch(() => setState("error"));
    }, [scope, f]);

    useEffect(() => {
        api.get("/employees").then((r) => setEmployees(r.data)).catch(() => {});
        api.get("/properties?limit=200&sort=newest").then((r) => setProperties(r.data)).catch(() => {});
    }, []);
    useEffect(() => { loadSummary(); }, [loadSummary]);
    useEffect(() => { const t = setTimeout(load, f.q ? 300 : 0); return () => clearTimeout(t); }, [load, f.q]);

    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
    const onUpdated = (u) => { setItems((prev) => prev.map((x) => (x.id === u.id ? u : x))); loadSummary(); };
    const overdue = summary?.overdue_followups || 0;

    return (
        <div data-testid="admin-site-visits">
            <div className="mb-8">
                <div className="overline">Visits &amp; follow-ups</div>
                <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Site Visits</h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6" role="tablist" aria-label="Visit views">
                {SCOPES.map((s) => (
                    <button key={s.key} role="tab" aria-selected={scope === s.key} onClick={() => setScope(s.key)} data-testid={`visit-tab-${s.key}`}
                        className={`text-left p-4 rounded-2xl border bg-white transition ${scope === s.key ? "border-[var(--navy)] shadow-md" : "border-slate-200 hover:border-slate-300"}`}>
                        <span className={`w-9 h-9 rounded-full ${s.tone} text-white grid place-items-center`}><s.icon size={17} /></span>
                        <div className="text-3xl font-serif-display text-[var(--navy)] mt-3">{summary ? summary[s.key] : "–"}</div>
                        <div className="text-xs text-slate-500">{s.label}{s.key === "followups" && overdue > 0 && <span className="text-red-600"> · {overdue} overdue</span>}</div>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
                <div className="relative lg:col-span-2">
                    <Search size={16} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
                    <input aria-label="Search customer" value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Customer name, phone or email" className="field-input !pl-9" />
                </div>
                <select aria-label="Employee" value={f.employee_id} onChange={(e) => set("employee_id", e.target.value)} className="field-input bg-white">
                    <option value="">All employees</option><option value="unassigned">Unassigned</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select aria-label="Property" value={f.property_id} onChange={(e) => set("property_id", e.target.value)} className="field-input bg-white">
                    <option value="">All properties</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select aria-label="Status" value={f.status} onChange={(e) => set("status", e.target.value)} className="field-input bg-white">
                    <option value="">Any status</option>{STATUSES.filter((s) => s.value.startsWith("site_visit")).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                    <input aria-label="From date" type="date" value={f.date_from} onChange={(e) => set("date_from", e.target.value)} className="field-input" />
                    <input aria-label="To date" type="date" value={f.date_to} onChange={(e) => set("date_to", e.target.value)} className="field-input" />
                </div>
            </div>

            {state === "loading" && <div className="h-48 rounded-2xl skeleton" aria-busy="true" />}
            {state === "error" && (
                <div role="alert" className="bg-white rounded-2xl border border-slate-200 text-center py-12">
                    <p>We couldn't load the visits.</p><button className="btn-primary mt-4" onClick={load}>Try again</button>
                </div>
            )}
            {state === "ready" && items.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 text-center py-14 text-slate-500">{EMPTY[scope]}</div>
            )}
            {state === "ready" && items.length > 0 && (
                <ul className="space-y-3">
                    {items.map((i) => (
                        <li key={i.id}>
                            <button type="button" onClick={() => setOpen(i)} className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-[var(--gold)] p-4 md:p-5 grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_1fr_auto] gap-3 items-center" data-testid={`visit-${i.id}`}>
                                <div>
                                    <div className="font-medium text-[var(--navy)]">{i.full_name}</div>
                                    <div className="text-xs text-slate-500 inline-flex items-center gap-1 mt-0.5"><Phone size={11} /> {i.phone}</div>
                                </div>
                                <div className="text-sm text-slate-700">
                                    <div>{i.property_name || "—"}</div>
                                    <div className="text-xs text-slate-500">{i.location}</div>
                                </div>
                                <div className="text-xs text-slate-600">
                                    {scope === "followups" ? <div>Follow-up {fmtDate(i.follow_up_date)}</div> : i.site_visit_date
                                        ? <div className="font-medium text-[var(--navy)]">{fmtDate(i.site_visit_date)}{i.site_visit_time ? ` · ${i.site_visit_time}` : ""}</div>
                                        : <div>Wants {fmtDate(i.preferred_date)}{i.preferred_time ? ` · ${i.preferred_time}` : ""}</div>}
                                    <div className="mt-0.5">{i.assigned_employee_name || <span className="text-amber-700">Unassigned</span>}{i.visitors > 0 ? ` · ${i.visitors} visitor${i.visitors > 1 ? "s" : ""}` : ""}</div>
                                </div>
                                <StatusBadge status={i.status} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {open && <LeadDrawer lead={items.find((x) => x.id === open.id) || open} employees={employees} onClose={() => setOpen(null)} onUpdated={onUpdated} />}
        </div>
    );
}
