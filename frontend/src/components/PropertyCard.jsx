import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Home, Ruler, CalendarClock, Star, MessageSquare, CalendarCheck } from "lucide-react";
import { SaveButton, CompareButton } from "@/components/PropertyActions";
import LeadDialog from "@/components/LeadDialog";
import { PLACEHOLDER_IMG, formatSqft, propertyCarpetArea } from "@/lib/media";

const badgeColors = {
    "New Launch": "bg-emerald-500 text-white",
    "Hot Deal": "bg-red-500 text-white",
    "Limited Inventory": "bg-amber-500 text-white",
    "Sold Out": "bg-slate-500 text-white",
};

export default function PropertyCard({ property, reasons = [] }) {
    const [dialog, setDialog] = useState(null);   // "enquiry" | "site_visit"
    const area = propertyCarpetArea(property);
    const place = [property.locality, property.location].filter(Boolean).join(", ");
    const detail = `/property/${property.slug}`;

    const facts = [
        { icon: Home, label: "Configuration", value: property.configuration },
        area ? { icon: Ruler, label: "Carpet area", value: formatSqft(area) } : null,
        { icon: CalendarClock, label: "Possession", value: property.possession || property.possession_status },
    ].filter((f) => f && f.value);

    return (
        <article className="card-elegant overflow-hidden group flex flex-col border border-slate-200/80 hover:border-[var(--gold)]/50 transition-all duration-300 shadow-sm hover:shadow-xl" data-testid={`property-card-${property.slug}`}>
            <div className="relative h-64 overflow-hidden bg-slate-100">
                <Link to={detail} className="block h-full" aria-label={`View ${property.name}`}>
                    <img
                        src={property.cover_image || property.images?.[0] || PLACEHOLDER_IMG}
                        alt={`${property.name} in ${place}`}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy" decoding="async"
                        onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                    />
                </Link>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                <div className="absolute top-3.5 left-3.5 flex gap-1.5 flex-wrap pointer-events-none">
                    {property.badge && (
                        <span className={`text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full shadow-sm ${badgeColors[property.badge] || "bg-slate-800 text-white"}`}>{property.badge}</span>
                    )}
                    {property.featured && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-[var(--gold)] text-[var(--navy)] shadow-sm"><Star size={10} aria-hidden="true" /> Featured</span>
                    )}
                    <span className="text-[10px] uppercase tracking-wider font-medium px-2.5 py-1 rounded-full bg-white/95 text-[var(--navy)] backdrop-blur-sm shadow-sm">{property.category}</span>
                </div>
                <div className="absolute top-3.5 right-3.5 flex flex-col gap-1.5 z-10">
                    <SaveButton property={property} />
                    <CompareButton property={property} />
                </div>
                {/* Price overlay on image bottom-left for immediate discovery */}
                <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between pointer-events-none text-white">
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-200 font-light">Starting from</div>
                        <div className="font-serif-display text-2xl font-medium tracking-tight text-white drop-shadow-sm">{property.starting_price}</div>
                    </div>
                    {property.rera_number && (
                        <span className="text-[9px] bg-black/40 backdrop-blur-md text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-md font-mono">
                            RERA Verified
                        </span>
                    )}
                </div>
            </div>

            <div className="p-5 flex flex-col flex-1 bg-white justify-between">
                <div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-widest text-[var(--gold-dark)] font-semibold truncate">{property.builder}</span>
                        {property.property_type && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{property.property_type}</span>
                        )}
                    </div>
                    <h3 className="font-serif-display text-2xl text-[var(--navy)] mt-1 leading-snug">
                        <Link to={detail} className="hover:text-[var(--gold-dark)] transition-colors duration-200">{property.name}</Link>
                    </h3>
                    <div className="mt-1.5 flex items-center gap-1.5 text-slate-500 text-xs truncate"><MapPin size={13} className="text-[var(--gold)] shrink-0" aria-hidden="true" /> {place}</div>

                    {facts.length > 0 && (
                        <div className="mt-3.5 py-2.5 px-3 rounded-xl bg-slate-50/80 border border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                            {facts.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-center gap-1.5 truncate">
                                    <Icon size={13} className="text-[var(--gold)] shrink-0" aria-hidden="true" />
                                    <span className="truncate">{value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {reasons.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1" aria-label="Why this is similar">
                            {reasons.map((r) => <span key={r} className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/50 px-2 py-0.5 rounded-full">{r}</span>)}
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setDialog("site_visit")} className="flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-full bg-[var(--gold)] hover:bg-[var(--gold-dark)] text-[var(--navy)] font-semibold transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95" data-testid={`visit-${property.slug}`}>
                            <CalendarCheck size={14} /> Schedule Visit
                        </button>
                        <button type="button" onClick={() => setDialog("enquiry")} className="flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-full bg-[var(--navy)] hover:bg-[var(--navy-hover)] text-white font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95" data-testid={`enquire-${property.slug}`}>
                            <MessageSquare size={14} /> Enquire
                        </button>
                    </div>
                </div>
            </div>
            {dialog && <LeadDialog mode={dialog} open onOpenChange={(o) => !o && setDialog(null)} property={property} source="property_card"
                defaultMessage={dialog === "enquiry" ? `Hi, I am interested in ${property.name}. Please share pricing and availability.` : ""} />}
        </article>
    );
}
