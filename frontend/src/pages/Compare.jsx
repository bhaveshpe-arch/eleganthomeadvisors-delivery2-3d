import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X, CalendarCheck, Scale, Check } from "lucide-react";
import api from "@/lib/api";
import Seo from "@/components/Seo";
import LeadDialog from "@/components/LeadDialog";
import { useCompare, MAX_COMPARE } from "@/lib/listStore";
import { PLACEHOLDER_IMG, formatSqft, propertyCarpetArea } from "@/lib/media";

const cfgKey = (c) => String(c).toLowerCase().replace(/\s+/g, "");
const possessionKey = (p) => p.possession_date || (p.possession_status === "Ready to Move" ? "0000-00-00" : "");

function Best({ children }) {
    return <span className="ml-2 align-middle text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{children}</span>;
}

export default function Compare() {
    const { ids, remove, clear } = useCompare();
    const [items, setItems] = useState([]);
    const [state, setState] = useState("loading");
    const [visitFor, setVisitFor] = useState(null);

    useEffect(() => {
        let alive = true;
        if (!ids.length) { setItems([]); setState("ready"); return undefined; }
        setState("loading");
        api.get(`/properties?ids=${ids.join(",")}&limit=12`)
            .then((r) => {
                if (!alive) return;
                const byId = Object.fromEntries(r.data.map((p) => [p.id, p]));
                setItems(ids.map((id) => byId[id]).filter(Boolean));
                setState("ready");
            })
            .catch(() => alive && setState("error"));
        return () => { alive = false; };
    }, [ids]);

    const best = useMemo(() => {
        const withPrice = items.filter((p) => p.price_min > 0);
        const areas = items.map((p) => [p.id, propertyCarpetArea(p)]).filter(([, a]) => a > 0);
        const poss = items.map((p) => [p.id, possessionKey(p)]).filter(([, k]) => k);
        const counts = {};
        items.forEach((p) => new Set((p.configurations || []).map(cfgKey)).forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
        const shared = new Set(Object.keys(counts).filter((c) => counts[c] >= 2));
        const pick = (arr, cmp) => (arr.length > 1 && new Set(arr.map((x) => x[1])).size > 1 ? arr.reduce((a, b) => (cmp(a[1], b[1]) <= 0 ? a : b))[0] : null);
        return {
            price: withPrice.length > 1 && new Set(withPrice.map((p) => p.price_min)).size > 1 ? withPrice.reduce((a, b) => (a.price_min <= b.price_min ? a : b)).id : null,
            area: pick(areas, (a, b) => b - a),
            possession: pick(poss, (a, b) => (a < b ? -1 : a > b ? 1 : 0)),
            shared,
        };
    }, [items]);

    const amenityCounts = useMemo(() => {
        const c = {};
        items.forEach((p) => (p.amenities || []).forEach((a) => { c[a] = (c[a] || 0) + 1; }));
        return c;
    }, [items]);

    const rows = [
        { label: "Price", cell: (p) => <>{p.starting_price || "—"}{best.price === p.id && <Best>Lowest price</Best>}</> },
        { label: "Location", cell: (p) => [p.locality, p.location].filter(Boolean).join(", ") || "—" },
        { label: "Configuration", cell: (p) => (p.configurations?.length ? (
            <span className="flex flex-wrap gap-1">{p.configurations.map((c) => (
                <span key={c} className={`text-xs px-2 py-0.5 rounded-full ${best.shared.has(cfgKey(c)) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{c}</span>
            ))}</span>
        ) : p.configuration || "—") },
        { label: "Carpet area", cell: (p) => { const a = propertyCarpetArea(p); return <>{a ? formatSqft(a) : "—"}{best.area === p.id && <Best>Largest</Best>}</>; } },
        { label: "Possession", cell: (p) => <>{p.possession || "—"}{best.possession === p.id && <Best>Earliest</Best>}</> },
        { label: "Builder", cell: (p) => p.builder || "—" },
        { label: "Property type", cell: (p) => p.property_type || "—" },
        { label: "Status", cell: (p) => p.possession_status || "—" },
        { label: "RERA", cell: (p) => p.rera_number || "—" },
        { label: "Amenities", cell: (p) => (p.amenities?.length ? (
            <ul className="space-y-1">{p.amenities.slice(0, 10).map((a) => (
                <li key={a} className="flex items-center gap-1.5 text-xs"><Check size={12} className={amenityCounts[a] === items.length && items.length > 1 ? "text-emerald-600" : "text-slate-300"} aria-hidden="true" />{a}</li>
            ))}{p.amenities.length > 10 && <li className="text-xs text-slate-500">+{p.amenities.length - 10} more</li>}</ul>
        ) : "—") },
    ];

    return (
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14" data-testid="compare-page">
            <Seo title="Compare properties | Elegant Home Advisors" description="Compare price, size, location and amenities of the properties you are considering." path="/compare" />
            <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
                <div>
                    <div className="overline">Side by side</div>
                    <h1 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2">Compare Properties</h1>
                </div>
                {items.length > 0 && <button type="button" className="text-sm text-slate-500 underline" onClick={clear}>Clear all</button>}
            </div>

            {state === "loading" && <div className="h-96 rounded-2xl skeleton" aria-busy="true" />}
            {state === "error" && (
                <div role="alert" className="text-center py-20">
                    <div className="font-serif-display text-3xl text-[var(--navy)]">We couldn't load your comparison</div>
                    <p className="text-slate-600 mt-2">Please try again in a moment.</p>
                    <button className="btn-primary mt-6" onClick={() => window.location.reload()}>Try again</button>
                </div>
            )}
            {state === "ready" && items.length === 0 && (
                <div className="text-center py-24">
                    <Scale size={36} className="mx-auto text-[var(--gold)]" aria-hidden="true" />
                    <div className="font-serif-display text-3xl text-[var(--navy)] mt-4">Nothing to compare yet</div>
                    <p className="text-slate-600 mt-2">Add up to {MAX_COMPARE} properties using the scale icon on any property.</p>
                    <Link to="/properties" className="btn-primary mt-6 inline-flex">Browse properties</Link>
                </div>
            )}
            {state === "ready" && items.length === 1 && <p className="text-sm text-slate-600 mb-4">Add at least one more property to see the differences.</p>}

            {state === "ready" && items.length > 0 && (
                <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-sm" style={{ minWidth: 180 + items.length * 240 }}>
                        <caption className="sr-only">Property comparison table</caption>
                        <thead>
                            <tr>
                                <th scope="col" className="sticky left-0 bg-white z-10 w-36 p-4 text-left align-bottom text-xs uppercase tracking-widest text-slate-500">Feature</th>
                                {items.map((p) => (
                                    <th key={p.id} scope="col" className="p-4 align-top text-left font-normal min-w-[220px]">
                                        <div className="relative">
                                            <button type="button" onClick={() => remove(p.id)} aria-label={`Remove ${p.name} from comparison`} className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white shadow grid place-items-center z-10"><X size={14} /></button>
                                            <Link to={`/property/${p.slug}`}>
                                                <img src={p.cover_image || p.images?.[0] || PLACEHOLDER_IMG} alt="" loading="lazy" className="w-full h-32 object-cover rounded-xl" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                                                <div className="font-serif-display text-xl text-[var(--navy)] mt-2 leading-tight">{p.name}</div>
                                            </Link>
                                            <button type="button" onClick={() => setVisitFor(p)} className="mt-3 inline-flex items-center gap-1.5 text-xs bg-[var(--gold)] text-[var(--navy)] rounded-full px-3 py-1.5 font-medium"><CalendarCheck size={13} /> Schedule visit</button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.label} className="border-t border-slate-100">
                                    <th scope="row" className="sticky left-0 bg-white z-10 p-4 text-left align-top text-xs uppercase tracking-widest text-slate-500 font-medium">{r.label}</th>
                                    {items.map((p) => <td key={p.id} className="p-4 align-top text-slate-800">{r.cell(p)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {visitFor && <LeadDialog mode="site_visit" open onOpenChange={(o) => !o && setVisitFor(null)} property={visitFor} source="compare_page" />}
        </div>
    );
}
