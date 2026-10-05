import { useEffect } from "react";

/**
 * Adds the "install as app" manifest only while an employee page is open, so public visitors
 * are never offered an install prompt for the employee app.
 */
export default function useManifest(href = `${process.env.PUBLIC_URL || ""}/manifest.json`) {
    useEffect(() => {
        const link = document.createElement("link");
        link.rel = "manifest";
        link.href = href;
        link.dataset.ehaManifest = "1";
        document.head.appendChild(link);
        return () => link.remove();
    }, [href]);
}
