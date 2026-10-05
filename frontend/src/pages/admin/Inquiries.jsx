import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Download, Trash2, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import LeadDrawer from "@/components/admin/LeadDrawer";
import StatusBadge from "@/components/admin/StatusBadge";
import { KINDS, STATUSES, fmtDate, fmtDateTime } from "@/lib/leadStatus";

const PAGE = 40;

export default function AdminInquiries() {
    const [items, setItems] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [state, setState] = useState("loading");
    const [f, setF] = useState({ q: "", status: "", employee: "", kind: "", property: "", sort: "newest" });
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(null);
    const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setPage(1); };

    const load = () => {
        setState("loading");
        api.get("/inquiries").then((r) => { setItems(r.data); setState("ready"); }).catch(() => setState("error"));
    };
    useEffect(() => { load(); api.get("/employees").then((r) => setEmployees(r.data)).catch(() => {}); }, []);

    const replace = (updated) => setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    const properties = useMemo(() => [...new Set(items.map((i) => i.property_name).filter(Boolean))].sort(), [items]);

    const del = async (i) => {
        if (!window.confirm(`Delete the inquiry from ${i.full_name}? This can't be undone.`)) return;
        try { await api.delete(`/inquiries/${i.id}`); toast.success("Deleted"); setItems((p) => p.filter((x) => x.id !== i.id)); }
        catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    };

    const filtered = useMemo(() => {
        const q = f.q.trim().toLowerCase();
        const out = items.filter((i) =>
            (!q || [i.full_name, i.phone, i.email, i.property_name, i.location].some((v) => (v || "").toLowerCase().includes(q))) &&
            (!f.status || i.status === f.status) &&
            (!f.kind || (i.kind || "enquiry") === f.kind) &&
            (!f.property || i.property_name === f.property) &&
            (!f.employee || (f.employee === "unassigned" ? !i.assigned_employee_id : i.assigned_employee_id === f.employee)));
        out.sort((a, b) => (f.sort === "oldest" ? 1 : -1) * ((a.created_at || "") < (b.created_at || "") ? -1 : 1));
        return out;
    }, [items, f]);
    const shown = filtered.slice(0, page * PAGE);

    const downloadCSV = async () => {
        try {
            const { data } = await api.get("/inquiries/export.csv", { responseType: "blob" });   // authenticated, token never put in a URL
            const url = URL.createObjectURL(data);
            const a = Object.assign(document.createElement("a"), { href: url, download: "elegant-inquiries.csv" });
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } catch { toast.error("Couldn't download the file. Please try again."); }
    };

    return (
        <div data-testid="admin-inquiries">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <div>
                    <div className="overline">Leads</div>
                    <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Inquiries</h1>
                </div>
                <button onClick={downloadCSV} className="btn-outline-gold" data-testid="export-csv"><Download size={16} /> Export CSV</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
                <div className="relative lg:col-span-2">
                    <Search size={16} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
                    <input value={f.q} onChange={(e) => set("q", e.target.value)} aria-label="Search leads" placeholder="Search name, phone, email, property…" className="field-input !pl-9" data-testid="inq-search" />
                </div>
                <select aria-label="Status" value={f.status} onChange={(e) => set("status", e.target.value)} className="field-input bg-white">
                    <option value="">All statuses</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select aria-label="Employee" value={f.employee} onChange={(e) => set("employee", e.target.value)} className="field-input bg-white">
                    <option value="">All employees</option><option value="unassigned">Unassigned</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select aria-label="Request type" value={f.kind} onChange={(e) => set("kind", e.target.value)} className="field-input bg-white">
                    <option value="">All request types</option>{Object.entries(KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select aria-label="Sort" value={f.sort} onChange={(e) => set("sort", e.target.value)} className="field-input bg-white">
                    <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
                </select>
                {properties.length > 0 && (
                    <select aria-label="Property" value={f.property} onChange={(e) => set("property", e.target.value)} className="field-input bg-white lg:col-span-2">
                        <option value="">All properties</option>{properties.map((p) => <option key={p}>{p}</option>)}
                    </select>
                )}
            </div>

            {state === "loading" && <div className="h-64 rounded-2xl skeleton" aria-busy="true" />}
            {state === "error" && (
                <div role="alert" className="bg-white rounded-2xl border border-slate-200 text-center py-14">
                    <p className="text-slate-700">We couldn't load the inquiries.</p>
                    <button className="btn-primary mt-4" onClick={load}>Try again</button>
                </div>
            )}
            {state === "ready" && (
                <div className="relative bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm min-w-[1050px]">
                        <caption className="sr-only">Customer inquiries</caption>
                        <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-widest">
                            <tr>
                                <th scope="col" className="text-left px-5 py-3">Received</th>
                                <th scope="col" className="text-left px-5 py-3">Customer</th>
                                <th scope="col" className="text-left px-5 py-3">Property</th>
                                <th scope="col" className="text-left px-5 py-3">Type</th>
                                <th scope="col" className="text-left px-5 py-3">Assigned</th>
                                <th scope="col" className="text-left px-5 py-3">Status</th>
                                <th scope="col" className="text-left px-5 py-3">Visit / follow-up</th>
                                <th scope="col" className="text-right px-5 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map((i) => (
                                <tr key={i.id} data-testid={`inq-row-${i.id}`}>
                                    <td className="px-5 py-3 text-slate-600 text-xs whitespace-nowrap">{fmtDateTime(i.created_at)}</td>
                                    <td className="px-5 py-3">
                                        <div className="font-medium text-[var(--navy)] whitespace-nowrap">{i.full_name}</div>
                                        <div className="text-xs text-slate-500">{i.phone}</div>
                                    </td>
                                    <td className="px-5 py-3">{i.property_name || i.inquiry_type || "—"}<div className="text-xs text-slate-400">{i.location}</div></td>
                                    <td className="px-5 py-3 text-xs">{KINDS[i.kind] || "Enquiry"}</td>
                                    <td className="px-5 py-3 text-xs">{i.assigned_employee_name || <span className="text-slate-400">Unassigned</span>}</td>
                                    <td className="px-5 py-3"><StatusBadge status={i.status} /></td>
                                    <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                                        {i.site_visit_date ? <div>Visit {fmtDate(i.site_visit_date)}{i.site_visit_time ? `, ${i.site_visit_time}` : ""}</div> : i.preferred_date && i.kind === "site_visit" ? <div className="text-amber-700">Wants {fmtDate(i.preferred_date)}</div> : null}
                                        {i.follow_up_date && <div>Follow-up {fmtDate(i.follow_up_date)}</div>}
                                    </td>
                                    <td className="px-5 py-3 text-right whitespace-nowrap">
                                        <button onClick={() => setOpen(i)} aria-label={`Open ${i.full_name}`} className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg" data-testid={`inq-open-${i.id}`}><Eye size={16} /></button>
                                        <button onClick={() => del(i)} aria-label={`Delete ${i.full_name}`} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <tr><td colSpan="8" className="text-center py-12 text-slate-500">{items.length ? "No inquiries match these filters." : "No inquiries yet. New leads from your website will appear here."}</td></tr>}
                        </tbody>
                    </table>
                    {filtered.length > shown.length && (
                        <div className="p-4 text-center border-t border-slate-100">
                            <button className="btn-outline-gold text-sm" onClick={() => setPage((p) => p + 1)}>Show more ({filtered.length - shown.length} left)</button>
                        </div>
                    )}
                </div>
            )}
            {open && <LeadDrawer lead={items.find((x) => x.id === open.id) || open} employees={employees} onClose={() => setOpen(null)} onUpdated={replace} />}
        </div>
    );
}
