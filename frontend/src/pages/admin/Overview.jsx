import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import StatusBadge from "@/components/admin/StatusBadge";
import { fmtDateTime } from "@/lib/leadStatus";
import { Building2, Star, Inbox, CalendarCheck, CalendarClock, CheckCircle2, BellRing, Trophy } from "lucide-react";

const settle = (p, fallback) => p.then((r) => r.data).catch(() => fallback);

export default function AdminOverview() {
    const [d, setD] = useState(null);

    useEffect(() => {
        Promise.all([
            settle(api.get("/properties?limit=200"), []),
            settle(api.get("/inquiries"), []),
            settle(api.get("/site-visits/summary"), null),
            settle(api.get("/insights"), null),
        ]).then(([properties, inquiries, visits, insights]) => setD({ properties, inquiries, visits, insights }));
    }, []);

    const props = d?.properties || [];
    const leads = d?.inquiries || [];
    const newLeads = leads.filter((i) => i.status === "new").length;
    const won = d?.insights?.by_status?.closed_won ?? leads.filter((i) => i.status === "closed_won").length;
    const v = d?.visits || {};

    const cards = [
        { label: "Total properties", value: props.length, icon: Building2, to: "/admin/properties", color: "bg-[var(--navy)]" },
        { label: "Featured properties", value: props.filter((p) => p.featured).length, icon: Star, to: "/admin/properties", color: "bg-[var(--gold-dark)]" },
        { label: "New enquiries", value: newLeads, icon: Inbox, to: "/admin/inquiries", color: "bg-emerald-600" },
        { label: "Pending visit requests", value: v.pending, icon: CalendarCheck, to: "/admin/site-visits", color: "bg-amber-500" },
        { label: "Upcoming site visits", value: (v.today || 0) + (v.upcoming || 0), icon: CalendarClock, to: "/admin/site-visits", color: "bg-indigo-600" },
        { label: "Completed site visits", value: v.completed, icon: CheckCircle2, to: "/admin/site-visits", color: "bg-teal-600" },
        { label: "Follow-ups", value: v.followups, icon: BellRing, to: "/admin/site-visits", color: "bg-orange-500", note: v.overdue_followups ? `${v.overdue_followups} overdue` : "" },
        { label: "Closed (won)", value: won, icon: Trophy, to: "/admin/inquiries", color: "bg-slate-700" },
    ];

    return (
        <div data-testid="admin-overview">
            <div className="mb-8">
                <div className="overline">Dashboard</div>
                <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Welcome back</h1>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((c) => (
                    <Link to={c.to} key={c.label} className="p-5 rounded-2xl bg-white border border-slate-200 hover:shadow-md transition-shadow duration-300" data-testid={`stat-${c.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                        <div className={`w-10 h-10 rounded-full ${c.color} text-white grid place-items-center`}><c.icon size={18} /></div>
                        <div className="text-3xl font-serif-display text-[var(--navy)] mt-4">{d ? (c.value ?? "–") : "…"}</div>
                        <div className="text-sm text-slate-500">{c.label}</div>
                        {c.note && <div className="text-xs text-red-600 mt-0.5">{c.note}</div>}
                    </Link>
                ))}
            </div>

            <div className="mt-10 p-6 rounded-2xl bg-white border border-slate-200">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="font-serif-display text-2xl text-[var(--navy)]">Recent inquiries</h2>
                    <Link to="/admin/inquiries" className="text-sm text-[var(--navy)] gold-underline">View all</Link>
                </div>
                {!d ? <div className="h-24 rounded-xl skeleton" /> : leads.length === 0 ? (
                    <div className="text-slate-500 text-sm py-6 text-center">No inquiries yet. New leads from your website will appear here.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {leads.slice(0, 6).map((i) => (
                            <div key={i.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <div className="font-medium text-[var(--navy)]">{i.full_name} · <span className="text-slate-500 text-sm">{i.phone}</span></div>
                                    <div className="text-xs text-slate-500 mt-0.5">{i.inquiry_type}{i.property_name ? ` · ${i.property_name}` : ""}</div>
                                </div>
                                <div className="flex items-center gap-3"><StatusBadge status={i.status} /><span className="text-xs text-slate-400">{fmtDateTime(i.created_at)}</span></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
