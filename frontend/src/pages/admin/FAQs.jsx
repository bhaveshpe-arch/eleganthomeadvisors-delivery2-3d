import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

const empty = { question: "", answer: "", order: 0 };

export default function AdminFAQs() {
    const [items, setItems] = useState([]);
    const [f, setF] = useState(empty);

    const load = () => api.get("/faqs").then((r) => setItems(r.data));
    useEffect(() => { load(); }, []);

    const save = async () => {
        if (!f.question || !f.answer) { toast.error("Question and answer required"); return; }
        await api.post("/faqs", { ...f, id: crypto.randomUUID(), order: Number(f.order) || items.length + 1 });
        toast.success("Added");
        setF(empty);
        load();
    };

    const del = async (q) => {
        if (!window.confirm("Delete?")) return;
        await api.delete(`/faqs/${q.id}`);
        load();
    };

    return (
        <div data-testid="admin-faqs">
            <div className="mb-8">
                <div className="overline">Help center</div>
                <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Frequently Asked Questions</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="font-serif-display text-xl text-[var(--navy)] mb-4">Add FAQ</div>
                    <div className="space-y-3">
                        <input value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} placeholder="Question" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" data-testid="faq-q" />
                        <textarea rows="5" value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} placeholder="Answer" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none" data-testid="faq-a" />
                        <input type="number" value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} placeholder="Order (optional)" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" />
                        <button onClick={save} className="btn-primary w-full justify-center" data-testid="faq-save"><Save size={16} /> Save</button>
                    </div>
                </div>

                <div className="space-y-3">
                    {items.map((q) => (
                        <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4">
                            <div className="flex-1">
                                <div className="font-medium text-[var(--navy)]">{q.question}</div>
                                <div className="text-sm text-slate-600 mt-1 line-clamp-3">{q.answer}</div>
                            </div>
                            <button onClick={() => del(q)} className="p-2 h-fit text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
