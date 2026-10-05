import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function AdminLocations() {
    const [items, setItems] = useState([]);
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);

    const load = () => api.get("/locations").then((r) => setItems(r.data));
    useEffect(() => { load(); }, []);

    const add = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
            await api.post("/locations", { name: name.trim() });
            setName("");
            toast.success("Location added");
            load();
        } catch (ex) {
            toast.error(formatApiError(ex.response?.data?.detail) || "Couldn't add location");
        } finally {
            setBusy(false);
        }
    };

    const del = async (l) => {
        if (!window.confirm(`Remove "${l.name}"? Employees assigned to it will keep the name on their profile until you edit them.`)) return;
        await api.delete(`/locations/${l.id}`);
        toast.success("Removed");
        load();
    };

    return (
        <div data-testid="admin-locations">
            <div className="mb-8">
                <div className="overline">Coverage areas</div>
                <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Locations</h1>
                <p className="text-sm text-slate-500 mt-2 max-w-xl">
                    Every inquiry belongs to one of these locations. New leads are automatically routed to
                    whichever employee is assigned to that location on the Employees page.
                </p>
            </div>

            <form onSubmit={add} className="flex gap-2 mb-6 max-w-md">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Andheri West"
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-sm" data-testid="location-input" />
                <button disabled={busy} className="btn-primary" data-testid="location-add"><Plus size={16} /> Add</button>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 max-w-md">
                {items.map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-5 py-3" data-testid={`location-row-${l.id}`}>
                        <div className="flex items-center gap-2 text-sm text-[var(--navy)]"><MapPin size={14} className="text-slate-400" /> {l.name}</div>
                        <button onClick={() => del(l)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={15} /></button>
                    </div>
                ))}
                {items.length === 0 && <div className="text-center py-10 text-slate-500 text-sm">No locations yet — add your first one above.</div>}
            </div>
        </div>
    );
}
