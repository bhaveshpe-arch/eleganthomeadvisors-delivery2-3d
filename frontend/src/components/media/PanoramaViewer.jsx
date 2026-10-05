import React, { useEffect, useRef, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";

/**
 * Real 360° viewer (Pannellum). It needs an equirectangular panorama image (2:1 ratio).
 * The library is only downloaded when this component is shown.
 * Cross-origin panoramas must be served with CORS headers (Cloudinary, S3 and most CDNs can do this).
 */
export default function PanoramaViewer({ src, title }) {
    const holder = useRef(null);
    const [state, setState] = useState("loading");

    useEffect(() => {
        let viewer;
        let cancelled = false;
        setState("loading");
        (async () => {
            try {
                await import("pannellum/build/pannellum.css");
                await import("pannellum/build/pannellum.js");
                if (cancelled || !holder.current || !window.pannellum) return;
                viewer = window.pannellum.viewer(holder.current, {
                    type: "equirectangular",
                    panorama: src,
                    autoLoad: true,
                    showFullscreenCtrl: true,
                    showZoomCtrl: true,
                    mouseZoom: true,
                    draggable: true,
                    keyboardZoom: true,
                    hfov: 100,
                    compass: false,
                    title: title || "",
                });
                viewer.on("load", () => !cancelled && setState("ready"));
                viewer.on("error", () => !cancelled && setState("error"));
            } catch {
                if (!cancelled) setState("error");
            }
        })();
        return () => {
            cancelled = true;
            try { viewer?.destroy(); } catch { /* already gone */ }
        };
    }, [src, title]);

    return (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 h-[320px] md:h-[480px]" data-testid="panorama-viewer">
            <div ref={holder} className="w-full h-full" role="img" aria-label={`360 degree view of ${title || "the property"}. Drag to look around.`} />
            {state === "loading" && (
                <div className="absolute inset-0 grid place-items-center text-white/80 bg-slate-900/70 text-sm" role="status">
                    <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading 360° view…</span>
                </div>
            )}
            {state === "error" && (
                <div className="absolute inset-0 grid place-items-center text-center px-6 bg-slate-900 text-white/90 text-sm" role="alert">
                    <div>
                        <p>We couldn't load the 360° view right now.</p>
                        <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 underline">Open the image directly <ExternalLink size={14} /></a>
                    </div>
                </div>
            )}
            {state === "ready" && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] bg-black/55 text-white px-3 py-1 rounded-full pointer-events-none">
                    Drag to look around · scroll or pinch to zoom
                </div>
            )}
        </div>
    );
}
