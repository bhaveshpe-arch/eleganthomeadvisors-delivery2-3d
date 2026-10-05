import React, { Suspense, lazy, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Mini, FeetInput, useDebounced } from "@/components/admin/editorBits";
import RoomMarker from "@/components/admin/RoomMarker";
import { safeUrl } from "@/lib/media";
import UploadButton from "@/components/admin/UploadButton";

const Plan3D = lazy(() => import("@/components/media/Plan3D"));
const AREA_TYPES = ["Carpet Area", "Built-up Area", "Super Built-up Area"];

export const blankPlan = () => ({
    config: "", area: "", price: "", image: "", image_3d: "", carpet_area_sqft: 0, bedrooms: 0, bathrooms: 0, rooms: [], download_url: "",
    area_type: "", rooms_image: "2d", auto_3d: false, auto_3d_threshold: 115, auto_3d_detail: 1, auto_3d_height: 6,
});

/** One layout in the property editor: size, pictures, room sizes, room highlight boxes and the automatic 3D view. */
export default function FloorPlanFields({ fp, index, total, onChange, onMove, onRemove }) {
    const [marking, setMarking] = useState(false);
    const [stats, setStats] = useState(null);
    const set = (patch) => onChange({ ...fp, ...patch });
    const setRoom = (k, patch) => set({ rooms: fp.rooms.map((x, n) => (n === k ? { ...x, ...patch } : x)) });
    const threshold = useDebounced(fp.auto_3d_threshold), detail = useDebounced(fp.auto_3d_detail), wallH = useDebounced(fp.auto_3d_height);
    const markImage = safeUrl(fp.rooms_image === "3d" ? fp.image_3d : fp.image);

    return (
        <div className="bg-slate-50 rounded-2xl p-4 space-y-3" data-testid={`fp-${index}`}>
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-[var(--navy)]">Layout {index + 1}</div>
                <div className="flex gap-1">
                    <Mini label="Move up" onClick={() => onMove(-1)} disabled={index === 0}><ArrowUp size={14} /></Mini>
                    <Mini label="Move down" onClick={() => onMove(1)} disabled={index === total - 1}><ArrowDown size={14} /></Mini>
                    <Mini label="Delete layout" danger onClick={onRemove}><Trash2 size={14} /></Mini>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={fp.config} onChange={(e) => set({ config: e.target.value })} placeholder="3 BHK" aria-label="Configuration" className="field-input" />
                <input value={fp.area} onChange={(e) => set({ area: e.target.value })} placeholder="1878 sq.ft" aria-label="Area text" className="field-input" />
                <input value={fp.price} onChange={(e) => set({ price: e.target.value })} placeholder="₹2.07 Cr" aria-label="Price" className="field-input" />
                <input list="areatypes" value={fp.area_type} onChange={(e) => set({ area_type: e.target.value })} placeholder="Area type (e.g. Carpet Area)" aria-label="Area type" className="field-input" />
                <input type="number" min="0" value={fp.carpet_area_sqft || ""} onChange={(e) => set({ carpet_area_sqft: e.target.value })} placeholder="Area in sq.ft (number)" aria-label="Area in sq.ft" className="field-input" />
                <div className="grid grid-cols-2 gap-2">
                    <input type="number" min="0" value={fp.bedrooms || ""} onChange={(e) => set({ bedrooms: e.target.value })} placeholder="Beds" aria-label="Bedrooms" className="field-input" />
                    <input type="number" min="0" value={fp.bathrooms || ""} onChange={(e) => set({ bathrooms: e.target.value })} placeholder="Baths" aria-label="Bathrooms" className="field-input" />
                </div>
            </div>
            <datalist id="areatypes">{AREA_TYPES.map((a) => <option key={a} value={a} />)}</datalist>

            <div className="flex gap-2"><input value={fp.image} onChange={(e) => set({ image: e.target.value })} placeholder="2D floor plan image link" aria-label="Floor plan image link" className="field-input flex-1 min-w-0" /><UploadButton label="Upload 2D" onDone={(u) => set({ image: u })} testId={`upload-2d-${index}`} /></div>
            <div className="flex gap-2"><input value={fp.image_3d} onChange={(e) => set({ image_3d: e.target.value })} placeholder="3D furnished floor plan image link (optional)" aria-label="3D floor plan image link" className="field-input flex-1 min-w-0" /><UploadButton label="Upload 3D" onDone={(u) => set({ image_3d: u })} testId={`upload-3d-${index}`} /></div>
            <input value={fp.download_url} onChange={(e) => set({ download_url: e.target.value })} placeholder="Downloadable PDF link (optional)" aria-label="Download link" className="field-input" />

            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs uppercase tracking-widest text-slate-500">Rooms (feet, e.g. 19'7")</div>
                    <button type="button" onClick={() => set({ rooms: [...(fp.rooms || []), { name: "", length_ft: 0, width_ft: 0 }] })} className="text-xs text-[var(--navy)] flex items-center gap-1"><Plus size={12} /> Add room</button>
                </div>
                {(fp.rooms || []).map((r, k) => (
                    <div key={k} className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2 mb-2">
                        <input value={r.name} onChange={(e) => setRoom(k, { name: e.target.value })} placeholder="Living Room" aria-label="Room name" className="field-input" list="roomnames" />
                        <FeetInput value={r.length_ft} label="Length" onChange={(v) => setRoom(k, { length_ft: v })} />
                        <FeetInput value={r.width_ft} label="Width" onChange={(v) => setRoom(k, { width_ft: v })} />
                        <Mini label="Delete room" danger onClick={() => set({ rooms: fp.rooms.filter((_, n) => n !== k) })}><Trash2 size={14} /></Mini>
                    </div>
                ))}
                <datalist id="roomnames">{["Living Room", "Kitchen", "Master Bedroom", "Bedroom", "Bathroom", "Toilet", "Balcony", "Dining", "Study"].map((n) => <option key={n} value={n} />)}</datalist>

                {(fp.rooms || []).some((r) => r.name?.trim()) && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="text-sm font-medium text-[var(--navy)]">Room highlights (optional)</div>
                            <button type="button" onClick={() => setMarking((v) => !v)} className="btn-outline-gold text-xs !py-1.5" data-testid={`mark-rooms-${index}`}>{marking ? "Hide" : "Mark rooms on the picture"}</button>
                        </div>
                        {marking && (
                            <div className="mt-3 space-y-3">
                                <label className="text-xs text-slate-600 block">Draw the boxes on
                                    <select value={fp.rooms_image || "2d"} onChange={(e) => set({ rooms_image: e.target.value })} className="field-input mt-1 bg-white max-w-xs">
                                        <option value="2d">the 2D plan</option>
                                        <option value="3d">the 3D image</option>
                                    </select>
                                </label>
                                <RoomMarker imageUrl={markImage} rooms={fp.rooms} onChange={(k, rect) => setRoom(k, rect ? rect : { x: null, y: null, w: null, h: null })} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="mt-1" checked={!!fp.auto_3d} onChange={(e) => set({ auto_3d: e.target.checked })} data-testid={`auto3d-${index}`} />
                    <span>
                        <span className="font-medium text-[var(--navy)]">Offer an approximate 3D view built automatically from the 2D plan</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">Works best with a clean drawing that has thick dark walls. Nothing is uploaded or stored: the 3D view is built in the visitor's browser. It shows walls only, no furniture. Plans uploaded from your computer work with this. A pasted link must come from a host that allows other websites to read it (for example Cloudinary).</span>
                    </span>
                </label>
                {fp.auto_3d && (
                    <div className="mt-3 space-y-3">
                        {!safeUrl(fp.image) ? <p className="text-xs text-amber-700">Add the 2D plan image link above to see the preview.</p> : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                                    <label>Wall darkness ({fp.auto_3d_threshold})<input type="range" min="30" max="200" step="5" value={fp.auto_3d_threshold} onChange={(e) => set({ auto_3d_threshold: Number(e.target.value) })} className="w-full" aria-label="Wall darkness" /></label>
                                    <label>Ignore thin lines ({fp.auto_3d_detail})<input type="range" min="0" max="3" step="1" value={fp.auto_3d_detail} onChange={(e) => set({ auto_3d_detail: Number(e.target.value) })} className="w-full" aria-label="Ignore thin lines" /></label>
                                    <label>Wall height ({fp.auto_3d_height})<input type="range" min="2" max="15" step="0.5" value={fp.auto_3d_height} onChange={(e) => set({ auto_3d_height: Number(e.target.value) })} className="w-full" aria-label="Wall height" /></label>
                                </div>
                                <Suspense fallback={<div className="h-[320px] rounded-2xl skeleton" />}>
                                    <Plan3D src={safeUrl(fp.image)} threshold={threshold} detail={detail} height={wallH} strict={false} onResult={setStats} className="h-[320px]" />
                                </Suspense>
                                {stats && (
                                    <p className={`text-xs ${stats.rects >= 12 ? "text-slate-600" : "text-amber-700"}`} data-testid={`auto3d-stats-${index}`}>
                                        Wall pieces found: {stats.rects}. {stats.rects < 12 ? "Too few: lower the darkness or the thin-line setting. Visitors will not see a 3D view until enough walls are found." : "If the walls look noisy, raise 'Ignore thin lines'. If walls are missing, raise 'Wall darkness'."}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
