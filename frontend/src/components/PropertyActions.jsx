import React from "react";
import { Heart, Scale } from "lucide-react";
import { useShortlist, useCompare } from "@/lib/listStore";

/** Heart button. variant="icon" is the round overlay used on cards; "full" is a labelled button. */
export function SaveButton({ property, variant = "icon", className = "" }) {
    const sl = useShortlist();
    const saved = sl.has(property.id);
    const label = saved ? "Remove from shortlist" : "Save property";
    if (variant === "full") {
        return (
            <button type="button" onClick={() => sl.toggle(property)} aria-pressed={saved}
                className={`btn-outline-gold ${className}`} data-testid="detail-save">
                <Heart size={16} className={saved ? "fill-red-500 text-red-500" : ""} /> {saved ? "Saved" : "Save"}
            </button>
        );
    }
    return (
        <button type="button" onClick={(e) => { e.preventDefault(); sl.toggle(property); }} aria-pressed={saved} aria-label={label} title={label}
            className={`w-9 h-9 rounded-full bg-white/95 shadow grid place-items-center text-slate-600 hover:text-red-500 ${className}`}
            data-testid={`save-${property.slug}`}>
            <Heart size={17} className={saved ? "fill-red-500 text-red-500" : ""} />
        </button>
    );
}

export function CompareButton({ property, variant = "icon", className = "" }) {
    const cmp = useCompare();
    const on = cmp.has(property.id);
    const label = on ? "Remove from compare" : "Add to compare";
    if (variant === "full") {
        return (
            <button type="button" onClick={() => cmp.toggle(property)} aria-pressed={on}
                className={`btn-outline-gold ${className}`} data-testid="detail-compare">
                <Scale size={16} className={on ? "text-[var(--gold-dark)]" : ""} /> {on ? "In compare" : "Compare"}
            </button>
        );
    }
    return (
        <button type="button" onClick={(e) => { e.preventDefault(); cmp.toggle(property); }} aria-pressed={on} aria-label={label} title={label}
            className={`w-9 h-9 rounded-full shadow grid place-items-center ${on ? "bg-[var(--navy)] text-white" : "bg-white/95 text-slate-600 hover:text-[var(--navy)]"} ${className}`}
            data-testid={`compare-${property.slug}`}>
            <Scale size={17} />
        </button>
    );
}
