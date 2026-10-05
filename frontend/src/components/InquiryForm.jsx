import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { track } from "@/lib/track";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ContactPanel from "@/components/ContactPanel";

const TYPES = ["Presidential Properties", "Under Construction", "Ready to Move"];

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";

    const value = `${String(hour).padStart(2, "0")}:${minute}`;

    const displayHour = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";

    return {
        value,
        label: `${displayHour}:${minute} ${ampm}`,
    };
});

export default function InquiryForm({ property, defaultType, variant = "card" }) {
    const [form, setForm] = useState({
        inquiry_type: defaultType || property?.category || "Ready to Move",
        full_name: "",
        phone: "",
        email: "",
        preferred_date: "",
        preferred_time: "",
        message: "",
        location: "",
    });
    const [locations, setLocations] = useState([]);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!property) {
            api.get("/locations").then((r) => setLocations(r.data)).catch(() => {});
        }
    }, [property]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const validate = () => {
        const e = {};
        if (!form.full_name.trim()) e.full_name = "Full name is required";
        if (!/^[\d\s+()-]{10,}$/.test(form.phone) || form.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a valid 10-digit mobile number";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = "Enter a valid email";
        if (!form.inquiry_type) e.inquiry_type = "Select an inquiry type";
        if (!property && locations.length > 0 && !form.location) e.location = "Select the area you're interested in";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const submit = async (ev) => {
        ev.preventDefault();
        if (!validate()) return;
        setBusy(true);
        try {
            await api.post("/inquiries", {
                ...form,
                location: property ? "" : form.location,
                property_id: property?.id || "",
                property_name: property?.name || "",
                kind: "enquiry",
                source: property ? "property_page_form" : "contact_page",
            });
            track("enquiry_submitted", property?.id || "");
            setSent(true);
            setForm((f) => ({ ...f, full_name: "", phone: "", email: "", preferred_date: "", preferred_time: "", message: "", location: "" }));
        } catch (err) {
            toast.error(err.response?.data?.detail || "Something went wrong. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    const wrapCls = variant === "card"
        ? "bg-white rounded-2xl border border-slate-200 p-7 shadow-sm"
        : "";

    return (
        <>
        <form onSubmit={submit} className={wrapCls} data-testid="inquiry-form">
            <div className="overline">Express your interest</div>
            <h3 className="font-serif-display text-2xl text-[var(--navy)] mt-1 mb-5">Schedule a Private Visit</h3>

            <div className="grid grid-cols-1 gap-3">
                <div>
                    <label className="text-xs text-slate-600">Inquiry Type</label>
                    <select
                        value={form.inquiry_type}
                        onChange={(e) => set("inquiry_type", e.target.value)}
                        className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                        data-testid="inq-type"
                    >
                        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                {!property && locations.length > 0 && (
                    <div>
                        <label className="text-xs text-slate-600">Area of interest</label>
                        <select
                            value={form.location}
                            onChange={(e) => set("location", e.target.value)}
                            className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                            data-testid="inq-location"
                        >
                            <option value="">Select area</option>
                            {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                        </select>
                        {errors.location && <div className="text-xs text-red-500 mt-1">{errors.location}</div>}
                    </div>
                )}

                <div>
                    <input
                        type="text" placeholder="Full Name" value={form.full_name}
                        onChange={(e) => set("full_name", e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                        data-testid="inq-name"
                    />
                    {errors.full_name && <div className="text-xs text-red-500 mt-1">{errors.full_name}</div>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <input
                            type="tel" placeholder="Mobile Number" value={form.phone}
                            onChange={(e) => set("phone", e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                            data-testid="inq-phone"
                        />
                        {errors.phone && <div className="text-xs text-red-500 mt-1">{errors.phone}</div>}
                    </div>
                    <div>
                        <input
                            type="email" placeholder="Email Address" value={form.email}
                            onChange={(e) => set("email", e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                            data-testid="inq-email"
                        />
                        {errors.email && <div className="text-xs text-red-500 mt-1">{errors.email}</div>}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

    <div>
        <label
            htmlFor="inq-date"
            className="block text-xs text-slate-600 mb-1"
        >
            Preferred Date
        </label>

        <input
            id="inq-date"
            type="date"
            value={form.preferred_date}
            onChange={(e) => set("preferred_date", e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            data-testid="inq-date"
        />
    </div>

    <div>
        <label
            htmlFor="inq-time"
            className="block text-xs text-slate-600 mb-1"
        >
            Preferred Time
        </label>

        <select
            id="inq-time"
            value={form.preferred_time}
            onChange={(e) => set("preferred_time", e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            data-testid="inq-time"
        >
            <option value="">Select time</option>

            {TIME_OPTIONS.map((time) => (
                <option key={time.value} value={time.value}>
                    {time.label}
                </option>
            ))}
        </select>
    </div>

</div>

                <textarea
                    placeholder="Message (optional)" rows="3" value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                    data-testid="inq-message"
                />

                <button
                    type="submit" disabled={busy}
                    className="btn-primary justify-center w-full disabled:opacity-70"
                    data-testid="inq-submit"
                >
                    {busy ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Send size={16} /> Send Inquiry</>}
                </button>

                <p className="text-[11px] text-slate-500 text-center mt-1">By submitting, you agree to be contacted by our advisors. We respect your privacy.</p>
            </div>
        </form>
        <Dialog open={sent} onOpenChange={setSent}>
            <DialogContent className="max-w-md" data-testid="inquiry-sent-dialog">
                <div className="text-center py-2" role="status">
                    <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
                    <DialogTitle className="font-serif-display text-3xl text-[var(--navy)] mt-3">Request received</DialogTitle>
                    <DialogDescription className="mt-2">Our advisor will reach out to you shortly.</DialogDescription>
                    <ContactPanel property={property} />
                    <button type="button" className="btn-outline-gold text-sm mt-5" onClick={() => setSent(false)}>Close</button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
