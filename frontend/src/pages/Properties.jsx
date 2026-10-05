import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import PropertyCard from "@/components/PropertyCard";
import Seo from "@/components/Seo";
import { BUDGETS, PRICE_STEPS } from "@/lib/filters";
import { formatPrice } from "@/lib/api";
import { Search, SlidersHorizontal, X, SearchX } from "lucide-react";

const PAGE_SIZE = 12;
const SORTS = [
    ["relevance", "Relevance"], ["newest", "Newest first"], ["price_asc", "Price: low to high"],
    ["price_desc", "Price: high to low"], ["area_desc", "Carpet area: largest first"], ["area_asc", "Carpet area: smallest first"],
];
const FALLBACK = {
    categories: ["Presidential Properties", "Under Construction", "Ready to Move"],
    locations: [], possession_statuses: ["Ready to Move", "Under Construction", "New Launch"],
    configurations: ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Villa", "Penthouse"],
    builders: [], localities: [], property_types: [], amenities: [],
};

export default function Properties() {
    const [params, setParams] = useSearchParams();
    const [properties, setProperties] = useState([]);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState("loading");        // loading | ready | error
    const [loadingMore, setLoadingMore] = useState(false);
    const [meta, setMeta] = useState(FALLBACK);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [search, setSearch] = useState(params.get("q") || "");
    const drawerRef = useRef(null);

    const f = {
        q: params.get("q") || "", category: params.get("category") || "", location: params.get("location") || "",
        locality: params.get("locality") || "", builder: params.get("builder") || "", property_type: params.get("property_type") || "",
        possession_status: params.get("possession_status") || "", configuration: params.get("configuration") || "",
        budget: params.get("budget") || "", min_price: params.get("min_price") || "", max_price: params.get("max_price") || "",
        min_area: params.get("min_area") || "", max_area: params.get("max_area") || "",
        amenities: params.get("amenities") || "", featured: params.get("featured") || "", ready: params.get("ready") || "",
        sort: params.get("sort") || "relevance",
    };

    const setFilter = useCallback((k, v) => {
        setParams((prev) => {
            const p = new URLSearchParams(prev);
            if (v) p.set(k, v); else p.delete(k);
            if (k === "budget") { p.delete("min_price"); p.delete("max_price"); }
            if (k === "min_price" || k === "max_price") p.delete("budget");
            return p;
        }, { replace: true });
    }, [setParams]);

    // search box: wait for a pause in typing before querying
    useEffect(() => {
        const t = setTimeout(() => { if (search !== f.q) setFilter("q", search.trim()); }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);
    useEffect(() => { setSearch(params.get("q") || ""); }, [params]);

    const query = useMemo(() => {
        const p = new URLSearchParams();
        ["q", "category", "location", "locality", "builder", "property_type", "possession_status", "configuration", "amenities", "min_area", "max_area", "sort"]
            .forEach((k) => f[k] && p.set(k, f[k]));
        if (f.featured) p.set("featured", "true");
        if (f.ready) p.set("ready", "true");
        const b = BUDGETS.find((x) => x.label === f.budget);
        if (b) { p.set("min_price", b.min); p.set("max_price", b.max); }
        else { if (f.min_price) p.set("min_price", f.min_price); if (f.max_price) p.set("max_price", f.max_price); }
        return p.toString();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.toString()]);

    const fetchPage = useCallback(async (skip) => {
        const { data, headers } = await api.get(`/properties?${query}&limit=${PAGE_SIZE}&skip=${skip}`);
        return { data, total: Number(headers["x-total-count"] ?? data.length) };
    }, [query]);

    const load = useCallback(() => {
        setStatus("loading");
        fetchPage(0).then(({ data, total: t }) => { setProperties(data); setTotal(t); setStatus("ready"); }).catch(() => setStatus("error"));
    }, [fetchPage]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const { data, total: t } = await fetchPage(properties.length);
            setProperties((prev) => [...prev, ...data.filter((d) => !prev.some((p) => p.id === d.id))]);
            setTotal(t);
        } catch { setStatus("error"); } finally { setLoadingMore(false); }
    };

    useEffect(() => { api.get("/meta/filters").then((r) => setMeta({ ...FALLBACK, ...r.data })).catch(() => {}); }, []);
    useEffect(() => { load(); }, [load]);

    // mobile filter drawer: Esc closes, page behind doesn't scroll
    useEffect(() => {
        if (!filtersOpen) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => e.key === "Escape" && setFiltersOpen(false);
        window.addEventListener("keydown", onKey);
        drawerRef.current?.focus();
        return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    }, [filtersOpen]);

    const clear = () => { setSearch(""); setParams(new URLSearchParams(), { replace: true }); };
    const activeCount = Object.entries(f).filter(([k, v]) => v && k !== "sort").length;
    const selectedAmenities = f.amenities ? f.amenities.split(",") : [];
    const toggleAmenity = (a) => setFilter("amenities", (selectedAmenities.includes(a) ? selectedAmenities.filter((x) => x !== a) : [...selectedAmenities, a]).join(","));

    return (
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14" data-testid="properties-page">
            <Seo
                title={`${f.location ? `Properties in ${f.location}` : "Properties"} | Elegant Home Advisors`}
                description="Browse verified apartments and villas, filter by budget, area and configuration, and book a site visit."
                path="/properties"
            />
            <div className="mb-8">
                <div className="overline">Discover</div>
                <h1 className="font-serif-display text-5xl text-[var(--navy)] mt-2">Curated Properties</h1>
                <p className="text-slate-600 mt-3 max-w-xl" aria-live="polite">
                    {status === "ready" ? `${total} ${total === 1 ? "home matches" : "homes match"} your search.` : "Finding homes…"}
                </p>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
                <button type="button" onClick={() => setFiltersOpen(true)} className="lg:hidden btn-outline-gold text-sm" data-testid="mobile-filters-btn">
                    <SlidersHorizontal size={16} /> Filters {activeCount ? `(${activeCount})` : ""}
                </button>
                <label className="flex items-center gap-2 text-sm text-slate-600 ml-auto">
                    Sort by
                    <select value={f.sort} onChange={(e) => setFilter("sort", e.target.value === "relevance" ? "" : e.target.value)} className="field-input !w-auto bg-white" data-testid="sort-select">
                        {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-10">
                <aside
                    ref={drawerRef} tabIndex={-1} aria-label="Filters" data-testid="filters-sidebar"
                    className={filtersOpen ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto" : "hidden lg:block"}
                    {...(filtersOpen ? { role: "dialog", "aria-modal": "true" } : {})}
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="font-serif-display text-2xl text-[var(--navy)]">Filters</div>
                        <div className="flex items-center gap-3">
                            {activeCount > 0 && <button type="button" onClick={clear} className="text-xs text-slate-500 underline" data-testid="clear-filters">Clear all</button>}
                            <button type="button" className="lg:hidden" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X /></button>
                        </div>
                    </div>

                    <div className="relative mb-6">
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
                        <input aria-label="Search project, builder or location" placeholder="Search project, builder…" value={search} onChange={(e) => setSearch(e.target.value)}
                            className="field-input !pl-9" data-testid="filter-search" />
                    </div>

                    <Toggle label="Ready to move" checked={!!f.ready} onChange={(v) => setFilter("ready", v ? "1" : "")} testId="filter-ready" />
                    <Toggle label="Featured only" checked={!!f.featured} onChange={(v) => setFilter("featured", v ? "1" : "")} testId="filter-featured" />

                    <Group title="Category" items={meta.categories} value={f.category} onChange={(v) => setFilter("category", v)} testKey="category" />
                    <Group title="Location" items={meta.locations} value={f.location} onChange={(v) => setFilter("location", v)} testKey="location" />
                    {meta.localities.length > 0 && <Group title="Locality" items={meta.localities} value={f.locality} onChange={(v) => setFilter("locality", v)} testKey="locality" />}
                    {meta.property_types.length > 0 && <Group title="Property type" items={meta.property_types} value={f.property_type} onChange={(v) => setFilter("property_type", v)} testKey="type" />}
                    <Group title="Budget" items={BUDGETS.map((b) => b.label)} value={f.budget} onChange={(v) => setFilter("budget", v)} testKey="budget" />

                    <div className="mb-6">
                        <div className="text-xs uppercase tracking-widest text-slate-500 mb-2.5">Custom budget</div>
                        <div className="grid grid-cols-2 gap-2">
                            <select aria-label="Minimum price" value={f.min_price} onChange={(e) => setFilter("min_price", e.target.value)} className="field-input bg-white">
                                <option value="">Min</option>{PRICE_STEPS.map((n) => <option key={n} value={n}>{formatPrice(n)}</option>)}
                            </select>
                            <select aria-label="Maximum price" value={f.max_price} onChange={(e) => setFilter("max_price", e.target.value)} className="field-input bg-white">
                                <option value="">Max</option>{PRICE_STEPS.map((n) => <option key={n} value={n}>{formatPrice(n)}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="text-xs uppercase tracking-widest text-slate-500 mb-2.5">Carpet area (sq.ft)</div>
                        <div className="grid grid-cols-2 gap-2">
                            <input aria-label="Minimum carpet area" type="number" min="0" inputMode="numeric" placeholder="Min" value={f.min_area} onChange={(e) => setFilter("min_area", e.target.value)} className="field-input" />
                            <input aria-label="Maximum carpet area" type="number" min="0" inputMode="numeric" placeholder="Max" value={f.max_area} onChange={(e) => setFilter("max_area", e.target.value)} className="field-input" />
                        </div>
                    </div>

                    <Group title="Configuration" items={meta.configurations} value={f.configuration} onChange={(v) => setFilter("configuration", v)} testKey="config" />
                    <Group title="Possession" items={meta.possession_statuses} value={f.possession_status} onChange={(v) => setFilter("possession_status", v)} testKey="possession" />
                    <Group title="Builder" items={meta.builders} value={f.builder} onChange={(v) => setFilter("builder", v)} testKey="builder" />

                    {meta.amenities.length > 0 && (
                        <div className="mb-6">
                            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2.5">Amenities</div>
                            <div className="flex flex-wrap gap-2">
                                {meta.amenities.slice(0, 16).map((a) => (
                                    <button key={a} type="button" aria-pressed={selectedAmenities.includes(a)} onClick={() => toggleAmenity(a)}
                                        className={`text-xs px-3 py-1.5 rounded-full border ${selectedAmenities.includes(a) ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-slate-300 text-slate-700"}`}>{a}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button type="button" onClick={() => setFiltersOpen(false)} className="btn-primary w-full justify-center mt-4 lg:hidden">Show {total} homes</button>
                </aside>

                <div>
                    {status === "loading" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
                            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[28rem] rounded-2xl skeleton" />)}
                        </div>
                    )}
                    {status === "error" && (
                        <div role="alert" className="text-center py-24">
                            <div className="font-serif-display text-3xl text-[var(--navy)]">We couldn't load properties right now</div>
                            <p className="text-slate-500 mt-2">Please check your connection and try again.</p>
                            <button type="button" onClick={load} className="btn-primary mt-6">Try again</button>
                        </div>
                    )}
                    {status === "ready" && properties.length === 0 && (
                        <div className="text-center py-24">
                            <SearchX size={36} className="mx-auto text-[var(--gold)]" aria-hidden="true" />
                            <div className="font-serif-display text-3xl text-[var(--navy)] mt-4">No properties found</div>
                            <p className="text-slate-500 mt-2">Try changing your budget, location or configuration.</p>
                            <button type="button" onClick={clear} className="btn-outline-gold mt-6">Clear filters</button>
                        </div>
                    )}
                    {status === "ready" && properties.length > 0 && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
                            </div>
                            {properties.length < total && (
                                <div className="text-center mt-10">
                                    <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-outline-gold disabled:opacity-60" data-testid="load-more">
                                        {loadingMore ? "Loading…" : `Show more (${total - properties.length} left)`}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Toggle({ label, checked, onChange, testId }) {
    return (
        <label className="flex items-center justify-between py-2 mb-2 text-sm text-slate-700 cursor-pointer">
            {label}
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[var(--navy)]" data-testid={testId} />
        </label>
    );
}

function Group({ title, items = [], value, onChange, testKey }) {
    if (!items.length) return null;
    return (
        <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2.5">{title}</div>
            <div className="space-y-1.5">
                {items.map((it) => (
                    <button
                        key={it} type="button" aria-pressed={value === it} onClick={() => onChange(value === it ? "" : it)}
                        data-testid={`filter-${testKey}-${it.toLowerCase().replace(/\s+/g, "-")}`}
                        className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors duration-200 ${value === it ? "bg-[var(--navy)] text-white" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                        {it}
                    </button>
                ))}
            </div>
        </div>
    );
}
