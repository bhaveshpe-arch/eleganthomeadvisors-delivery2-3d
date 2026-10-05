import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import PropertyCard from "@/components/PropertyCard";

/** Recommendations come only from our own database (GET /properties/{id}/similar). */
export default function SimilarProperties({ propertyId }) {
    const [items, setItems] = useState(null);

    useEffect(() => {
        let alive = true;
        setItems(null);
        api.get(`/properties/${propertyId}/similar?limit=3`)
            .then((r) => alive && setItems(r.data))
            .catch(() => alive && setItems([]));
        return () => { alive = false; };
    }, [propertyId]);

    if (items && items.length === 0) return null;
    return (
        <section className="mt-16" aria-labelledby="similar-heading" data-testid="similar-section">
            <div className="overline">You may also like</div>
            <h2 id="similar-heading" className="font-serif-display text-3xl text-[var(--navy)] mt-2">Similar Properties</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                {items === null
                    ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-96 rounded-2xl skeleton" />)
                    : items.map((p) => <PropertyCard key={p.id} property={p} reasons={p.similarity_reasons} />)}
            </div>
        </section>
    );
}
