import React, { useEffect, useState } from "react";
import { feetInches, parseFeet } from "@/lib/media";

export const Mini = ({ label, onClick, disabled, danger, children }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
        className={`p-2 rounded-lg shrink-0 disabled:opacity-30 ${danger ? "text-red-500 hover:bg-red-50" : "text-slate-500 hover:bg-slate-200"}`}>{children}</button>
);

/** Accepts 19'7", 19 7 or 19.6 and stores decimal feet. */
export function FeetInput({ value, onChange, label }) {
    const [text, setText] = useState(value ? feetInches(value) : "");
    useEffect(() => { setText(value ? feetInches(value) : ""); }, [value]);
    return (
        <input value={text} aria-label={label} placeholder={label}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => { const v = parseFeet(text); onChange(v); setText(v ? feetInches(v) : ""); }}
            className="field-input" />
    );
}

export function useDebounced(value, ms = 400) {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
    return v;
}
