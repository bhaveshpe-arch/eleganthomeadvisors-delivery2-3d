import React, { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Lightbox from "@/components/Lightbox";
import { PLACEHOLDER_IMG, safeUrl } from "@/lib/media";

/** Photo gallery: large image, thumbnails, swipe, and a full-screen zoomable viewer. */
export default function Gallery({ images = [], name, badge }) {
    const list = images.map(safeUrl).filter(Boolean);
    const [active, setActive] = useState(0);
    const [open, setOpen] = useState(false);
    const touch = useRef(null);
    const count = list.length;

    if (!count) {
        return <div className="rounded-2xl bg-slate-100 h-[320px] grid place-items-center text-slate-400 text-sm">Photos coming soon</div>;
    }
    const step = (d) => setActive((i) => (i + d + count) % count);
    const items = list.map((src, i) => ({ src, alt: `${name} – photo ${i + 1} of ${count}` }));

    return (
        <div data-testid="gallery">
            <div
                className="relative rounded-2xl overflow-hidden h-[320px] md:h-[520px] bg-slate-100"
                onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                    if (touch.current == null) return;
                    const dx = e.changedTouches[0].clientX - touch.current;
                    touch.current = null;
                    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
                }}
            >
                <button type="button" onClick={() => setOpen(true)} className="absolute inset-0 w-full h-full cursor-zoom-in" aria-label={`Open full-screen gallery, photo ${active + 1} of ${count}`}>
                    <img
                        src={list[active]} alt={items[active].alt}
                        className="w-full h-full object-cover" decoding="async"
                        loading={active === 0 ? "eager" : "lazy"} fetchpriority={active === 0 ? "high" : "auto"}
                        onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                    />
                </button>
                {badge && <span className="absolute top-5 left-5 pointer-events-none">{badge}</span>}
                {count > 1 && (
                    <>
                        <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow grid place-items-center"><ChevronLeft size={20} /></button>
                        <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow grid place-items-center"><ChevronRight size={20} /></button>
                    </>
                )}
                <button type="button" onClick={() => setOpen(true)} className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 bg-[var(--navy)]/90 text-white text-xs px-3 py-2 rounded-full">
                    <Expand size={14} /> {active + 1} / {count} · View full screen
                </button>
            </div>

            {count > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scroll-x" role="tablist" aria-label="Photo thumbnails">
                    {list.map((src, i) => (
                        <button key={src + i} type="button" role="tab" aria-selected={active === i} aria-label={`Show photo ${i + 1}`}
                            onClick={() => setActive(i)} data-testid={`thumb-${i}`}
                            className={`shrink-0 rounded-xl overflow-hidden w-24 h-16 md:w-28 md:h-20 ring-2 ${active === i ? "ring-[var(--gold)]" : "ring-transparent"}`}>
                            <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                        </button>
                    ))}
                </div>
            )}
            {open && <Lightbox items={items} index={active} onIndex={setActive} onClose={() => setOpen(false)} label={`${name} photo gallery`} />}
        </div>
    );
}
