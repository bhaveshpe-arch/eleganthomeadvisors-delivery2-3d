import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, Plus, ArrowUp, ArrowDown, Star, ExternalLink, Image as ImageIcon, Video, Rotate3d, Box, LayoutGrid } from "lucide-react";
import { safeUrl, PLACEHOLDER_IMG } from "@/lib/media";
import { Mini } from "@/components/admin/editorBits";
import UploadButton from "@/components/admin/UploadButton";
import FloorPlanFields, { blankPlan } from "@/components/admin/FloorPlanFields";

const CATEGORIES = ["Presidential Properties", "Under Construction", "Ready to Move"];
const DEFAULT_LOCATIONS = ["South Mumbai", "Thane", "Navi Mumbai", "Dombivli", "Kalyan"];
const POSSESSION = ["Ready to Move", "Under Construction", "New Launch"];
const BADGES = ["", "New Launch", "Hot Deal", "Limited Inventory", "Sold Out"];
const TYPES = ["Apartment", "Villa", "Penthouse", "Row house", "Plot", "Commercial"];

const SECTIONS = [
    ["basic", "Basic information"], ["pricing", "Pricing"], ["project", "Project details"], ["description", "Description"],
    ["amenities", "Amenities & highlights"], ["media", "Media"], ["location", "Location"], ["seo", "SEO"], ["documents", "Documents"],
];

const empty = {
    name: "", slug: "", builder: "", category: "Ready to Move", location: "South Mumbai",
    address: "", starting_price: "", price_min: 0, price_max: 0,
    configuration: "", configurations: [], possession: "", possession_status: "Ready to Move",
    short_description: "", description: "", highlights: [], amenities: [], floor_plans: [],
    images: [], cover_image: "", map_embed: "", nearby: [], badge: "", featured: false,
    seo_title: "", seo_description: "", brochure_url: "", video_url: "", video_url_2: "",
    locality: "", city: "", property_type: "", carpet_area: 0, built_up_area: 0, possession_date: "", rera_number: "",
    videos: [], tour_360_url: "", virtual_tour_url: "", model_3d_url: "", model_3d_poster: "",
    latitude: 0, longitude: 0, documents: [],
};

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const num = (v) => (v === "" || v == null ? 0 : Number(v) || 0);

// legacy video_url / video_url_2 and the new videos[] are edited as one list
const initVideos = (p) => [
    p.video_url && { url: p.video_url, title: "" }, p.video_url_2 && { url: p.video_url_2, title: "" }, ...(p.videos || []),
].filter(Boolean);

export default function PropertyEditor({ property, onClose, onSaved }) {
    const initial = useMemo(() => {
        const base = { ...empty, ...(property || {}) };
        base.floor_plans = (base.floor_plans || []).map((fp) => ({ ...blankPlan(), ...fp }));
        return { ...base, _videos: initVideos(base) };
    }, [property]);
    const [f, setF] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
    const [active, setActive] = useState("basic");
    const [bulk, setBulk] = useState("");
    const dirty = JSON.stringify(f) !== JSON.stringify(initial);

    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
    const addToList = (key, item) => set(key, [...(f[key] || []), item]);
    const removeFromList = (key, idx) => set(key, f[key].filter((_, i) => i !== idx));
    const updateInList = (key, idx, val) => set(key, f[key].map((x, i) => (i === idx ? val : x)));
    const move = (key, idx, d) => {
        const arr = [...f[key]]; const j = idx + d;
        if (j < 0 || j >= arr.length) return;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        set(key, arr);
    };

    useEffect(() => {
        api.get("/locations").then((r) => {
            const names = r.data.map((l) => l.name);
            if (names.length) setLocations([...new Set([...names, ...(property?.location ? [property.location] : [])])]);
        }).catch(() => {});
    }, [property]);

    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const goBack = () => { if (!dirty || window.confirm("You have unsaved changes. Leave without saving?")) onClose(); };
    const jump = (id) => { setActive(id); document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); };

    // ----- images -----
    const addImages = () => {
        const urls = bulk.split(/\s+/).map((u) => u.trim()).filter(Boolean);
        const bad = urls.filter((u) => !safeUrl(u));
        if (bad.length) { toast.error("Image links must start with http:// or https://"); return; }
        const merged = [...f.images, ...urls.filter((u) => !f.images.includes(u))];
        setF((s) => ({ ...s, images: merged, cover_image: s.cover_image || merged[0] || "" }));
        setBulk("");
    };
    const setPrimary = (i) => {
        const url = f.images[i];
        setF((s) => ({ ...s, cover_image: url, images: [url, ...s.images.filter((_, k) => k !== i)] }));
    };
    const removeImage = (i) => {
        const url = f.images[i];
        setF((s) => {
            const images = s.images.filter((_, k) => k !== i);
            return { ...s, images, cover_image: s.cover_image === url ? images[0] || "" : s.cover_image };
        });
    };

    const validate = () => {
        const problems = [];
        const need = (cond, msg, sec) => { if (!cond) problems.push([msg, sec]); };
        need(f.name.trim(), "Property name is required", "basic");
        need(f.builder.trim(), "Builder is required", "basic");
        need(f.starting_price.trim(), "Starting price (display text) is required", "pricing");
        const urlFields = [["Cover image", f.cover_image], ["Brochure", f.brochure_url], ["360° link", f.tour_360_url], ["Virtual tour link", f.virtual_tour_url],
            ["3D model link", f.model_3d_url], ["3D poster", f.model_3d_poster], ...f.images.map((u, i) => [`Image ${i + 1}`, u]),
            ...f._videos.map((v, i) => [`Video ${i + 1}`, v.url]),
            ...f.floor_plans.flatMap((fp, i) => [[`Floor plan ${i + 1} image`, fp.image], [`Floor plan ${i + 1} 3D image`, fp.image_3d], [`Floor plan ${i + 1} download`, fp.download_url]]),
            ...f.documents.map((d, i) => [`Document ${i + 1}`, d.value])];
        urlFields.forEach(([label, v]) => need(!v || safeUrl(v), `${label} must be a link starting with http:// or https://`, "media"));
        const model = f.model_3d_url.trim().toLowerCase().split("?")[0];
        need(!model || model.endsWith(".glb") || model.endsWith(".gltf"), "The 3D model link must point to a .glb or .gltf file", "media");
        need(!f.possession_date || /^\d{4}-\d{2}-\d{2}$/.test(f.possession_date), "Possession date must be a valid date", "project");
        return problems;
    };

    const save = async () => {
        const problems = validate();
        if (problems.length) { toast.error(problems[0][0], { id: "pe-validate", duration: 3000 }); jump(problems[0][1]); return; }
        setBusy(true);
        try {
            const { _videos, ...rest } = f;
            const vids = _videos.filter((v) => v.url.trim());
            const payload = {
                ...rest,
                slug: f.slug || slugify(f.name),
                price_min: num(f.price_min), price_max: num(f.price_max),
                carpet_area: num(f.carpet_area), built_up_area: num(f.built_up_area),
                latitude: num(f.latitude), longitude: num(f.longitude),
                cover_image: f.cover_image || f.images[0] || "",
                video_url: vids[0]?.url || "", video_url_2: vids[1]?.url || "",
                videos: vids.slice(2).map((v) => ({ url: v.url.trim(), title: v.title || "" })),
                floor_plans: f.floor_plans.map((fp) => ({
                    ...fp, carpet_area_sqft: num(fp.carpet_area_sqft), bedrooms: num(fp.bedrooms), bathrooms: num(fp.bathrooms),
                    auto_3d_threshold: num(fp.auto_3d_threshold) || 100, auto_3d_detail: num(fp.auto_3d_detail), auto_3d_height: num(fp.auto_3d_height) || 6,
                    rooms: (fp.rooms || []).filter((r) => r.name?.trim()).map((r) => ({
                        name: r.name.trim(), length_ft: num(r.length_ft), width_ft: num(r.width_ft),
                        x: r.w ? r.x : null, y: r.w ? r.y : null, w: r.w || null, h: r.w ? r.h : null,
                    })),
                })),
                images: f.images.filter(Boolean),
                documents: f.documents.filter((d) => d.value?.trim()),
            };
            if (property?.id) await api.put(`/properties/${property.id}`, payload);
            else await api.post(`/properties`, payload);
            toast.success("Saved");
            onSaved();
        } catch (e) {
            toast.error(formatApiError(e.response?.data?.detail) || "Failed to save");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div data-testid="property-editor">
            <button type="button" onClick={goBack} className="text-sm text-slate-500 hover:text-[var(--navy)] flex items-center gap-1 mb-4"><ArrowLeft size={14} /> Back to properties</button>
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div>
                    <h1 className="font-serif-display text-4xl text-[var(--navy)]">{property ? "Edit property" : "Add property"}</h1>
                    {dirty && <p className="text-xs text-amber-700 mt-1">You have unsaved changes</p>}
                </div>
                <div className="flex items-center gap-2">
                    {property?.slug && <a href={`/property/${property.slug}`} target="_blank" rel="noreferrer" className="btn-outline-gold text-sm"><ExternalLink size={14} /> View on site</a>}
                    <button type="button" onClick={save} disabled={busy} className="btn-primary" data-testid="save-property-btn"><Save size={16} /> {busy ? "Saving…" : "Save"}</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr] gap-6">
                <nav aria-label="Editor sections" className="lg:sticky lg:top-6 h-fit flex lg:flex-col gap-1 overflow-x-auto scroll-x pb-1">
                    {SECTIONS.map(([id, label]) => (
                        <button key={id} type="button" onClick={() => jump(id)} aria-current={active === id ? "true" : undefined}
                            className={`whitespace-nowrap text-left text-sm px-3 py-2 rounded-lg ${active === id ? "bg-[var(--navy)] text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>
                    ))}
                </nav>

                <div className="space-y-6 min-w-0">
                    <Card id="basic" title="Basic information">
                        <Field label="Property name"><input value={f.name} onChange={(e) => set("name", e.target.value)} className="field-input" data-testid="pe-name" /></Field>
                        <Field label="Page address (slug)" hint="Leave empty to build it from the name. Changing it changes the page URL."><input value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder={slugify(f.name)} className="field-input" /></Field>
                        <Field label="Builder / developer"><input value={f.builder} onChange={(e) => set("builder", e.target.value)} className="field-input" data-testid="pe-builder" /></Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Category"><select value={f.category} onChange={(e) => set("category", e.target.value)} className="field-input bg-white" data-testid="pe-category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                            <Field label="Property type"><input list="ptypes" value={f.property_type} onChange={(e) => set("property_type", e.target.value)} placeholder="Apartment, Villa…" className="field-input" /><datalist id="ptypes">{TYPES.map((t) => <option key={t} value={t} />)}</datalist></Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label="Area / location" hint="Used to route leads to employees"><select value={f.location} onChange={(e) => set("location", e.target.value)} className="field-input bg-white" data-testid="pe-location">{locations.map((c) => <option key={c}>{c}</option>)}</select></Field>
                            <Field label="Locality"><input value={f.locality} onChange={(e) => set("locality", e.target.value)} placeholder="e.g. Somatane" className="field-input" /></Field>
                            <Field label="City"><input value={f.city} onChange={(e) => set("city", e.target.value)} className="field-input" /></Field>
                        </div>
                        <Field label="Full address"><input value={f.address} onChange={(e) => set("address", e.target.value)} className="field-input" /></Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Badge"><select value={f.badge} onChange={(e) => set("badge", e.target.value)} className="field-input bg-white">{BADGES.map((c) => <option key={c || "none"} value={c}>{c || "None"}</option>)}</select></Field>
                            <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={!!f.featured} onChange={(e) => set("featured", e.target.checked)} data-testid="pe-featured" /><span className="text-sm">Show as featured</span></label>
                        </div>
                    </Card>

                    <Card id="pricing" title="Pricing & size">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Starting price (shown to visitors)"><input value={f.starting_price} onChange={(e) => set("starting_price", e.target.value)} placeholder="₹1.36 Cr onwards" className="field-input" /></Field>
                            <Field label="Configuration (shown to visitors)"><input value={f.configuration} onChange={(e) => set("configuration", e.target.value)} placeholder="2, 3 & 4 BHK" className="field-input" /></Field>
                            <Field label="Lowest price (₹, for filters)"><input type="number" min="0" value={f.price_min} onChange={(e) => set("price_min", e.target.value)} className="field-input" /></Field>
                            <Field label="Highest price (₹)"><input type="number" min="0" value={f.price_max} onChange={(e) => set("price_max", e.target.value)} className="field-input" /></Field>
                            <Field label="Carpet area (sq.ft)" hint="Smallest/typical unit"><input type="number" min="0" value={f.carpet_area} onChange={(e) => set("carpet_area", e.target.value)} className="field-input" /></Field>
                            <Field label="Built-up area (sq.ft)"><input type="number" min="0" value={f.built_up_area} onChange={(e) => set("built_up_area", e.target.value)} className="field-input" /></Field>
                        </div>
                        <ListEditor label="Configurations (used by filters, e.g. 3 BHK)" values={f.configurations} onAdd={() => addToList("configurations", "")} onChange={(i, v) => updateInList("configurations", i, v)} onRemove={(i) => removeFromList("configurations", i)} placeholder="3 BHK" />
                    </Card>

                    <Card id="project" title="Project details">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Possession (shown to visitors)"><input value={f.possession} onChange={(e) => set("possession", e.target.value)} placeholder="Dec 2027 or Ready to Move" className="field-input" /></Field>
                            <Field label="Possession status"><select value={f.possession_status} onChange={(e) => set("possession_status", e.target.value)} className="field-input bg-white">{POSSESSION.map((c) => <option key={c}>{c}</option>)}</select></Field>
                            <Field label="Possession date" hint="Optional. Used to compare which project is ready first."><input type="date" value={f.possession_date} onChange={(e) => set("possession_date", e.target.value)} className="field-input" /></Field>
                            <Field label="RERA registration number"><input value={f.rera_number} onChange={(e) => set("rera_number", e.target.value)} className="field-input" /></Field>
                        </div>
                    </Card>

                    <Card id="description" title="Description">
                        <Field label="Short description (cards and search results)"><input value={f.short_description} onChange={(e) => set("short_description", e.target.value)} className="field-input" /></Field>
                        <Field label="Full description"><textarea rows="6" value={f.description} onChange={(e) => set("description", e.target.value)} className="field-input resize-y" /></Field>
                    </Card>

                    <Card id="amenities" title="Amenities & highlights">
                        <ListEditor label="Highlights" values={f.highlights} onAdd={() => addToList("highlights", "")} onChange={(i, v) => updateInList("highlights", i, v)} onRemove={(i) => removeFromList("highlights", i)} />
                        <ListEditor label="Amenities" values={f.amenities} onAdd={() => addToList("amenities", "")} onChange={(i, v) => updateInList("amenities", i, v)} onRemove={(i) => removeFromList("amenities", i)} />
                    </Card>

                    <Card id="media" title="Media">
                        <p className="text-xs text-slate-500 -mt-2">Photos and floor plans can be uploaded from your computer (JPG, PNG or WebP, up to 8 MB each). Videos, 360° images, 3D models and brochures are still added as links.</p>

                        <MediaBlock icon={ImageIcon} title="Photos" hint="The first photo is the primary photo shown on cards and as the main gallery image.">
                            {f.images.length === 0 && <p className="text-xs text-slate-400">No photos yet.</p>}
                            <ul className="space-y-2">
                                {f.images.map((url, i) => (
                                    <li key={url + i} className="flex items-center gap-3 bg-slate-50 rounded-xl p-2">
                                        <img src={url} alt="" className="w-20 h-14 object-cover rounded-lg bg-slate-200" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                                        <div className="flex-1 min-w-0">
                                            <input value={url} onChange={(e) => updateInList("images", i, e.target.value)} aria-label={`Photo ${i + 1} link`} className="field-input !py-1.5 text-xs" />
                                            {f.cover_image === url && <span className="inline-flex items-center gap-1 text-[10px] text-[var(--gold-dark)] mt-1"><Star size={10} /> Primary photo</span>}
                                        </div>
                                        <Mini label="Make primary" onClick={() => setPrimary(i)} disabled={i === 0 && f.cover_image === url}><Star size={14} /></Mini>
                                        <Mini label="Move up" onClick={() => move("images", i, -1)} disabled={i === 0}><ArrowUp size={14} /></Mini>
                                        <Mini label="Move down" onClick={() => move("images", i, 1)} disabled={i === f.images.length - 1}><ArrowDown size={14} /></Mini>
                                        <Mini label="Delete photo" danger onClick={() => removeImage(i)}><Trash2 size={14} /></Mini>
                                    </li>
                                ))}
                            </ul>
                            <textarea rows="2" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Paste one or more image links (one per line)" aria-label="Add photo links" className="field-input mt-3" />
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <button type="button" onClick={addImages} disabled={!bulk.trim()} className="btn-outline-gold text-sm disabled:opacity-50"><Plus size={14} /> Add photos</button>
                                <UploadButton multiple label="Upload photos from computer" testId="upload-photos"
                                    onDone={(urls) => setF((s) => { const merged = [...s.images, ...urls.filter((u) => !s.images.includes(u))]; return { ...s, images: merged, cover_image: s.cover_image || merged[0] || "" }; })} />
                            </div>
                        </MediaBlock>

                        <MediaBlock icon={Video} title="Videos" hint="YouTube links or direct .mp4 / .webm links.">
                            <ul className="space-y-2">
                                {f._videos.map((v, i) => (
                                    <li key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                                        <input value={v.url} onChange={(e) => set("_videos", f._videos.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} placeholder="https://www.youtube.com/watch?v=…" aria-label={`Video ${i + 1} link`} className="field-input !py-1.5 text-xs" />
                                        <input value={v.title || ""} onChange={(e) => set("_videos", f._videos.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} placeholder="Title (optional)" aria-label={`Video ${i + 1} title`} className="field-input !py-1.5 text-xs max-w-[11rem]" />
                                        <Mini label="Move up" onClick={() => { const a = [...f._videos]; if (i > 0) { [a[i], a[i - 1]] = [a[i - 1], a[i]]; set("_videos", a); } }} disabled={i === 0}><ArrowUp size={14} /></Mini>
                                        <Mini label="Move down" onClick={() => { const a = [...f._videos]; if (i < a.length - 1) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; set("_videos", a); } }} disabled={i === f._videos.length - 1}><ArrowDown size={14} /></Mini>
                                        <Mini label="Delete video" danger onClick={() => set("_videos", f._videos.filter((_, k) => k !== i))}><Trash2 size={14} /></Mini>
                                    </li>
                                ))}
                            </ul>
                            <button type="button" onClick={() => set("_videos", [...f._videos, { url: "", title: "" }])} className="btn-outline-gold text-sm mt-2"><Plus size={14} /> Add video</button>
                        </MediaBlock>

                        <MediaBlock icon={Rotate3d} title="360° tour" hint="Shown only when filled in.">
                            <Field label="360° panorama image" hint="A real equirectangular panorama (2:1 width to height) in .jpg/.png/.webp. It must be served with cross-origin (CORS) access enabled. A normal flat photo will look wrong.">
                                <input value={f.tour_360_url} onChange={(e) => set("tour_360_url", e.target.value)} placeholder="https://…/living-room-360.jpg" className="field-input" />
                            </Field>
                            <Field label="Virtual tour page link" hint="Matterport, Kuula or similar. Opens inside the page.">
                                <input value={f.virtual_tour_url} onChange={(e) => set("virtual_tour_url", e.target.value)} placeholder="https://my.matterport.com/show/?m=…" className="field-input" />
                            </Field>
                        </MediaBlock>

                        <MediaBlock icon={Box} title="3D model" hint="Shown only when filled in. Must be a real 3D model file (.glb or .gltf), not a photo.">
                            <Field label="3D model link (.glb / .gltf)"><input value={f.model_3d_url} onChange={(e) => set("model_3d_url", e.target.value)} placeholder="https://…/building.glb" className="field-input" /></Field>
                            <Field label="Preview image (optional)"><input value={f.model_3d_poster} onChange={(e) => set("model_3d_poster", e.target.value)} className="field-input" /></Field>
                        </MediaBlock>

                        <MediaBlock icon={LayoutGrid} title="Floor plans" hint="Add each layout with its size and, if you have them, room dimensions.">
                            <div className="space-y-4">
                                {f.floor_plans.map((fp, i) => (
                                    <FloorPlanFields key={i} fp={fp} index={i} total={f.floor_plans.length}
                                        onChange={(v) => updateInList("floor_plans", i, v)} onMove={(d) => move("floor_plans", i, d)} onRemove={() => removeFromList("floor_plans", i)} />
                                ))}
                            </div>
                            <button type="button" onClick={() => addToList("floor_plans", blankPlan())} className="btn-outline-gold text-sm mt-3"><Plus size={14} /> Add floor plan</button>
                        </MediaBlock>
                    </Card>

                    <Card id="location" title="Location">
                        <Field label="Google Maps link" hint="Paste the link from Google Maps (Share → Copy link)."><input type="url" value={f.map_embed} onChange={(e) => set("map_embed", e.target.value)} placeholder="https://www.google.com/maps/place/..." className="field-input" /></Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Latitude (optional)" hint="Makes the map pin exact"><input type="number" step="any" value={f.latitude || ""} onChange={(e) => set("latitude", e.target.value)} className="field-input" /></Field>
                            <Field label="Longitude (optional)"><input type="number" step="any" value={f.longitude || ""} onChange={(e) => set("longitude", e.target.value)} className="field-input" /></Field>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs uppercase tracking-widest text-slate-500">Nearby places</div>
                                <button type="button" onClick={() => addToList("nearby", { label: "", value: "" })} className="text-xs text-[var(--navy)] flex items-center gap-1"><Plus size={12} /> Add</button>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-2">Enter only distances you have checked, for example "Somatane Station — 0 km".</p>
                            <div className="space-y-2">
                                {f.nearby.map((n, i) => (
                                    <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-center bg-slate-50 p-3 rounded-xl">
                                        <input value={n.label} onChange={(e) => updateInList("nearby", i, { ...n, label: e.target.value })} placeholder="Nearest metro / school / hospital" aria-label="Place type" className="field-input" />
                                        <input value={n.value} onChange={(e) => updateInList("nearby", i, { ...n, value: e.target.value })} placeholder="Andheri Metro — 800 m" aria-label="Place and distance" className="field-input" />
                                        <Mini label="Delete place" danger onClick={() => removeFromList("nearby", i)}><Trash2 size={14} /></Mini>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <Card id="seo" title="SEO">
                        <Field label="Page title" hint="Leave empty to use the property name, builder and area."><input value={f.seo_title} onChange={(e) => set("seo_title", e.target.value)} className="field-input" /></Field>
                        <Field label="Search description (about 150 characters)"><textarea rows="3" value={f.seo_description} onChange={(e) => set("seo_description", e.target.value)} className="field-input resize-none" /></Field>
                    </Card>

                    <Card id="documents" title="Documents">
                        <Field label="Brochure PDF link"><input value={f.brochure_url} onChange={(e) => set("brochure_url", e.target.value)} className="field-input" /></Field>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs uppercase tracking-widest text-slate-500">Other documents</div>
                                <button type="button" onClick={() => addToList("documents", { label: "", value: "" })} className="text-xs text-[var(--navy)] flex items-center gap-1"><Plus size={12} /> Add</button>
                            </div>
                            <div className="space-y-2">
                                {f.documents.map((d, i) => (
                                    <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-center bg-slate-50 p-3 rounded-xl">
                                        <input value={d.label} onChange={(e) => updateInList("documents", i, { ...d, label: e.target.value })} placeholder="Price sheet" aria-label="Document name" className="field-input" />
                                        <input value={d.value} onChange={(e) => updateInList("documents", i, { ...d, value: e.target.value })} placeholder="https://…" aria-label="Document link" className="field-input" />
                                        <Mini label="Delete document" danger onClick={() => removeFromList("documents", i)}><Trash2 size={14} /></Mini>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

const Card = ({ id, title, children }) => (
    <section id={`sec-${id}`} className="bg-white border border-slate-200 rounded-2xl p-6 scroll-mt-6" aria-labelledby={`h-${id}`}>
        <h2 id={`h-${id}`} className="font-serif-display text-xl text-[var(--navy)] mb-4">{title}</h2>
        <div className="space-y-4">{children}</div>
    </section>
);

const Field = ({ label, hint, children }) => (
    <label className="block">
        <span className="text-xs text-slate-600">{label}</span>
        <div className="mt-1">{children}</div>
        {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
);

const MediaBlock = ({ icon: Icon, title, hint, children }) => (
    <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 font-medium text-[var(--navy)]"><Icon size={16} className="text-[var(--gold-dark)]" aria-hidden="true" /> {title}</div>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5 mb-3">{hint}</p>}
        {children}
    </div>
);

const ListEditor = ({ label, values = [], onAdd, onChange, onRemove, placeholder }) => (
    <div>
        <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
            <button type="button" onClick={onAdd} className="text-xs text-[var(--navy)] flex items-center gap-1"><Plus size={12} /> Add</button>
        </div>
        <div className="space-y-2">
            {values.map((v, i) => (
                <div key={i} className="flex gap-2">
                    <input value={v} onChange={(e) => onChange(i, e.target.value)} placeholder={placeholder} aria-label={`${label} ${i + 1}`} className="field-input" />
                    <Mini label={`Delete ${label} ${i + 1}`} danger onClick={() => onRemove(i)}><Trash2 size={14} /></Mini>
                </div>
            ))}
            {values.length === 0 && <div className="text-xs text-slate-400">No items yet. Click Add.</div>}
        </div>
    </div>
);
