import React, { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2 } from "lucide-react";

/**
 * Interactive 3D viewer for GLB / GLTF models (Google <model-viewer>).
 * Rotate with mouse or finger, zoom with scroll or pinch. Library is loaded only when shown.
 */
export default function ModelViewer({ src, poster, title }) {
    const wrap = useRef(null);
    const mv = useRef(null);
    const [lib, setLib] = useState("loading");
    const [state, setState] = useState("loading");

    useEffect(() => {
        let alive = true;
        import("@google/model-viewer").then(() => alive && setLib("ready")).catch(() => alive && setLib("error"));
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        const el = mv.current;
        if (lib !== "ready" || !el) return undefined;
        const onLoad = () => setState("ready");
        const onError = () => setState("error");
        el.addEventListener("load", onLoad);
        el.addEventListener("error", onError);
        return () => { el.removeEventListener("load", onLoad); el.removeEventListener("error", onError); };
    }, [lib, src]);

    const fullscreen = () => {
        const target = wrap.current;
        if (!target) return;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else target.requestFullscreen?.();
    };

    const failed = lib === "error" || state === "error";
    return (
        <div ref={wrap} className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 h-[320px] md:h-[480px]" data-testid="model-viewer">
            {lib === "ready" && !failed && (
                <model-viewer
                    ref={mv}
                    src={src}
                    poster={poster || undefined}
                    alt={`3D model of ${title || "the property"}`}
                    camera-controls=""
                    touch-action="pan-y"
                    shadow-intensity="1"
                    interaction-prompt="auto"
                    style={{ width: "100%", height: "100%", background: "linear-gradient(#f8fafc,#e2e8f0)" }}
                />
            )}
            {!failed && state === "loading" && (
                <div className="absolute inset-0 grid place-items-center bg-slate-100/80 text-slate-600 text-sm pointer-events-none" role="status">
                    <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading 3D model…</span>
                </div>
            )}
            {failed && (
                <div className="absolute inset-0 grid place-items-center text-center px-6 text-slate-600 text-sm" role="alert">
                    <p>We couldn't load the 3D model right now. Please try again later.</p>
                </div>
            )}
            {!failed && (
                <button type="button" onClick={fullscreen} aria-label="Toggle full screen" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 shadow grid place-items-center">
                    <Maximize2 size={16} />
                </button>
            )}
            {state === "ready" && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] bg-black/55 text-white px-3 py-1 rounded-full pointer-events-none">
                    Drag to rotate · scroll or pinch to zoom
                </div>
            )}
        </div>
    );
}
