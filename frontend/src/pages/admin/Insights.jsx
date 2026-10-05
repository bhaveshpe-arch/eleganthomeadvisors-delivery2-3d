import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

import { STATUSES } from "@/lib/leadStatus";

const STATUS_LABELS = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

const EVENT_LABELS = {
    property_view: "Property views", enquiry_submitted: "Enquiries sent", site_visit_requested: "Site visits requested",
    callback_requested: "Callbacks requested", whatsapp_click: "WhatsApp clicks", call_click: "Call clicks",
    brochure_download: "Brochure downloads", property_saved: "Properties saved", property_compared: "Added to compare",
    contact_revealed: "Contact details shown",
};

function TopList({ title, rows }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="font-serif-display text-xl text-[var(--navy)] mb-3">{title}</div>
            {!rows?.length ? <div className="text-sm text-slate-400 py-4">Nothing recorded yet.</div> : (
                <ol className="space-y-2">
                    {rows.map((r, i) => (
                        <li key={r.property_id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-700 truncate"><span className="text-slate-400 mr-2">{i + 1}.</span>{r.name}</span>
                            <span className="font-medium text-[var(--navy)]">{r.count}</span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

const toChartData = (obj) => Object.entries(obj || {}).map(([name, count]) => ({ name, count }));

export default function AdminInsights() {
    const [data, setData] = useState(null);
    const [usage, setUsage] = useState(null);
    const [days, setDays] = useState(30);

    useEffect(() => { api.get("/insights").then((r) => setData(r.data)).catch(() => {}); }, []);
    useEffect(() => { api.get("/analytics/summary", { params: { days } }).then((r) => setUsage(r.data)).catch(() => setUsage(null)); }, [days]);

    if (!data) return <div className="p-10 text-center text-slate-500">Loading insights…</div>;

    const cards = [
        { label: "Total leads", value: data.total },
        { label: "Unassigned", value: data.unassigned },
        { label: "Conversion rate", value: `${data.conversion_rate}%` },
    ];

    const byLocation = toChartData(data.by_location);
    const byEmployee = toChartData(data.by_employee);
    const byStatus = Object.entries(data.by_status || {}).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, count: v }));

    return (
        <div data-testid="admin-insights">
            <div className="mb-8">
                <div className="overline">Performance</div>
                <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Insights</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                {cards.map((c) => (
                    <div key={c.label} className="p-6 rounded-2xl bg-white border border-slate-200">
                        <div className="text-3xl font-serif-display text-[var(--navy)]">{c.value}</div>
                        <div className="text-sm text-slate-500">{c.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="font-serif-display text-xl text-[var(--navy)] mb-4">Leads by location</div>
                    {byLocation.length === 0 ? <div className="text-sm text-slate-400 py-10 text-center">No data yet.</div> : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={byLocation} layout="vertical" margin={{ left: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#0A192F" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="font-serif-display text-xl text-[var(--navy)] mb-4">Leads by employee</div>
                    {byEmployee.length === 0 ? <div className="text-sm text-slate-400 py-10 text-center">No leads assigned yet.</div> : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={byEmployee} layout="vertical" margin={{ left: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#C5A880" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:col-span-2">
                    <div className="font-serif-display text-xl text-[var(--navy)] mb-4">Pipeline by stage</div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={byStatus}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#0A192F" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="flex items-end justify-between flex-wrap gap-3 mt-12 mb-5">
                <div>
                    <div className="overline">Website activity</div>
                    <h2 className="font-serif-display text-3xl text-[var(--navy)] mt-1">What visitors do</h2>
                    <p className="text-xs text-slate-500 mt-1">Counts only. No names, IP addresses or cookies are stored.</p>
                </div>
                <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="field-input !w-auto bg-white">
                    {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
                </select>
            </div>
            {usage && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                        {Object.entries(EVENT_LABELS).map(([k, label]) => (
                            <div key={k} className="p-4 rounded-2xl bg-white border border-slate-200">
                                <div className="text-2xl font-serif-display text-[var(--navy)]">{usage.event_totals?.[k] ?? 0}</div>
                                <div className="text-xs text-slate-500">{label}</div>
                            </div>
                        ))}
                        <div className="p-4 rounded-2xl bg-white border border-slate-200">
                            <div className="text-2xl font-serif-display text-[var(--navy)]">{usage.conversion_rate}%</div>
                            <div className="text-xs text-slate-500">Lead conversion ({usage.closed_won} of {usage.leads})</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <TopList title="Most viewed properties" rows={usage.top_viewed} />
                        <TopList title="Most enquired properties" rows={usage.top_enquired} />
                        <TopList title="Most shortlisted" rows={usage.top_shortlisted} />
                        <TopList title="Most requested site visits" rows={usage.top_site_visits} />
                        <TopList title="Most compared" rows={usage.top_compared} />
                    </div>
                </>
            )}
        </div>
    );
}
