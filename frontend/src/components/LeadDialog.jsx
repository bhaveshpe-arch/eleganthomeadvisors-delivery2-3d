import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, CalendarCheck, PhoneCall, FileDown, MessageSquare, Info, Home } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TextField, SelectField, TextAreaField } from "@/components/form";
import api, { formatApiError } from "@/lib/api";
import { track } from "@/lib/track";
import { safeUrl } from "@/lib/media";
import ContactPanel from "@/components/ContactPanel";

const SLOTS = ["9 AM – 11 AM", "11 AM – 1 PM", "1 PM – 3 PM", "3 PM – 5 PM", "5 PM – 7 PM", "Other"];
const CALLBACK_TIMES = ["As soon as possible", "Morning (9 AM – 12 PM)", "Afternoon (12 PM – 4 PM)", "Evening (4 PM – 8 PM)", "Other"];

const MODES = {
    site_visit: { title: "Schedule a site visit", icon: CalendarCheck, kind: "site_visit", type: "Site Visit", event: "site_visit_requested", cta: "Request site visit",
        blurb: "Pick a day and time that suits you. Our advisor will confirm the slot with you." },
    callback: { title: "Request a callback", icon: PhoneCall, kind: "callback", type: "Callback Request", event: "callback_requested", cta: "Request callback",
        blurb: "Tell us when to call and we will get back to you." },
    brochure: { title: "Download brochure", icon: FileDown, kind: "brochure", type: "Brochure Download", event: "brochure_download", cta: "Get brochure",
        blurb: "Share your details and the brochure opens right away." },
    enquiry: { title: "Enquire now", icon: MessageSquare, kind: "enquiry", type: "Property Enquiry", event: "enquiry_submitted", cta: "Send enquiry",
        blurb: "Ask about pricing, availability or anything else." },
};

const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const friendlyError = (err) => {
    if (err?.response?.status === 429) return "You have sent several requests already. Please wait a little and try again, or call us.";
    const detail = err?.response?.data?.detail;
    if (err?.response?.status === 400 && typeof detail === "string") return detail;
    if (err?.response?.status === 422) return formatApiError(detail);
    return "We couldn't send your request right now. Please try again, or call us and we will help you directly.";
};

/**
 * One dialog for every lead action: site visit, callback, brochure and quick enquiry.
 * Every submission lands in the existing inquiries/lead system.
 */
export default function LeadDialog({ mode = "enquiry", open, onOpenChange, property, defaultMessage = "", source = "property_page" }) {
    const cfg = MODES[mode] || MODES.enquiry;
    const Icon = cfg.icon;
    const [locations, setLocations] = useState([]);
    const [f, setF] = useState({
        full_name: "", phone: "", email: "", preferred_date: "", slot: "", other_time: "", visitors: "2",
        visit_type: "site_visit", home_address: "",
        alt_date: "", alt_time: "", message: defaultMessage, location: "", callback_time: CALLBACK_TIMES[0],
    });
    const [showAlt, setShowAlt] = useState(false);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [formError, setFormError] = useState("");
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
    const min = useMemo(todayLocal, []);

    useEffect(() => { if (open) { setDone(false); setFormError(""); setErrors({}); setF((s) => ({ ...s, message: defaultMessage, visit_type: "site_visit", home_address: "" })); } }, [open, defaultMessage]);
    useEffect(() => {
        if (open && !property && !locations.length) api.get("/locations").then((r) => setLocations(r.data)).catch(() => {});
    }, [open, property, locations.length]);

    const validate = () => {
        const e = {};
        if (!f.full_name.trim()) e.full_name = "Please enter your name";
        if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a valid 10-digit mobile number";
        const emailNeeded = mode === "site_visit" || mode === "enquiry" || mode === "brochure";
        if ((emailNeeded || f.email) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.email = "Enter a valid email address";
        if (mode === "site_visit") {
            if (f.visit_type === "home_visit" && !f.home_address.trim()) {
                e.home_address = "Please enter your address for the home visit";
            }
            if (!f.preferred_date) e.preferred_date = "Choose a date";
            else if (f.preferred_date < min) e.preferred_date = "Choose today or a later date";
            if (!f.slot) e.slot = "Choose a time";
            if (f.slot === "Other" && !f.other_time.trim()) e.other_time = "Tell us your preferred time";
        }
        if (mode === "callback" && f.callback_time === "Other" && !f.other_time.trim()) e.other_time = "Tell us your preferred time";
        if (!property && locations.length > 0 && !f.location) e.location = "Select the area you are interested in";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const submit = async (ev) => {
        ev.preventDefault();
        if (busy || !validate()) return;
        setBusy(true);
        setFormError("");
        let preferred_time = "";
        if (mode === "site_visit") preferred_time = f.slot === "Other" ? f.other_time.trim() : f.slot;
        if (mode === "callback") preferred_time = f.callback_time === "Other" ? f.other_time.trim() : f.callback_time;
        const message = f.message.trim();
        try {
            await api.post("/inquiries", {
                inquiry_type: property?.category && mode === "enquiry" ? property.category : cfg.type,
                full_name: f.full_name.trim(), phone: f.phone.trim(), email: f.email.trim(),
                message,
                preferred_date: mode === "site_visit" ? f.preferred_date : "",
                preferred_time,
                visitors: mode === "site_visit" ? Number(f.visitors) || 0 : 0,
                visit_type: mode === "site_visit" ? f.visit_type : "site_visit",
                home_address: (mode === "site_visit" && f.visit_type === "home_visit") ? f.home_address.trim() : "",
                alternate_date: showAlt ? f.alt_date : "",
                alternate_time: showAlt ? f.alt_time : "",
                property_id: property?.id || "", property_name: property?.name || "",
                location: property ? "" : f.location,
                kind: cfg.kind, source,
            });
            track(cfg.event, property?.id || "");
            setDone(true);
            if (mode === "brochure" && safeUrl(property?.brochure_url)) window.open(property.brochure_url, "_blank", "noopener");
        } catch (err) {
            setFormError(friendlyError(err));
        } finally {
            setBusy(false);
        }
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" data-testid={`lead-dialog-${mode}`}>
                {done ? (
                    <div className="text-center py-4" role="status">
                        <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
                        <DialogTitle className="font-serif-display text-3xl text-[var(--navy)] mt-3">
                            {mode === "brochure" ? "Thank you" : "Request received"}
                        </DialogTitle>
                        <DialogDescription className="mt-2">
                            {mode === "site_visit" && "We will call you shortly to confirm your site visit."}
                            {mode === "callback" && "Our advisor will call you at your preferred time."}
                            {mode === "enquiry" && "Our advisor will reach out to you shortly."}
                            {mode === "brochure" && (safeUrl(property?.brochure_url) ? "Your brochure should have opened in a new tab." : "Our advisor will share the brochure with you shortly.")}
                        </DialogDescription>
                        {(mode === "site_visit" || mode === "enquiry") && <ContactPanel property={property} />}
                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                            {mode === "brochure" && safeUrl(property?.brochure_url) && (
                                <a href={property.brochure_url} target="_blank" rel="noreferrer" className="btn-primary text-sm"><FileDown size={15} /> Open brochure</a>
                            )}
                            <button type="button" className="btn-outline-gold text-sm" onClick={() => onOpenChange(false)}>Close</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="font-serif-display text-3xl text-[var(--navy)] flex items-center gap-2"><Icon size={22} className="text-[var(--gold-dark)]" /> {cfg.title}</DialogTitle>
                            <DialogDescription>{property ? <><strong className="text-[var(--navy)]">{property.name}</strong> · {[property.locality, property.location].filter(Boolean).join(", ")}</> : cfg.blurb}</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} noValidate className="space-y-3 mt-2">
                            <TextField label="Full name" required value={f.full_name} onChange={(e) => set("full_name", e.target.value)} error={errors.full_name} autoComplete="name" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <TextField label="Mobile number" required type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} autoComplete="tel" />
                                <TextField label={mode === "callback" ? "Email (optional)" : "Email"} required={mode !== "callback"} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} error={errors.email} autoComplete="email" />
                            </div>

                            {!property && locations.length > 0 && (
                                <SelectField label="Area of interest" required value={f.location} onChange={(e) => set("location", e.target.value)} error={errors.location}>
                                    <option value="">Select area</option>
                                    {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </SelectField>
                            )}

                            {mode === "site_visit" && (
                                <>
                                    <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[var(--navy)]">Preferred Visit Type</span>
                                            <div className="group relative flex items-center">
                                                <button type="button" aria-label="Info about Home Visit" className="text-slate-400 hover:text-[var(--gold-dark)] focus:outline-none">
                                                    <Info size={15} />
                                                </button>
                                                <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block group-focus-within:block w-64 p-2.5 bg-[var(--navy)] text-white text-[11px] leading-relaxed rounded-xl shadow-xl z-50">
                                                    <strong>Home Visit:</strong> Our property advisor will visit your place at your preferred time to present all project details, floor plans, and answer any questions in person.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <label className={`cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${f.visit_type === "site_visit" ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"}`}>
                                                <input type="radio" name="visit_type" value="site_visit" checked={f.visit_type === "site_visit"} onChange={() => set("visit_type", "site_visit")} className="sr-only" />
                                                <CalendarCheck size={14} /> Site Visit
                                            </label>
                                            <label className={`cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${f.visit_type === "home_visit" ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"}`}>
                                                <input type="radio" name="visit_type" value="home_visit" checked={f.visit_type === "home_visit"} onChange={() => set("visit_type", "home_visit")} className="sr-only" />
                                                <Home size={14} /> Home Visit
                                            </label>
                                        </div>
                                        {f.visit_type === "home_visit" && (
                                            <div className="pt-2">
                                                <TextField
                                                    label="Your Address for Home Visit"
                                                    required
                                                    placeholder="Flat / Building, Landmark, Locality, City"
                                                    value={f.home_address}
                                                    onChange={(e) => set("home_address", e.target.value)}
                                                    error={errors.home_address}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <TextField label="Preferred date" required type="date" min={min} value={f.preferred_date} onChange={(e) => set("preferred_date", e.target.value)} error={errors.preferred_date} />
                                        <SelectField label="Number of visitors" value={f.visitors} onChange={(e) => set("visitors", e.target.value)}>
                                            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}{n === 10 ? "+" : ""}</option>)}
                                        </SelectField>
                                    </div>
                                    <fieldset>
                                        <legend className="text-xs font-medium text-slate-700">Preferred time <span className="text-red-500" aria-hidden="true">*</span></legend>
                                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {SLOTS.map((s) => (
                                                <label key={s} className={`cursor-pointer text-center text-xs rounded-xl border px-2 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ${f.slot === s ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-slate-300 text-slate-700 bg-white"}`}>
                                                    <input type="radio" name="slot" value={s} checked={f.slot === s} onChange={() => set("slot", s)} className="sr-only" />
                                                    {s === "Other" ? "Other time" : s}
                                                </label>
                                            ))}
                                        </div>
                                        {errors.slot && <div role="alert" className="text-xs text-red-600 mt-1">{errors.slot}</div>}
                                    </fieldset>
                                    {f.slot === "Other" && <TextField label="Your preferred time" required placeholder="e.g. 8 PM or after 6:30 PM" value={f.other_time} onChange={(e) => set("other_time", e.target.value)} error={errors.other_time} />}
                                    {!showAlt ? (
                                        <button type="button" onClick={() => setShowAlt(true)} className="text-xs text-[var(--navy)] underline">+ Add an alternate date / time</button>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <TextField label="Alternate date" type="date" min={min} value={f.alt_date} onChange={(e) => set("alt_date", e.target.value)} />
                                            <TextField label="Alternate time" placeholder="e.g. 4 PM" value={f.alt_time} onChange={(e) => set("alt_time", e.target.value)} />
                                        </div>
                                    )}
                                </>
                            )}

                            {mode === "callback" && (
                                <>
                                    <SelectField label="Best time to call" value={f.callback_time} onChange={(e) => set("callback_time", e.target.value)}>
                                        {CALLBACK_TIMES.map((t) => <option key={t}>{t}</option>)}
                                    </SelectField>
                                    {f.callback_time === "Other" && <TextField label="Your preferred time" required value={f.other_time} onChange={(e) => set("other_time", e.target.value)} error={errors.other_time} />}
                                </>
                            )}

                            {mode !== "brochure" && (
                                <TextAreaField label="Message (optional)" rows={3} maxLength={1000} value={f.message} onChange={(e) => set("message", e.target.value)} />
                            )}

                            {formError && <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{formError}</div>}

                            <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-70" data-testid={`lead-submit-${mode}`}>
                                {busy ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : cfg.cta}
                            </button>

                            {mode === "brochure" && safeUrl(property?.brochure_url) && (
                                <a href={property.brochure_url} target="_blank" rel="noreferrer" onClick={() => { track("brochure_download", property.id); onOpenChange(false); }}
                                    className="block text-center text-xs text-slate-500 underline">Skip and download directly</a>
                            )}
                            <p className="text-[11px] text-slate-500 text-center">We only use your details to respond to this request.</p>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
