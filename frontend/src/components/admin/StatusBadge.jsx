import React from "react";
import { statusMeta } from "@/lib/leadStatus";

export default function StatusBadge({ status }) {
    const m = statusMeta(status);
    return <span className={`inline-block whitespace-nowrap text-[11px] font-medium px-2.5 py-1 rounded-full ${m.cls}`}>{m.label}</span>;
}
