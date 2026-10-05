import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

export default function AdminSettings() {
    const { settings, reload } = useSettings();
    const [f, setF] = useState({});
    useEffect(() => { if (settings) setF(settings); }, [settings]);

    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

    const save = async () => {
        try {
            await api.put("/settings", f);
            toast.success("Settings updated");
            reload();
        } catch (e) {
            toast.error("Failed to save");
        }
    };

    if (!settings) return null;

    return (
        <div data-testid="admin-settings">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <div>
                    <div className="overline">Contact & Branding</div>
                    <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Website Settings</h1>
                </div>
                <button onClick={save} className="btn-primary" data-testid="settings-save"><Save size={16} /> Save</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                    <div className="font-serif-display text-xl text-[var(--navy)] mb-2">Contact Details</div>
                    <Field label="Phone Number"><input value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} className="inp" data-testid="set-phone" /></Field>
                    <Field label="Email"><input value={f.email || ""} onChange={(e) => set("email", e.target.value)} className="inp" data-testid="set-email" /></Field>
                    <Field label="WhatsApp Number (digits with country code, e.g. 919876543210)">
                        <input value={f.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value.replace(/\D/g, ""))} className="inp" data-testid="set-whatsapp" />
                    </Field>
                    <Field label="Office Address"><textarea rows="3" value={f.address || ""} onChange={(e) => set("address", e.target.value)} className="inp resize-none" /></Field>
                    <Field label="WhatsApp QR Image URL"><input value={f.qr_image || ""} onChange={(e) => set("qr_image", e.target.value)} className="inp" /></Field>
                    {f.qr_image && <img src={f.qr_image} alt="QR" className="w-40 h-40 object-contain border border-slate-200 rounded-xl p-2 mt-2" />}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                    <div className="font-serif-display text-xl text-[var(--navy)] mb-2">Homepage Hero</div>
                    <Field label="Hero Title"><input value={f.hero_title || ""} onChange={(e) => set("hero_title", e.target.value)} className="inp" /></Field>
                    <Field label="Hero Subtitle"><input value={f.hero_subtitle || ""} onChange={(e) => set("hero_subtitle", e.target.value)} className="inp" /></Field>
                    <Field label="Hero Image URL"><input value={f.hero_image || ""} onChange={(e) => set("hero_image", e.target.value)} className="inp" /></Field>
                    {f.hero_image && <img src={f.hero_image} alt="hero" className="w-full h-40 object-cover rounded-xl border border-slate-200" />}

                    <div className="font-serif-display text-xl text-[var(--navy)] mt-6 mb-2">Social Media</div>
                    <Field label="Facebook URL"><input value={f.facebook || ""} onChange={(e) => set("facebook", e.target.value)} className="inp" /></Field>
                    <Field label="Instagram URL"><input value={f.instagram || ""} onChange={(e) => set("instagram", e.target.value)} className="inp" /></Field>
                    <Field label="LinkedIn URL"><input value={f.linkedin || ""} onChange={(e) => set("linkedin", e.target.value)} className="inp" /></Field>
                    <Field label="YouTube URL"><input value={f.youtube || ""} onChange={(e) => set("youtube", e.target.value)} className="inp" /></Field>
                </div>
            </div>

            <style>{`
                .inp { width: 100%; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 12px; font-size: 14px; background: white; }
                .inp:focus { outline: none; box-shadow: 0 0 0 3px rgba(197, 168, 128, 0.35); border-color: #C5A880; }
            `}</style>
        </div>
    );
}

const Field = ({ label, children }) => (
    <label className="block">
        <span className="text-xs text-slate-600">{label}</span>
        <div className="mt-1">{children}</div>
    </label>
);
