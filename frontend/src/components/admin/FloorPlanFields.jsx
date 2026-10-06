import React, { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Box } from "lucide-react";
import { Mini, FeetInput } from "@/components/admin/editorBits";
import RoomMarker from "@/components/admin/RoomMarker";
import { safeUrl, PLACEHOLDER_IMG } from "@/lib/media";
import UploadButton from "@/components/admin/UploadButton";

const AREA_TYPES = ["Carpet Area", "Built-up Area", "Super Built-up Area"];

export const blankPlan = () => ({
    config: "", area: "", price: "", image: "", image_3d: "", carpet_area_sqft: 0, bedrooms: 0, bathrooms: 0, rooms: [], download_url: "",
    area_type: "", rooms_image: "2d", auto_3d: false, auto_3d_threshold: 115, auto_3d_detail: 1, auto_3d_height: 6,
});

/** One layout in the property editor: size, pictures, room sizes, room highlight boxes and the 3D view. */
export default function FloorPlanFields({ fp, index, total, onChange, onMove, onRemove }) {
    const [marking, setMarking] = useState(false);
    const set = (patch) => onChange({ ...fp, ...patch });
    const setRoom = (k, patch) => set({ rooms: fp.rooms.map((x, n) => (n === k ? { ...x, ...patch } : x)) });
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

            <div className="flex gap-2">
                <input value={fp.image} onChange={(e) => set({ image: e.target.value })} placeholder="2D floor plan image link" aria-label="Floor plan image link" className="field-input flex-1 min-w-0" />
                <UploadButton label="Upload 2D" onDone={(u) => set({ image: u })} testId={`upload-2d-${index}`} />
            </div>
            <div className="flex gap-2">
                <input value={fp.image_3d} onChange={(e) => set({ image_3d: e.target.value, auto_3d: Boolean(e.target.value) })} placeholder="3D furnished floor plan image link (optional)" aria-label="3D floor plan image link" className="field-input flex-1 min-w-0" />
                <UploadButton label="Upload 3D" onDone={(u) => set({ image_3d: u, auto_3d: true, rooms_image: "3d" })} testId={`upload-3d-${index}`} />
            </div>
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
                                    <select value={fp.rooms_image || (fp.image_3d ? "3d" : "2d")} onChange={(e) => set({ rooms_image: e.target.value })} className="field-input mt-1 bg-white max-w-xs">
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

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3" data-testid={`3d-view-section-${index}`}>
                <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2.5 text-sm text-slate-800 cursor-pointer">
                        <input
                            type="checkbox"
                            className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={!!fp.auto_3d || !!fp.image_3d}
                            onChange={(e) => set({ auto_3d: e.target.checked })}
                            data-testid={`auto3d-${index}`}
                        />
                        <div>
                            <span className="font-semibold text-[var(--navy)] flex items-center gap-1.5">
                                <Box size={16} className="text-sky-600" /> 3D View Option (based on 3D Image)
                            </span>
                            <span className="block text-xs text-slate-500 mt-0.5">
                                Showcases the realistic 3D floor plan image to visitors. Once uploaded, buyers can view and inspect the layout in 3D.
                            </span>
                        </div>
                    </label>
                    {fp.image_3d && (
                        <span className="shrink-0 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                            ✓ 3D Active
                        </span>
                    )}
                </div>

                {(fp.auto_3d || fp.image_3d) && (
                    <div className="pt-2 border-t border-slate-100">
                        {safeUrl(fp.image_3d) ? (
                            <div className="space-y-2">
                                <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 flex flex-col items-center justify-center overflow-hidden">
                                    <div className="relative w-full max-h-[380px] flex items-center justify-center bg-white rounded-lg p-2">
                                        <img
                                            src={safeUrl(fp.image_3d)}
                                            alt={`3D floor plan layout ${index + 1}`}
                                            className="max-h-[360px] max-w-full object-contain rounded drop-shadow-sm"
                                            onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                                        />
                                        <div className="absolute top-3 left-3 flex gap-2">
                                            <span className="text-[11px] font-medium bg-sky-600 text-white px-2.5 py-1 rounded-full shadow-sm">
                                                3D View
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full flex items-center justify-between text-xs text-slate-600 pt-2 px-1">
                                        <span className="text-slate-500 truncate max-w-md">{fp.image_3d}</span>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <UploadButton label="Replace 3D image" onDone={(u) => set({ image_3d: u, auto_3d: true, rooms_image: "3d" })} testId={`replace-3d-${index}`} />
                                            <button
                                                type="button"
                                                onClick={() => set({ image_3d: "", auto_3d: false })}
                                                className="text-xs text-red-600 hover:text-red-700 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-semibold text-amber-900">No 3D image uploaded yet</div>
                                    <div className="text-[11px] text-amber-800 mt-0.5">Upload or enter a 3D floor plan image above to show the 3D view to visitors.</div>
                                </div>
                                <UploadButton
                                    label="Upload 3D Image"
                                    onDone={(u) => set({ image_3d: u, auto_3d: true, rooms_image: "3d" })}
                                    testId={`upload-3d-inline-${index}`}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
