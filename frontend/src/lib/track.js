import { API } from "@/lib/api";

/**
 * Privacy-friendly event tracking: only the event type and property id are sent.
 * The server stores no IP address, cookie or user agent. Failures are silent by design.
 */
export function track(type, propertyId = "") {
    try {
        fetch(`${API}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, property_id: propertyId || "" }),
            keepalive: true,
        }).catch(() => {});
    } catch {
        /* analytics must never break the page */
    }
}

/** Counts a property view once per browser session. */
export function trackViewOnce(propertyId) {
    try {
        const key = `eha_viewed_${propertyId}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
    } catch {
        /* storage blocked: fall through and count it */
    }
    track("property_view", propertyId);
}
