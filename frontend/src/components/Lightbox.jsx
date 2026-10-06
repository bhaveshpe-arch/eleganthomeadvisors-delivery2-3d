import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Download } from "lucide-react";
import { PLACEHOLDER_IMG } from "@/lib/media";

const MIN = 1, MAX = 5;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Full-screen image viewer: zoom (buttons, wheel, double-click, pinch), pan, keyboard
 * (arrows, Esc, + / - / 0) and swipe on touch screens. items = [{ src, alt, download }]
 */
export default function Lightbox({ items, index, onIndex, onClose, label = "Image viewer" }) {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const closeRef = useRef(null);
    const pointers = useRef(new Map());
    const gesture = useRef({ startX: 0, startY: 0, panFrom: null, pinchDist: 0, pinchScale: 1 });
    const count = items.length;
    const item = items[index];

    const reset = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }); }, []);
    const go = useCallback((d) => { if (count > 1) { onIndex((index + d + count) % count); reset(); } }, [count, index, onIndex, reset]);
    const zoom = useCallback((next) => {
        const s = clamp(next, MIN, MAX);
        setScale(s);
        if (s === 1) setPos({ x: 0, y: 0 });
    }, []);

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeRef.current?.focus();
        return () => {
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowRight") go(1);
            else if (e.key === "ArrowLeft") go(-1);
            else if (e.key === "+" || e.key === "=") zoom(scale + 0.5);
            else if (e.key === "-") zoom(scale - 0.5);
            else if (e.key === "0") reset();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [go, onClose, reset, scale, zoom]);

    const dist = () => {
        const [a, b] = [...pointers.current.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onPointerDown = (e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesture.current;
        g.startX = e.clientX; g.startY = e.clientY;
        if (pointers.current.size === 2) { g.pinchDist = dist(); g.pinchScale = scale; }
        else if (scale > 1) { g.panFrom = { x: e.clientX - pos.x, y: e.clientY - pos.y }; setDragging(true); }
    };
    const onPointerMove = (e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesture.current;
        if (pointers.current.size === 2 && g.pinchDist) zoom(g.pinchScale * (dist() / g.pinchDist));
        else if (scale > 1 && g.panFrom) setPos({ x: e.clientX - g.panFrom.x, y: e.clientY - g.panFrom.y });
    };
    const onPointerUp = (e) => {
        const g = gesture.current;
        const wasSingle = pointers.current.size === 1;
        pointers.current.delete(e.pointerId);
        setDragging(false);
        g.panFrom = null; g.pinchDist = 0;
        if (wasSingle && scale === 1) {            // swipe to change image
            const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
            if (Math.abs(dx) > 60 && Math.abs(dy) < 80) go(dx < 0 ? 1 : -1);
        }
    };

    if (!item) return null;
    return (
        <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[80] bg-black flex flex-col" data-testid="lightbox">
            <div className="flex items-center justify-between px-4 py-3 text-white border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3 min-w-0" aria-live="polite">
                    {count > 1 && <span className="text-xs font-mono bg-white/15 px-2 py-0.5 rounded text-white shrink-0">{index + 1} / {count}</span>}
                    {item.alt && <span className="text-sm font-medium text-white/90 truncate">{item.alt}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => zoom(scale - 0.5)} aria-label="Zoom out" title="Zoom out" className="p-2 rounded-full hover:bg-white/10"><ZoomOut size={20} /></button>
                    <button type="button" onClick={() => zoom(scale + 0.5)} aria-label="Zoom in" title="Zoom in" className="p-2 rounded-full hover:bg-white/10"><ZoomIn size={20} /></button>
                    <button type="button" onClick={reset} aria-label="Reset zoom" title="Reset zoom (fit screen)" className="p-2 rounded-full hover:bg-white/10"><RotateCcw size={18} /></button>
                    {item.download && (
                        <a href={item.download} target="_blank" rel="noreferrer" download aria-label="Download" title="Download image" className="p-2 rounded-full hover:bg-white/10"><Download size={20} /></a>
                    )}
                    <button ref={closeRef} type="button" onClick={onClose} aria-label="Close viewer" title="Close (Esc)" className="p-2 rounded-full hover:bg-white/10" data-testid="lightbox-close"><X size={22} /></button>
                </div>
            </div>

            <div
                className="relative flex-1 min-h-0 min-w-0 w-full overflow-hidden flex items-center justify-center p-2 sm:p-4 select-none"
                style={{ touchAction: "none", cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                onDoubleClick={() => zoom(scale > 1 ? 1 : 2.5)}
                onWheel={(e) => zoom(scale + (e.deltaY < 0 ? 0.3 : -0.3))}
            >
                <img
                    src={item.src} alt={item.alt || ""} draggable={false}
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                    className="object-contain pointer-events-none select-none max-w-full max-h-full w-auto h-auto"
                    style={{
                        maxHeight: "calc(100vh - 105px)",
                        maxWidth: "calc(100vw - 24px)",
                        transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                        transition: dragging ? "none" : "transform 150ms ease-out"
                    }}
                />
                {count > 1 && (
                    <>
                        <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-white hover:bg-black/80"><ChevronLeft size={24} /></button>
                        <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-white hover:bg-black/80"><ChevronRight size={24} /></button>
                    </>
                )}
            </div>
            <div className="text-center text-[11px] text-white/60 py-2 border-t border-white/10 shrink-0">Scroll, pinch or double-click to zoom · Arrow keys or drag to pan · Esc to close</div>
        </div>
    );
}
