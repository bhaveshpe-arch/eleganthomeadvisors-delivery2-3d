import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { BedDouble, Bath, Download, Expand, Building2, X, CalendarCheck, PhoneCall, MessageSquare, Box } from "lucide-react";
import Lightbox from "@/components/Lightbox";
import { feetInches, formatSqft, metres, safeUrl, sqftToSqm, PLACEHOLDER_IMG } from "@/lib/media";

const Plan3D = lazy(() => import("@/components/media/Plan3D"));

const parseSqft = (f) => {
    if (f.carpet_area_sqft) return Number(f.carpet_area_sqft);
    const m = String(f.area || "").match(/[\d,]+(?:\.\d+)?/);
    return m ? Number(m[0].replace(/,/g, "")) : 0;
};

const normalize = (f) => {
    const image = safeUrl(f.image);
    return {
        ...f,
        sqft: parseSqft(f),
        image,
        image3d: safeUrl(f.image_3d),
        download: safeUrl(f.download_url),
        rooms: (f.rooms || []).filter((r) => r.name),
        canAuto: !!f.auto_3d && !!image,
        areaType: f.area_type || (f.carpet_area_sqft ? "Carpet Area" : ""),
    };
};

const hasDetail = (p) => !!(p.image || p.image3d || p.rooms.length || p.canAuto);
const possessionLine = (property) =>
    !property.possession ? "" : /ready/i.test(property.possession) ? "Ready to move" : `${property.possession} possession`;

/**
 * "Floor Plans & Pricing": one card per layout (size, price, status, 3D picture when available).
 * Clicking a card opens the full view with room sizes, room highlight and an approximate 3D view.
 */
export default function FloorPlans({ property, onAction }) {
    const plans = useMemo(() => (property.floor_plans || []).map(normalize), [property.floor_plans]);
    const typeLabel = property.property_type || "";
    const groupOf = (p) => `${p.config || "Layout"}${typeLabel ? ` ${typeLabel}` : ""}`;
    const groups = useMemo(() => [...new Set(plans.map(groupOf))], [plans]); // eslint-disable-line react-hooks/exhaustive-deps
    const [group, setGroup] = useState(groups[0]);
    const [show3d, setShow3d] = useState(false);
    const [detail, setDetail] = useState(null);       // index in `plans`
    const any3d = plans.some((p) => p.image3d || p.canAuto);
    const visible = plans.map((p, i) => ({ p, i })).filter(({ p }) => groupOf(p) === (groups.includes(group) ? group : groups[0])); // eslint-disable-line react-hooks/exhaustive-deps

    if (!plans.length) return null;
    const status = property.possession_status;
    const when = possessionLine(property);

    return (
        <div className="mt-6" data-testid="floorplan-cards">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div role="tablist" aria-label="Layout types" className="flex gap-2 flex-wrap">
                    {groups.map((g) => (
                        <button key={g} role="tab" type="button" aria-selected={g === (groups.includes(group) ? group : groups[0])} onClick={() => setGroup(g)}
                            className={`text-sm px-4 py-2 rounded-full border ${g === (groups.includes(group) ? group : groups[0]) ? "bg-sky-50 border-sky-300 text-[var(--navy)] font-medium" : "border-slate-300 text-slate-700 bg-white"}`}>
                            {g}
                        </button>
                    ))}
                </div>
                {any3d && (
                    <button type="button" aria-pressed={show3d} onClick={() => setShow3d((v) => !v)} data-testid="toggle-3d"
                        className={`inline-flex items-center gap-1.5 text-sm font-medium ${show3d ? "text-[var(--navy)]" : "text-sky-700"} underline-offset-4 hover:underline`}>
                        <Box size={15} /> {show3d ? "Showing 3D views" : "View homes in 3D"}
                    </button>
                )}
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-3 md:p-4">
                <div className="text-xs text-slate-500 px-1 pb-3">{visible.length} floor plan{visible.length > 1 ? "s" : ""} available</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visible.map(({ p, i }) => {
                        const img = show3d && p.image3d ? p.image3d : p.image || p.image3d;
                        const clickable = hasDetail(p);
                        return (
                            <article key={i} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col shadow-sm" data-testid={`plan-card-${i}`}>
                                <div className="flex items-center gap-2">
                                    <Building2 size={16} className="text-sky-600 shrink-0" aria-hidden="true" />
                                    <div className="font-semibold text-[var(--navy)]">
                                        {p.sqft ? <>{formatSqft(p.sqft)} <span className="font-normal text-slate-400 text-sm">({sqftToSqm(p.sqft)} sqm)</span></> : p.area}
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{[p.areaType, p.config].filter(Boolean).join(" | ")}</div>

                                <button type="button" disabled={!clickable} onClick={() => setDetail(i)} aria-label={`Open ${p.config} floor plan details`}
                                    className={`relative mt-3 block rounded-xl overflow-hidden bg-slate-50 border border-slate-100 h-44 ${clickable ? "cursor-zoom-in" : "cursor-default"}`}>
                                    {img ? (
                                        <img src={img} alt={`${p.config} floor plan of ${property.name}`} loading="lazy" decoding="async" className="w-full h-full object-contain"
                                            onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                                    ) : (
                                        <span className="w-full h-full grid place-items-center text-xs text-slate-400">Layout image coming soon</span>
                                    )}
                                    {(p.image3d || p.canAuto) && <span className="absolute top-2 left-2 text-[10px] bg-sky-600 text-white px-2 py-0.5 rounded-full">3D</span>}
                                    {clickable && <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] bg-white/90 border border-slate-200 px-2 py-0.5 rounded-full"><Expand size={10} /> View details</span>}
                                </button>

                                <div className="mt-4 text-xl font-semibold text-[var(--navy)]">{p.price}</div>
                                {(status || when) && (
                                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                                        {status && <div className="text-slate-500">{status}</div>}
                                        {when && <div className="font-semibold text-[var(--navy)]">{when}</div>}
                                    </div>
                                )}
                                <div className="mt-auto pt-4 flex items-center justify-between">
                                    <button type="button" onClick={() => onAction("callback", p)} className="text-sm font-semibold text-sky-700 hover:underline" data-testid={`plan-callback-${i}`}>Request Callback</button>
                                    <button type="button" onClick={() => onAction("site_visit", p)} aria-label={`Schedule a site visit for the ${p.config} layout`} title="Schedule site visit"
                                        className="w-9 h-9 rounded-full grid place-items-center text-sky-700 hover:bg-sky-50" data-testid={`plan-visit-${i}`}><CalendarCheck size={18} /></button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Sizes, layouts and 3D views are indicative and may differ from the final built unit.</p>

            {detail != null && plans[detail] && (
                <PlanDetail
                    plan={plans[detail]} property={property}
                    initialView={show3d ? (plans[detail].image3d ? "3d" : plans[detail].canAuto ? "auto" : "2d") : "2d"}
                    onClose={() => setDetail(null)}
                    onAction={(kind) => { const p = plans[detail]; setDetail(null); onAction(kind, p); }}
                />
            )}
        </div>
    );
}

function PlanDetail({ plan, property, initialView, onClose, onAction }) {
    const views = [
        plan.image && { id: "2d", label: "2D plan" },
        plan.image3d && { id: "3d", label: "3D image" },
        plan.canAuto && { id: "auto", label: "3D view (approximate)" },
    ].filter(Boolean);
    const [view, setView] = useState(views.some((v) => v.id === initialView) ? initialView : views[0]?.id);
    const [unit, setUnit] = useState("ft");
    const [room, setRoom] = useState(0);
    const [zoom, setZoom] = useState(false);
    const closeRef = useRef(null);

    useEffect(() => {
        const prevFocus = document.activeElement;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeRef.current?.focus();
        const onKey = (e) => { if (e.key === "Escape" && !document.querySelector("[data-testid=lightbox]")) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => { document.body.style.overflow = prevOverflow; window.removeEventListener("keydown", onKey); prevFocus?.focus?.(); };
    }, [onClose]);

    const shownImage = view === "3d" ? plan.image3d : view === "2d" ? plan.image : "";
    const active = plan.rooms[Math.min(room, plan.rooms.length - 1)];
    const box = active && active.x != null && active.w ? active : null;
    const boxOnThisImage = box && ((view === "2d" && (plan.rooms_image || "2d") === "2d") || (view === "3d" && plan.rooms_image === "3d"));
    const dims = (r) => (unit === "ft" ? `${feetInches(r.length_ft)} × ${feetInches(r.width_ft)}` : `${metres(r.length_ft)} × ${metres(r.width_ft)}`);
    const title = `${plan.config}${plan.sqft ? ` · ${formatSqft(plan.sqft)}` : ""}`;

    return (
        <div role="dialog" aria-modal="true" aria-label={`${title} floor plan`} className="fixed inset-0 z-[70] bg-white overflow-y-auto" data-testid="floorplan-detail">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-xs uppercase tracking-widest text-slate-500 truncate">{property.name}</div>
                        <div className="font-serif-display text-2xl text-[var(--navy)] truncate">{title}</div>
                    </div>
                    <button ref={closeRef} type="button" onClick={onClose} aria-label="Close floor plan" className="w-10 h-10 rounded-full hover:bg-slate-100 grid place-items-center" data-testid="floorplan-close"><X size={20} /></button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                    {views.length > 1 && (
                        <div role="tablist" aria-label="Floor plan views" className="flex gap-2 mb-3 flex-wrap">
                            {views.map((v) => (
                                <button key={v.id} role="tab" type="button" aria-selected={view === v.id} onClick={() => setView(v.id)} data-testid={`view-${v.id}`}
                                    className={`text-sm px-4 py-1.5 rounded-full border ${view === v.id ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-slate-300 text-slate-700"}`}>{v.label}</button>
                            ))}
                        </div>
                    )}

                    {view === "auto" ? (
                        <Suspense fallback={<div className="h-[360px] md:h-[520px] rounded-2xl skeleton" />}>
                            <Plan3D src={plan.image} threshold={plan.auto_3d_threshold} detail={plan.auto_3d_detail} height={plan.auto_3d_height} className="h-[360px] md:h-[520px]" />
                        </Suspense>
                    ) : shownImage ? (
                        <div className="relative rounded-2xl border border-slate-200 bg-white p-2 grid place-items-center">
                            <div className="relative inline-block max-w-full" data-testid="plan-image-box">
                                <img src={shownImage} alt={`${plan.config} ${view === "3d" ? "3D" : "2D"} floor plan of ${property.name}`} decoding="async"
                                    className="block max-w-full w-auto h-auto max-h-[62vh]" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                                {boxOnThisImage && (
                                    <div aria-hidden="true" data-testid="room-highlight" className="absolute pointer-events-none rounded-sm border-2 border-sky-500 bg-sky-400/30 transition-all duration-200"
                                        style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }} />
                                )}
                            </div>
                            <button type="button" onClick={() => setZoom(true)} aria-label="View full screen" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow border border-slate-200 grid place-items-center"><Expand size={16} /></button>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-200 h-64 grid place-items-center text-slate-400 text-sm">Layout image not added yet</div>
                    )}
                    <p className="text-[11px] text-slate-500 mt-2">
                        {view === "auto" ? "This 3D view is traced automatically from the 2D drawing. It shows walls only, with no furniture, and heights are not exact. " : ""}
                        Dimensions and sizes are approximate and may vary from the final built layout.
                    </p>
                </div>

                <div className="lg:col-span-2">
                    <div className="p-5 rounded-2xl border border-slate-200 bg-white">
                        {plan.sqft > 0 && (
                            <div>
                                <span className="text-2xl font-semibold text-[var(--navy)]">{formatSqft(plan.sqft)}</span>
                                <span className="text-sm text-slate-500"> ({sqftToSqm(plan.sqft)} sqm){plan.areaType ? ` ${plan.areaType.toLowerCase()}` : ""}</span>
                            </div>
                        )}
                        {(plan.bedrooms > 0 || plan.bathrooms > 0) && (
                            <div className="mt-2 flex gap-5 text-sm text-slate-700">
                                {plan.bedrooms > 0 && <span className="inline-flex items-center gap-1.5"><BedDouble size={16} className="text-[var(--gold)]" /> {plan.bedrooms} Bedroom{plan.bedrooms > 1 ? "s" : ""}</span>}
                                {plan.bathrooms > 0 && <span className="inline-flex items-center gap-1.5"><Bath size={16} className="text-[var(--gold)]" /> {plan.bathrooms} Bathroom{plan.bathrooms > 1 ? "s" : ""}</span>}
                            </div>
                        )}
                        {plan.price && <div className="mt-3 text-xl text-[var(--navy)] font-medium">{plan.price}</div>}

                        {plan.rooms.length > 0 && (
                            <div className="mt-5">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs uppercase tracking-widest text-slate-500">Room sizes</div>
                                    <div className="inline-flex rounded-full border border-slate-300 overflow-hidden text-xs" role="group" aria-label="Units">
                                        {["ft", "m"].map((u) => (
                                            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} data-testid={`unit-${u}`}
                                                className={`px-3 py-1 ${unit === u ? "bg-[var(--navy)] text-white" : "text-slate-700"}`}>{u}</button>
                                        ))}
                                    </div>
                                </div>
                                {active && (
                                    <div className="mt-3 p-4 rounded-xl bg-[var(--cream)] border border-slate-200" aria-live="polite" data-testid="active-room">
                                        <div className="text-sm text-slate-600">{active.name}</div>
                                        <div className="text-xl font-semibold text-[var(--navy)]">{dims(active)}</div>
                                    </div>
                                )}
                                <ul className="mt-3 grid grid-cols-2 gap-2">
                                    {plan.rooms.map((r, i) => (
                                        <li key={i}>
                                            <button type="button" onClick={() => setRoom(i)} aria-pressed={i === room} data-testid={`room-${i}`}
                                                className={`w-full text-left rounded-xl border px-3 py-2 text-xs ${i === room ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}>
                                                <div className="text-slate-500">{r.name}</div>
                                                <div className="font-medium text-[var(--navy)]">{dims(r)}</div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {box && !boxOnThisImage && views.length > 1 && (
                                    <p className="text-[11px] text-slate-500 mt-2">Room highlighting is shown on the {(plan.rooms_image || "2d") === "3d" ? "3D image" : "2D plan"}.</p>
                                )}
                            </div>
                        )}

                        <div className="mt-5 flex flex-col gap-2">
                            <button type="button" onClick={() => onAction("site_visit")} className="btn-gold justify-center text-sm" data-testid="detail-plan-visit"><CalendarCheck size={15} /> Schedule site visit</button>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => onAction("callback")} className="btn-outline-gold justify-center text-sm"><PhoneCall size={14} /> Callback</button>
                                <button type="button" onClick={() => onAction("enquiry")} className="btn-outline-gold justify-center text-sm"><MessageSquare size={14} /> Enquire</button>
                            </div>
                            {(plan.download || shownImage) && (
                                <a href={plan.download || shownImage} target="_blank" rel="noreferrer" download className="text-center text-xs text-slate-500 underline mt-1"><Download size={12} className="inline mr-1" />Download this plan</a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {zoom && shownImage && (
                <Lightbox items={[{ src: shownImage, alt: `${plan.config} floor plan`, download: plan.download || shownImage }]} index={0} onIndex={() => {}} onClose={() => setZoom(false)} label="Floor plan viewer" />
            )}
        </div>
    );
}
