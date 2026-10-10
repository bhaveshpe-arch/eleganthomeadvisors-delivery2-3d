import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Save, Trash2, Pencil, X } from "lucide-react";

const empty = { name: "", email: "", phone: "", locations: [], active: true };

export default function AdminEmployees() {
    const [items, setItems] = useState([]);
    const [locations, setLocations] = useState([]);
    const [f, setF] = useState(empty);
    const [editingId, setEditingId] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = () => {
        api.get("/employees").then((r) => setItems(r.data));
        api.get("/locations").then((r) => setLocations(r.data));
    };
    useEffect(() => { load(); }, []);

    const toggleLocation = (name) => {
        setF((prev) => ({
            ...prev,
            locations: prev.locations.includes(name) ? prev.locations.filter((l) => l !== name) : [...prev.locations, name],
        }));
    };

    const edit = (emp) => {
        setEditingId(emp.id);
        setF({ name: emp.name, email: emp.email, phone: emp.phone || "", locations: emp.locations || [], active: emp.active });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEdit = () => { setEditingId(null); setF(empty); };

    const save = async () => {
        if (!f.name || !f.email) {
            toast.error("Name and email are required");
            return;
        }
        setBusy(true);
        try {
            if (editingId) {
                const payload = { name: f.name, phone: f.phone, locations: f.locations, active: f.active };
                await api.put(`/employees/${editingId}`, payload);
                toast.success("Employee updated");
            } else {
                await api.post("/employees", { name: f.name, email: f.email, phone: f.phone, locations: f.locations });
                toast.success("Employee added");
            }
            cancelEdit();
            load();
        } catch (ex) {
            toast.error(formatApiError(ex.response?.data?.detail) || "Couldn't save employee");
        } finally {
            setBusy(false);
        }
    };

    const del = async (emp) => {
        if (!window.confirm(`Remove ${emp.name}? Their open leads will become unassigned.`)) return;
        await api.delete(`/employees/${emp.id}`);
        toast.success("Removed");
        load();
    };

    return (
        <div data-testid="admin-employees">
            <div className="mb-8">
                <div className="overline">Field team</div>
                <h1 className="font-serif-display text-4xl text-[var(--navy)] mt-1">Employees</h1>
                <p className="text-sm text-slate-500 mt-2 max-w-xl">
                    Assign one or more locations to each employee. New inquiries for that location are assigned to
                    them automatically. Employees don't sign in to this site.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 h-fit">
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-serif-display text-xl text-[var(--navy)]">{editingId ? "Edit employee" : "Add employee"}</div>
                        {editingId && <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>}
                    </div>
                    <div className="space-y-3">
                        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Full name"
                            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" data-testid="emp-name" />
                        <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email" type="email" disabled={!!editingId}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400" data-testid="emp-email" />
                        <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone"
                            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" data-testid="emp-phone" />

                        <div>
                            <div className="text-xs text-slate-600 mb-1.5">Assigned locations</div>
                            <div className="flex flex-wrap gap-2">
                                {locations.map((l) => (
                                    <button type="button" key={l.id} onClick={() => toggleLocation(l.name)}
                                        className={`text-xs px-3 py-1.5 rounded-full border ${f.locations.includes(l.name) ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-slate-300 text-slate-600"}`}>
                                        {l.name}
                                    </button>
                                ))}
                                {locations.length === 0 && <span className="text-xs text-slate-400">Add locations first on the Locations page.</span>}
                            </div>
                        </div>

                        {editingId && (
                            <label className="flex items-center gap-2 text-sm text-slate-600 pt-1">
                                <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
                                Active (receives new leads)
                            </label>
                        )}

                        <button onClick={save} disabled={busy} className="btn-primary w-full justify-center disabled:opacity-70" data-testid="emp-save">
                            <Save size={16} /> {editingId ? "Save changes" : "Add employee"}
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {items.map((emp) => (
                        <div key={emp.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4" data-testid={`emp-row-${emp.id}`}>
                            <div className="flex-1">
                                <div className="font-medium text-[var(--navy)] flex items-center gap-2">
                                    {emp.name}
                                    {!emp.active && <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">{emp.email}{emp.phone ? ` · ${emp.phone}` : ""}</div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(emp.locations || []).map((l) => (
                                        <span key={l} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{l}</span>
                                    ))}
                                    {(emp.locations || []).length === 0 && <span className="text-[11px] text-slate-400">No location assigned yet</span>}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 h-fit">
                                <button onClick={() => edit(emp)} className="p-2 hover:bg-slate-100 text-slate-500 rounded-lg"><Pencil size={15} /></button>
                                <button onClick={() => del(emp)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={15} /></button>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && <div className="text-center py-10 text-slate-500 text-sm bg-white border border-slate-200 rounded-2xl">No employees yet — add your first one.</div>}
                </div>
            </div>
        </div>
    );
}
