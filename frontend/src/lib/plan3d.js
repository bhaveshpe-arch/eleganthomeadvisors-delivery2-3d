// Turns a 2D floor-plan drawing into a list of wall rectangles. Pure functions, no browser APIs except
// loadPlanImage / readPlanPixels, so the tracing logic can be unit-tested.

/** Loads an image for pixel reading. Cross-origin images must be served with CORS headers. */
export function loadPlanImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("image-blocked"));
        img.src = src;
    });
}

/** Draws the image at a working size and returns its brightness (0 dark - 255 light) per pixel. */
export function readPlanPixels(img, targetWidth = 420) {
    const scale = targetWidth / img.naturalWidth;
    const w = targetWidth;
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;      // throws if the canvas is tainted (no CORS)
    const lum = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
    return { lum, w, h };
}

// ---- morphology on a binary mask (1 = ink) ----
// Square-window erosion (a pixel stays ink only if the whole window is ink) or dilation (any ink in the window).
// Outside the picture counts as ink for erosion, so walls touching the edge are not eaten away.
function morph(mask, w, h, r, erode) {
    const outside = erode ? 1 : 0;
    const pass = (src, horizontal) => {
        const dst = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let hit = false;
                for (let k = -r; k <= r; k++) {
                    const xx = horizontal ? x + k : x;
                    const yy = horizontal ? y : y + k;
                    const v = xx < 0 || xx >= w || yy < 0 || yy >= h ? outside : src[yy * w + xx];
                    if (erode ? v === 0 : v === 1) { hit = true; break; }
                }
                dst[y * w + x] = erode ? (hit ? 0 : 1) : (hit ? 1 : 0);
            }
        }
        return dst;
    };
    return pass(pass(mask, true), false);
}

/** Keeps only thick dark strokes (walls). detail 0 keeps everything dark, 3 drops all but very thick walls. */
export function wallMask(lum, w, h, threshold = 100, detail = 1) {
    let mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = lum[i] < threshold ? 1 : 0;
    if (detail > 0) {
        mask = morph(mask, w, h, detail, true);           // erode: thin lines and text disappear
        mask = morph(mask, w, h, detail, false);          // dilate: thick walls grow back to size
    }
    return mask;
}

/** Merges the mask into as few rectangles as possible (row runs, then identical runs stacked vertically). */
export function maskToRects(mask, w, h) {
    const rects = [];
    let active = new Map();
    for (let y = 0; y < h; y++) {
        const next = new Map();
        let x = 0;
        while (x < w) {
            if (!mask[y * w + x]) { x++; continue; }
            const x0 = x;
            while (x < w && mask[y * w + x]) x++;
            const key = `${x0}:${x}`;
            const prev = active.get(key);
            if (prev) { prev.y1 = y + 1; next.set(key, prev); }
            else { const r = { x0, x1: x, y0: y, y1: y + 1 }; rects.push(r); next.set(key, r); }
        }
        active = next;
    }
    return rects;
}

export function traceWalls(img, { threshold = 100, detail = 1 } = {}) {
    const { lum, w, h } = readPlanPixels(img);
    const mask = wallMask(lum, w, h, threshold, detail);
    const rects = maskToRects(mask, w, h);
    return { rects, w, h };
}
