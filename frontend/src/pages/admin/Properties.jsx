import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, Search } from "lucide-react";
import PropertyEditor from "./PropertyEditor";

export default function AdminProperties() {
    const [items, setItems] = useState([]);
    const [q, setQ] = useState("");
    const [editing, setEditing] = useState(null); // property or "new" or null

    const load = async () => {
        const { data } = await api.get("/properties?limit=200");
        setItems(data);
    };
    useEffect(() => { load(); }, []);

    const del = async (p) => {
        if (!window.confirm(`Delete "${p.name}"?`)) return;
        await api.delete(`/properties/${p.id}`);
        toast.success("Deleted");
        load();
    };

    const filtered = items.filter((p) =>
        !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.builder.toLowerCase().includes(q.toLowerCase())
    );

    if (editing) {
        return <PropertyEditor property={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;
    }

    return (
        <div data-testid="admin-properties">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <div>
                    <div className="overline">Manage</div>
                    <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Properties</h1>
                </div>
                <button onClick={() => setEditing("new")} className="btn-primary" data-testid="add-property-btn">
                    <Plus size={16} /> Add Property
                </button>
            </div>

            <div className="mb-5 relative max-w-sm">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or builder…" className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm" data-testid="props-search" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-widest">
                        <tr>
                            <th className="text-left px-5 py-3">Property</th>
                            <th className="text-left px-5 py-3">Category</th>
                            <th className="text-left px-5 py-3">Location</th>
                            <th className="text-left px-5 py-3">Price</th>
                            <th className="text-left px-5 py-3">Featured</th>
                            <th className="text-right px-5 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map((p) => (
                            <tr key={p.id} data-testid={`prop-row-${p.slug}`}>
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-3">
                                        <img src={p.cover_image || p.images?.[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                        <div>
                                            <div className="font-medium text-[var(--navy)]">{p.name}</div>
                                            <div className="text-xs text-slate-500">{p.builder}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-3 text-slate-700">{p.category}</td>
                                <td className="px-5 py-3 text-slate-700">{p.location}</td>
                                <td className="px-5 py-3 text-slate-700">{p.starting_price}</td>
                                <td className="px-5 py-3">{p.featured ? <Star size={16} className="text-[var(--gold)] fill-[var(--gold)]" /> : "—"}</td>
                                <td className="px-5 py-3 text-right">
                                    <button onClick={() => setEditing(p)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid={`edit-${p.slug}`}><Pencil size={16} /></button>
                                    <button onClick={() => del(p)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" data-testid={`delete-${p.slug}`}><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="6" className="text-center py-10 text-slate-500">No properties found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
