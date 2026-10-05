import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { track } from "@/lib/track";

/** A tiny localStorage-backed list shared across components and browser tabs. */
function createListStore(key, max) {
    const listeners = new Set();
    const read = () => {
        try {
            const v = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, max) : [];
        } catch {
            return [];
        }
    };
    let cache = read();
    const emit = () => listeners.forEach((l) => l());
    const write = (arr) => {
        cache = arr;
        try { localStorage.setItem(key, JSON.stringify(arr)); } catch { /* private mode */ }
        emit();
    };
    window.addEventListener("storage", (e) => {
        if (e.key === key) { cache = read(); emit(); }
    });
    return {
        subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
        snapshot: () => cache,
        add: (id) => (cache.includes(id) ? "exists" : cache.length >= max ? "full" : (write([...cache, id]), "added")),
        remove: (id) => write(cache.filter((x) => x !== id)),
        clear: () => write([]),
    };
}

const shortlistStore = createListStore("eha_shortlist", 100);
const compareStore = createListStore("eha_compare", 4);
export const MAX_COMPARE = 4;

export function useShortlist() {
    const ids = useSyncExternalStore(shortlistStore.subscribe, shortlistStore.snapshot);
    return {
        ids,
        has: (id) => ids.includes(id),
        toggle: (property) => {
            if (ids.includes(property.id)) {
                shortlistStore.remove(property.id);
                toast("Removed from your shortlist");
            } else {
                shortlistStore.add(property.id);
                track("property_saved", property.id);
                toast.success("Saved to your shortlist");
            }
        },
        remove: shortlistStore.remove,
        clear: shortlistStore.clear,
    };
}

export function useCompare() {
    const ids = useSyncExternalStore(compareStore.subscribe, compareStore.snapshot);
    return {
        ids,
        has: (id) => ids.includes(id),
        toggle: (property) => {
            if (ids.includes(property.id)) {
                compareStore.remove(property.id);
                return;
            }
            const result = compareStore.add(property.id);
            if (result === "full") toast.error(`You can compare up to ${MAX_COMPARE} properties. Remove one first.`);
            else if (result === "added") {
                track("property_compared", property.id);
                toast.success("Added to compare");
            }
        },
        remove: compareStore.remove,
        clear: compareStore.clear,
    };
}
