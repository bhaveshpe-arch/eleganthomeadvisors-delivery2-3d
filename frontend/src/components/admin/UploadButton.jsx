import React, { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

/**
 * Lets the admin pick an image from their computer. It is sent to the backend (stored in the database, shrunk to
 * a web-friendly size) and onDone gets the full link to use in the property. Several files can be chosen at once
 * when `multiple` is set; onDone is then called with a list of links.
 */
export default function UploadButton({ onDone, multiple = false, label = "Upload", className = "", testId }) {
    const input = useRef(null);
    const [busy, setBusy] = useState(false);
    const base = process.env.REACT_APP_BACKEND_URL || "";

    const pick = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length || busy) return;
        setBusy(true);
        const urls = [];
        for (const file of files) {
            try {
                const fd = new FormData();
                fd.append("file", file);
                const { data } = await api.post("/uploads", fd);
                urls.push(`${base}${data.path}`);
            } catch (err) {
                toast.error(`${file.name}: ${err?.response?.data?.detail || "upload failed. Please try again."}`);
            }
        }
        setBusy(false);
        if (urls.length) {
            onDone(multiple ? urls : urls[0]);
            toast.success(urls.length > 1 ? `${urls.length} images uploaded` : "Image uploaded");
        }
    };

    return (
        <>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
            <button type="button" onClick={() => input.current?.click()} disabled={busy} data-testid={testId}
                className={`inline-flex items-center gap-1.5 text-xs rounded-full border border-slate-300 bg-white px-3 py-2 text-[var(--navy)] hover:border-[var(--gold)] disabled:opacity-60 whitespace-nowrap ${className}`}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {busy ? "Uploading…" : label}
            </button>
        </>
    );
}
