import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

const empty = { name: "", role: "", quote: "", avatar: "", rating: 5 };

export default function AdminTestimonials() {
    const [items, setItems] = useState([]);
    const [f, setF] = useState(empty);

    const load = () => api.get("/testimonials").then((r) => setItems(r.data));
    useEffect(() => { load(); }, []);

    const save = async () => {
        if (!f.name || !f.quote) { toast.error("Name and quote required"); return; }
        await api.post("/testimonials", { ...f, id: crypto.randomUUID() });
        toast.success("Added");
        setF(empty);
        load();
    };

    const del = async (t) => {
        if (!window.confirm("Delete?")) return;
        await api.delete(`/testimonials/${t.id}`);
        load();
    };

    return (
        <div data-testid="admin-testimonials">
            <div className="mb-8">
                <div className="overline">Social proof</div>
                <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Testimonials</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="font-serif-display text-xl text-[var(--navy)] mb-4">Add Testimonial</div>
                    <div className="space-y-3">
                        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" data-testid="test-name" />
                        <input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Role / Description" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" />
                        <textarea rows="4" value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} placeholder="Quote…" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none" data-testid="test-quote" />
                        <input value={f.avatar} onChange={(e) => setF({ ...f, avatar: e.target.value })} placeholder="Avatar image URL" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" />
                        <select value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm">
                            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} Stars</option>)}
                        </select>
                        <button onClick={save} className="btn-primary w-full justify-center" data-testid="test-save"><Save size={16} /> Save</button>
                    </div>
                </div>

                <div className="space-y-3">
                    {items.map((t) => (
                        <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4">
                            {t.avatar && <img src={t.avatar} alt={t.name} className="w-14 h-14 rounded-full object-cover" />}
                            <div className="flex-1">
                                <div className="font-medium text-[var(--navy)]">{t.name}</div>
                                <div className="text-xs text-slate-500">{t.role}</div>
                                <div className="mt-2 text-sm text-slate-700 line-clamp-3">{t.quote}</div>
                            </div>
                            <button onClick={() => del(t)} className="p-2 h-fit text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                    ))}
                    {items.length === 0 && <div className="text-slate-500 text-sm">No testimonials yet.</div>}
                </div>
            </div>
        </div>
    );
}
