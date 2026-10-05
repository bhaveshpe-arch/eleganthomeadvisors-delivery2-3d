import { useEffect } from "react";

const SITE = process.env.REACT_APP_SITE_URL || "https://eleganthomeadvisors.in";

function upsertMeta(attr, name, content, created) {
    if (!content) return;
    let el = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
        created.push(el);
    } else if (!el.dataset.seoPrev) {
        el.dataset.seoPrev = el.getAttribute("content") || "";
    }
    el.setAttribute("content", content);
}

/**
 * Sets the page title, description, canonical URL, Open Graph / Twitter tags and JSON-LD.
 * Everything it adds is removed or restored when the page unmounts.
 */
export default function Seo({ title, description, image, path, type = "website", jsonLd }) {
    const ld = jsonLd ? JSON.stringify(jsonLd) : "";
    useEffect(() => {
        const created = [];
        const prevTitle = document.title;
        if (title) document.title = title;
        const url = path ? `${SITE}${path}` : window.location.href;

        upsertMeta("name", "description", description, created);
        upsertMeta("property", "og:title", title, created);
        upsertMeta("property", "og:description", description, created);
        upsertMeta("property", "og:type", type, created);
        upsertMeta("property", "og:url", url, created);
        upsertMeta("property", "og:image", image, created);
        upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary", created);
        upsertMeta("name", "twitter:title", title, created);
        upsertMeta("name", "twitter:description", description, created);
        upsertMeta("name", "twitter:image", image, created);

        let canonical = document.head.querySelector('link[rel="canonical"]');
        const canonicalCreated = !canonical;
        const prevHref = canonical?.getAttribute("href");
        if (!canonical) {
            canonical = document.createElement("link");
            canonical.setAttribute("rel", "canonical");
            document.head.appendChild(canonical);
        }
        canonical.setAttribute("href", url);

        let script;
        if (ld) {
            script = document.createElement("script");
            script.type = "application/ld+json";
            script.dataset.seo = "1";
            script.text = ld;
            document.head.appendChild(script);
        }

        return () => {
            document.title = prevTitle;
            created.forEach((el) => el.remove());
            document.head.querySelectorAll("meta[data-seo-prev]").forEach((el) => {
                el.setAttribute("content", el.dataset.seoPrev);
                delete el.dataset.seoPrev;
            });
            if (canonicalCreated) canonical.remove();
            else if (prevHref) canonical.setAttribute("href", prevHref);
            if (script) script.remove();
        };
    }, [title, description, image, path, type, ld]);
    return null;
}

export { SITE };
