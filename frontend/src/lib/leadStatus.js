// Lead statuses, kinds and date helpers shared by the admin screens.
export const STATUSES = [
    { value: "new", label: "New", cls: "bg-slate-100 text-slate-700" },
    { value: "contacted", label: "Contacted", cls: "bg-blue-100 text-blue-700" },
    { value: "site_visit_requested", label: "Site visit requested", cls: "bg-amber-100 text-amber-800" },
    { value: "site_visit_scheduled", label: "Site visit scheduled", cls: "bg-indigo-100 text-indigo-700" },
    { value: "site_visit_completed", label: "Site visit completed", cls: "bg-teal-100 text-teal-700" },
    { value: "site_visit_cancelled", label: "Site visit cancelled", cls: "bg-rose-100 text-rose-700" },
    { value: "follow_up_required", label: "Follow-up required", cls: "bg-orange-100 text-orange-700" },
    { value: "negotiation", label: "Negotiation", cls: "bg-purple-100 text-purple-700" },
    { value: "closed_won", label: "Closed · won", cls: "bg-emerald-100 text-emerald-700" },
    { value: "closed_lost", label: "Closed · lost", cls: "bg-red-100 text-red-700" },
];
export const CLOSED = ["closed_won", "closed_lost"];
export const statusMeta = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0];

export const KINDS = { enquiry: "Enquiry", site_visit: "Site visit", callback: "Callback", brochure: "Brochure", whatsapp: "WhatsApp" };

/** "2026-01-05" -> "05 Jan 2026" */
export const fmtDate = (d) => {
    if (!d) return "—";
    const [y, m, day] = String(d).split("-").map(Number);
    if (!y || !m || !day) return d;
    return new Date(y, m - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
        .replace(/\b(am|pm)\b/g, (m) => m.toUpperCase());
};

/** Today's date in India, as YYYY-MM-DD (matches what the server uses). */
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
