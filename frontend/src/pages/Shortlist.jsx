import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import api from "@/lib/api";
import Seo from "@/components/Seo";
import PropertyCard from "@/components/PropertyCard";
import { useShortlist } from "@/lib/listStore";

export default function Shortlist() {
    const { ids, clear } = useShortlist();
    const [items, setItems] = useState([]);
    const [state, setState] = useState("loading");

    useEffect(() => {
        let alive = true;
        if (!ids.length) { setItems([]); setState("ready"); return undefined; }
        setState("loading");
        // the endpoint accepts a limited number of ids per call, so ask in chunks
        const chunks = [];
        for (let i = 0; i < ids.length; i += 12) chunks.push(ids.slice(i, i + 12));
        Promise.all(chunks.map((c) => api.get(`/properties?ids=${c.join(",")}&limit=12`)))
            .then((res) => {
                if (!alive) return;
                const byId = Object.fromEntries(res.flatMap((r) => r.data).map((p) => [p.id, p]));
                setItems(ids.map((id) => byId[id]).filter(Boolean));
                setState("ready");
            })
            .catch(() => alive && setState("error"));
        return () => { alive = false; };
    }, [ids]);

    return (
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14" data-testid="shortlist-page">
            <Seo title="My shortlisted properties | Elegant Home Advisors" description="Properties you have saved." path="/shortlist" />
            <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
                <div>
                    <div className="overline">Saved on this device</div>
                    <h1 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2">My Shortlisted Properties</h1>
                </div>
                {items.length > 0 && <button type="button" className="text-sm text-slate-500 underline" onClick={clear}>Clear all</button>}
            </div>

            {state === "loading" && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">{ids.slice(0, 3).map((i) => <div key={i} className="h-96 rounded-2xl skeleton" />)}</div>}
            {state === "error" && (
                <div role="alert" className="text-center py-20">
                    <div className="font-serif-display text-3xl text-[var(--navy)]">We couldn't load your saved properties</div>
                    <button className="btn-primary mt-6" onClick={() => window.location.reload()}>Try again</button>
                </div>
            )}
            {state === "ready" && items.length === 0 && (
                <div className="text-center py-24">
                    <Heart size={36} className="mx-auto text-[var(--gold)]" aria-hidden="true" />
                    <div className="font-serif-display text-3xl text-[var(--navy)] mt-4">No saved properties</div>
                    <p className="text-slate-600 mt-2">Save properties to easily compare them later.</p>
                    <Link to="/properties" className="btn-primary mt-6 inline-flex">Browse properties</Link>
                </div>
            )}
            {state === "ready" && items.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{items.map((p) => <PropertyCard key={p.id} property={p} />)}</div>
            )}
        </div>
    );
}
