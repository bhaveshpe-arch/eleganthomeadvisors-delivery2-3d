// Small, dependency-free helpers for media URLs, maps and measurements.

/** Only http(s) links are ever used as href/src. Blocks javascript: and data: URLs entered by mistake. */
export const safeUrl = (u) => {
    if (!u || typeof u !== "string") return "";
    try {
        const x = new URL(u.trim(), window.location.origin);
        return x.protocol === "http:" || x.protocol === "https:" ? u.trim() : "";
    } catch {
        return "";
    }
};

export const isImageUrl = (u) => /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(u || "");
export const isDirectVideo = (u) => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u || "");

export const youtubeEmbed = (url) => {
    const clean = safeUrl(url);
    if (!clean) return null;
    try {
        const u = new URL(clean);
        const host = u.hostname.replace("www.", "");
        let id = null;
        if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
        else if (host === "youtube.com" || host === "m.youtube.com") {
            if (u.pathname === "/watch") id = u.searchParams.get("v");
            else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/") || u.pathname.startsWith("/live/")) id = u.pathname.split("/")[2];
        }
        return id ? `https://www.youtube.com/embed/${id}` : null;
    } catch {
        return null;
    }
};

/** Every video configured on a property, legacy fields first, without duplicates. */
export const collectVideos = (p) => {
    const list = [];
    const add = (url, title) => {
        const clean = safeUrl(url);
        if (clean && !list.some((v) => v.url === clean)) list.push({ url: clean, title: title || "" });
    };
    add(p.video_url, "Property walkthrough");
    add(p.video_url_2, "Project overview");
    (p.videos || []).forEach((v) => add(v?.url, v?.title));
    return list;
};

/** Embeddable Google Maps URL (no API key needed). Uses only data the admin entered. */
export const mapEmbedUrl = (p) => {
    const lat = Number(p.latitude), lng = Number(p.longitude);
    if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
    const raw = p.map_embed || "";
    const at = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) || raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (at) return `https://www.google.com/maps?q=${at[1]},${at[2]}&output=embed`;
    const place = [p.name, p.address || [p.locality, p.location].filter(Boolean).join(", ")].filter(Boolean).join(", ");
    return place ? `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed` : null;
};

export const mapLink = (p) => {
    const lat = Number(p.latitude), lng = Number(p.longitude);
    if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    if (safeUrl(p.map_embed) && /google\.[a-z.]+\/maps|goo\.gl|maps\.app/.test(p.map_embed)) return p.map_embed;
    const place = [p.name, p.address || p.location].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
};

// ----- measurements -----
export const sqftToSqm = (sqft) => (sqft ? Math.round(sqft * 0.092903) : 0);
export const formatSqft = (n) => (n ? `${Math.round(n).toLocaleString("en-IN")} sq.ft` : "");

/** 19.58 ft -> 19' 7" */
export const feetInches = (ft) => {
    if (!ft) return "–";
    let feet = Math.floor(ft);
    let inches = Math.round((ft - feet) * 12);
    if (inches === 12) { feet += 1; inches = 0; }
    return `${feet}' ${inches}"`;
};
export const metres = (ft) => (ft ? `${(ft * 0.3048).toFixed(2)} m` : "–");

/** Accepts 19'7", 19' 7, 19 7, 19.6 -> decimal feet. Returns 0 when it can't be read. */
export const parseFeet = (text) => {
    const t = String(text ?? "").trim();
    if (!t) return 0;
    const ftIn = t.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|\s)\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inch|inches)?$/i);
    if (ftIn) return Number(ftIn[1]) + (Number(ftIn[2] || 0) / 12);
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
};

/** Best known carpet area (sq.ft) for a property, from the headline field or its floor plans. */
export const propertyCarpetArea = (p) => {
    if (p.carpet_area) return Number(p.carpet_area);
    const fromPlans = (p.floor_plans || []).map((f) => {
        if (f.carpet_area_sqft) return Number(f.carpet_area_sqft);
        const m = String(f.area || "").match(/[\d,]+(?:\.\d+)?/);
        return m ? Number(m[0].replace(/,/g, "")) : 0;
    }).filter(Boolean);
    return fromPlans.length ? Math.min(...fromPlans) : 0;
};

export const whatsappLink = (settings, text) =>
    settings?.whatsapp ? `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(text)}` : "";

export const propertyWhatsAppText = (p) => {
    const loc = [p.locality, p.location].filter(Boolean).join(", ") || p.location || "";
    return `Hi, I am interested in ${p.name}${loc ? ` in ${loc}` : ""}. I would like to know more about pricing and schedule a Site Visit / Home Visit.`;
};

export const PLACEHOLDER_IMG =
    "data:image/svg+xml;utf8," + encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='#EEF2F6'/><text x='50%' y='50%' fill='#94A3B8' font-family='sans-serif' font-size='28' text-anchor='middle'>Image unavailable</text></svg>`
    );
