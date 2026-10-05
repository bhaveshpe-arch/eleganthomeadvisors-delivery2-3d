import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Scale, X } from "lucide-react";
import { useCompare, MAX_COMPARE } from "@/lib/listStore";

/** Floating bar shown whenever properties have been added to compare. */
export default function CompareBar() {
    const { ids, clear } = useCompare();
    const { pathname } = useLocation();
    if (!ids.length || pathname === "/compare") return null;
    const onDetail = pathname.startsWith("/property/");
    return (
        <div className={`fixed left-1/2 -translate-x-1/2 z-[45] ${onDetail ? "bottom-24 md:bottom-6" : "bottom-6"}`} data-testid="compare-bar">
            <div className="flex items-center gap-3 bg-[var(--navy)] text-white rounded-full pl-5 pr-2 py-2 shadow-xl">
                <Scale size={16} className="text-[var(--gold)]" aria-hidden="true" />
                <span className="text-sm" aria-live="polite">{ids.length} of {MAX_COMPARE} selected</span>
                {ids.length >= 2 ? (
                    <Link to="/compare" className="bg-[var(--gold)] text-[var(--navy)] text-sm font-medium rounded-full px-4 py-1.5">Compare now</Link>
                ) : (
                    <span className="text-xs text-white/70">Add one more</span>
                )}
                <button type="button" onClick={clear} aria-label="Clear compare list" className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10"><X size={16} /></button>
            </div>
        </div>
    );
}
