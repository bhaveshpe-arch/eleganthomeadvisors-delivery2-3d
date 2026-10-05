import React, { useRef, useState } from "react";
import { PLACEHOLDER_IMG } from "@/lib/media";

const clamp = (v) => Math.min(100, Math.max(0, v));
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Lets the admin drag a box around each room on the floor-plan picture. The boxes are stored as percentages,
 * so they stay in place at any screen size.
 */
export default function RoomMarker({ imageUrl, rooms, onChange }) {
    const named = rooms.map((r, i) => ({ r, i })).filter(({ r }) => r.name?.trim());
    const [active, setActive] = useState(named[0]?.i ?? 0);
    const [drag, setDrag] = useState(null);
    const box = useRef(null);

    const point = (e) => {
        const b = box.current.getBoundingClientRect();
        return { x: clamp(((e.clientX - b.left) / b.width) * 100), y: clamp(((e.clientY - b.top) / b.height) * 100) };
    };
    const down = (e) => {
        if (!named.length) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const p = point(e);
        setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    };
    const move = (e) => { if (drag) { const p = point(e); setDrag((d) => ({ ...d, x1: p.x, y1: p.y })); } };
    const up = () => {
        if (!drag) return;
        const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
        const w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
        if (w > 1.5 && h > 1.5) onChange(active, { x: r1(x), y: r1(y), w: r1(w), h: r1(h) });
        setDrag(null);
    };

    if (!named.length) return <p className="text-xs text-slate-500">Add room names above first, then you can mark them on the picture.</p>;
    if (!imageUrl) return <p className="text-xs text-slate-500">Add the plan image link first.</p>;

    const preview = drag && { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) };
    return (
        <div data-testid="room-marker">
            <div className="flex flex-wrap gap-2 mb-3">
                {named.map(({ r, i }) => (
                    <button key={i} type="button" onClick={() => setActive(i)} aria-pressed={active === i}
                        className={`text-xs px-3 py-1.5 rounded-full border ${active === i ? "bg-sky-600 text-white border-sky-600" : "border-slate-300 text-slate-700 bg-white"}`}>
                        {r.name}{r.w ? " ✓" : ""}
                    </button>
                ))}
                {rooms[active]?.w ? (
                    <button type="button" onClick={() => onChange(active, null)} className="text-xs text-red-600 underline ml-1">Clear this room's box</button>
                ) : null}
            </div>
            <p className="text-[11px] text-slate-500 mb-2">Choose a room, then drag on the picture to draw a box around it.</p>
            <div className="relative inline-block max-w-full select-none" ref={box}>
                <img src={imageUrl} alt="Floor plan to mark rooms on" draggable={false} className="block max-w-full w-auto h-auto max-h-[420px]" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                <div className="absolute inset-0" style={{ touchAction: "none", cursor: "crosshair" }}
                    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="marker-surface">
                    {rooms.map((r, i) => r.w ? (
                        <div key={i} className={`absolute border-2 ${i === active ? "border-sky-500 bg-sky-400/30" : "border-amber-500/80 bg-amber-300/20"} pointer-events-none`}
                            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}>
                            <span className="absolute -top-5 left-0 text-[10px] bg-white/90 px-1 rounded">{r.name}</span>
                        </div>
                    ) : null)}
                    {preview && <div className="absolute border-2 border-dashed border-sky-600 bg-sky-300/20 pointer-events-none" style={{ left: `${preview.x}%`, top: `${preview.y}%`, width: `${preview.w}%`, height: `${preview.h}%` }} />}
                </div>
            </div>
        </div>
    );
}
