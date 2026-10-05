import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadPlanImage, traceWalls } from "@/lib/plan3d";

const MAX_RECTS = 30000;
const MIN_RECTS = 12;

/**
 * Approximate 3D view built in the browser from a 2D floor-plan drawing: the dark, thick strokes are traced as
 * walls and raised, and the original drawing is laid on the floor. It is a visual aid only: no furniture, no exact
 * heights. The image must be served with CORS headers (Cloudinary and most CDNs do this).
 * onResult({ rects }) lets the admin editor show how many wall pieces were found.
 */
export default function Plan3D({ src, threshold = 115, detail = 1, height = 6, strict = true, onResult, className = "" }) {
    const holder = useRef(null);
    const [state, setState] = useState("loading");
    const [reason, setReason] = useState("");

    useEffect(() => {
        let disposed = false;
        let cleanup = () => {};
        setState("loading");
        setReason("");
        (async () => {
            try {
                const [THREE, controlsMod, img] = await Promise.all([
                    import("three"),
                    import("three/addons/controls/OrbitControls.js"),
                    loadPlanImage(src),
                ]);
                if (disposed || !holder.current) return;
                const { rects, w, h } = traceWalls(img, { threshold, detail });
                onResult?.({ rects: rects.length });
                if (rects.length > MAX_RECTS) throw new Error("too-detailed");
                if (strict && rects.length < MIN_RECTS) throw new Error("no-walls");

                const el = holder.current;
                const s = 100 / w;                                   // plan width maps to 100 world units
                const depth = h * s;
                const wallH = height;                                 // % of plan width, as set by the admin

                const scene = new THREE.Scene();
                scene.add(new THREE.AmbientLight(0xffffff, 1.15));
                const sun = new THREE.DirectionalLight(0xffffff, 1.6);
                sun.position.set(-40, 120, 70);
                scene.add(sun);

                // floor: the original drawing
                const tex = new THREE.Texture(img);
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.anisotropy = 4;
                tex.needsUpdate = true;
                const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, depth), new THREE.MeshBasicMaterial({ map: tex }));
                floor.rotation.x = -Math.PI / 2;
                floor.position.y = -0.02;
                scene.add(floor);

                // walls
                const box = new THREE.BoxGeometry(1, 1, 1);
                const mat = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.95, metalness: 0 });
                const walls = new THREE.InstancedMesh(box, mat, rects.length);
                const m = new THREE.Matrix4();
                rects.forEach((r, i) => {
                    const sx = (r.x1 - r.x0) * s, sz = (r.y1 - r.y0) * s;
                    m.compose(
                        new THREE.Vector3((r.x0 + r.x1) / 2 * s - 50, wallH / 2, (r.y0 + r.y1) / 2 * s - depth / 2),
                        new THREE.Quaternion(),
                        new THREE.Vector3(sx, wallH, sz),
                    );
                    walls.setMatrixAt(i, m);
                });
                walls.instanceMatrix.needsUpdate = true;
                scene.add(walls);

                const camera = new THREE.PerspectiveCamera(35, 1, 1, 1000);
                const dist = Math.max(100, depth) * 1.5;
                camera.position.set(0, dist * 0.82, dist * 0.78);
                camera.lookAt(0, 0, 0);

                const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                el.appendChild(renderer.domElement);
                renderer.domElement.style.display = "block";

                const render = () => renderer.render(scene, camera);
                const controls = new controlsMod.OrbitControls(camera, renderer.domElement);
                controls.enablePan = false;
                controls.enableDamping = false;                       // render only when something changes
                controls.maxPolarAngle = Math.PI / 2 - 0.08;
                controls.minDistance = 35;
                controls.maxDistance = 320;
                controls.addEventListener("change", render);

                // A slow sway keeps the view alive until the visitor touches it (skipped for reduced-motion users).
                let raf = 0, swaying = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                if (swaying) {
                    controls.autoRotate = true;
                    controls.autoRotateSpeed = 0.9;
                    const tick = () => { if (!swaying) return; controls.update(); raf = requestAnimationFrame(tick); };
                    raf = requestAnimationFrame(tick);
                    controls.addEventListener("start", () => { swaying = false; controls.autoRotate = false; cancelAnimationFrame(raf); });
                }

                const resize = () => {
                    const cw = el.clientWidth || 600, ch = el.clientHeight || 400;
                    renderer.setSize(cw, ch, false);
                    renderer.domElement.style.width = "100%";
                    renderer.domElement.style.height = "100%";
                    camera.aspect = cw / ch;
                    camera.updateProjectionMatrix();
                    render();
                };
                const ro = new ResizeObserver(resize);
                ro.observe(el);
                resize();
                setState("ready");

                cleanup = () => {
                    swaying = false; cancelAnimationFrame(raf);
                    ro.disconnect();
                    controls.dispose();
                    box.dispose(); mat.dispose(); walls.dispose();
                    floor.geometry.dispose(); floor.material.dispose(); tex.dispose();
                    renderer.dispose();
                    renderer.domElement.remove();
                };
            } catch (e) {
                if (disposed) return;
                setReason(e.message);
                setState("error");
            }
        })();
        return () => { disposed = true; cleanup(); };
        // onResult is intentionally not a dependency: it is only a notification
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, threshold, detail, height, strict]);

    const messages = {
        "image-blocked": "The 3D view couldn't be built because the plan image is blocked or unavailable. Plan images must be hosted where other websites may read them (for example Cloudinary).",
        "no-walls": "Not enough walls were found in this drawing for a 3D view.",
        "too-detailed": "This drawing is too detailed for an automatic 3D view.",
    };

    return (
        <div className={`relative rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-200 ${className}`} data-testid="plan3d">
            <div ref={holder} className="w-full h-full min-h-[260px]" role="img" aria-label="Approximate 3D view of the floor plan. Drag to rotate." />
            {state === "loading" && (
                <div className="absolute inset-0 grid place-items-center bg-slate-100/80 text-slate-600 text-sm" role="status">
                    <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Building 3D view…</span>
                </div>
            )}
            {state === "error" && (
                <div className="absolute inset-0 grid place-items-center text-center px-6 text-slate-600 text-sm" role="alert" data-testid="plan3d-error">
                    <p>{messages[reason] || "The 3D view isn't available right now."}</p>
                </div>
            )}
            {state === "ready" && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] bg-black/55 text-white px-3 py-1 rounded-full pointer-events-none whitespace-nowrap">
                    Approximate 3D view · drag to rotate · scroll or pinch to zoom
                </div>
            )}
        </div>
    );
}
