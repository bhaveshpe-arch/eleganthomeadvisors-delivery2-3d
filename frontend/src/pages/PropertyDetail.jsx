import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
    MapPin, MessageCircle, Share2, Download, Sparkles, CheckCircle2, Calendar, TrendingUp, School, Hospital,
    ShoppingBag, Train, CalendarCheck, PhoneCall, MessageSquare, ExternalLink, ShieldCheck, FileText, Loader2,
} from "lucide-react";
import api, { API } from "@/lib/api";
import InquiryForm from "@/components/InquiryForm";
import EMICalculator from "@/components/EMICalculator";
import Gallery from "@/components/Gallery";
import FloorPlans from "@/components/FloorPlans";
import SimilarProperties from "@/components/SimilarProperties";
import LeadDialog from "@/components/LeadDialog";
import Seo, { SITE } from "@/components/Seo";
import VideoPlayer from "@/components/media/VideoPlayer";
import { SaveButton, CompareButton } from "@/components/PropertyActions";
import { trackViewOnce } from "@/lib/track";
import {
    collectVideos, formatSqft, isImageUrl, mapEmbedUrl, mapLink, propertyCarpetArea,
    safeUrl, sqftToSqm,
} from "@/lib/media";
import { toast } from "sonner";

// Heavy viewers are only downloaded when a property actually has that media.
const PanoramaViewer = lazy(() => import("@/components/media/PanoramaViewer"));
const ModelViewer = lazy(() => import("@/components/media/ModelViewer"));

const nearbyIcon = (label) => {
    const l = (label || "").toLowerCase();
    if (l.includes("metro") || l.includes("railway") || l.includes("station")) return <Train size={18} />;
    if (l.includes("school")) return <School size={18} />;
    if (l.includes("hospital")) return <Hospital size={18} />;
    if (l.includes("mall") || l.includes("shopping")) return <ShoppingBag size={18} />;
    return <MapPin size={18} />;
};

const badgeColors = {
    "New Launch": "bg-emerald-500 text-white",
    "Hot Deal": "bg-red-500 text-white",
    "Limited Inventory": "bg-amber-500 text-white",
    "Sold Out": "bg-slate-500 text-white",
};

const ViewerFallback = () => (
    <div className="h-[320px] md:h-[480px] rounded-2xl skeleton grid place-items-center text-slate-500 text-sm" role="status">
        <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Loading…</span>
    </div>
);

const Section = ({ id, overline, title, children, testId }) => (
    <section id={id} className="mt-12 scroll-mt-28" data-testid={testId} aria-labelledby={`${id}-h`}>
        <div className="overline">{overline}</div>
        <h2 id={`${id}-h`} className="font-serif-display text-3xl text-[var(--navy)] mt-2">{title}</h2>
        {children}
    </section>
);

function Fact({ label, value, sub }) {
    if (!value) return null;
    return (
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <dt className="text-[10px] uppercase tracking-widest text-slate-500">{label}</dt>
            <dd className="text-[var(--navy)] font-medium mt-1 text-sm">{value}</dd>
            {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
        </div>
    );
}

export default function PropertyDetail() {
    const { slug } = useParams();
    const [property, setProperty] = useState(null);
    const [status, setStatus] = useState("loading");   // loading | ready | missing | error
    const [dialog, setDialog] = useState(null);         // site_visit | callback | brochure | enquiry
    const [layoutMsg, setLayoutMsg] = useState("");

    const load = useCallback(() => {
        setStatus("loading");
        api.get(`/properties/slug/${slug}`)
            .then((r) => { setProperty(r.data); setStatus("ready"); })
            .catch((e) => { setProperty(null); setStatus(e.response?.status === 404 ? "missing" : "error"); });
    }, [slug]);

    useEffect(() => { load(); window.scrollTo(0, 0); }, [load]);
    useEffect(() => { if (property?.id) trackViewOnce(property.id); }, [property?.id]);

    const videos = useMemo(() => (property ? collectVideos(property) : []), [property]);

    if (status === "loading") {
        return (
            <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16" aria-busy="true">
                <div className="h-[420px] rounded-2xl skeleton" />
                <div className="h-10 w-2/3 rounded skeleton mt-8" />
                <div className="h-5 w-1/3 rounded skeleton mt-4" />
            </div>
        );
    }
    if (status !== "ready") {
        return (
            <div className="max-w-xl mx-auto px-6 py-28 text-center" role="alert">
                <div className="font-serif-display text-4xl text-[var(--navy)]">{status === "missing" ? "We couldn't find this property" : "We couldn't load this property right now"}</div>
                <p className="text-slate-600 mt-3">{status === "missing" ? "It may have been removed or the link may be old." : "Please check your connection and try again."}</p>
                <div className="mt-8 flex gap-3 justify-center">
                    {status === "error" && <button className="btn-primary" onClick={load}>Try again</button>}
                    <Link to="/properties" className="btn-outline-gold">Browse all properties</Link>
                </div>
            </div>
        );
    }

    const p = property;
    const place = [p.locality, p.location, p.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
    const area = propertyCarpetArea(p);
    const gallery = [p.cover_image, ...(p.images || [])].filter((u, i, a) => u && a.indexOf(u) === i);
    const mapSrc = (p.map_embed || p.latitude || p.address) ? mapEmbedUrl(p) : null;
    const pano = safeUrl(p.tour_360_url);
    const panoIsImage = pano && isImageUrl(pano);
    const tourPage = safeUrl(p.virtual_tour_url) || (pano && !panoIsImage ? pano : "");
    const model = safeUrl(p.model_3d_url);
    const brochure = safeUrl(p.brochure_url);
    const docs = (p.documents || []).filter((d) => safeUrl(d.value));
    const url = `${SITE}/property/${p.slug}`;
    const price = Number(p.price_min) || 0;

    const shareUrl = `${API}/share/${p.slug}`;   // gives WhatsApp/Facebook a rich preview, then opens the property page
    const share = () => {
        const data = { title: p.name, text: `Check out ${p.name} by ${p.builder} on Elegant Home Advisors`, url: shareUrl };
        if (navigator.share) navigator.share(data).catch(() => {});
        else { navigator.clipboard?.writeText(shareUrl); toast.success("Link copied to clipboard"); }
    };
    const waShare = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${p.name} by ${p.builder} — ${shareUrl}`)}`;
    const openDialog = (kind, msg = "") => { setLayoutMsg(msg); setDialog(kind); };
    const openBrochure = () => (brochure ? setDialog("brochure") : toast.info("The brochure for this property isn't available yet. Our advisor can share it with you."));

    const sections = [
        videos.length > 0 && ["videos", "Videos"],
        (panoIsImage || tourPage) && ["tour-360", "360° tour"],
        model && ["model-3d", "3D model"],
        p.floor_plans?.length > 0 && ["floorplans", "Floor plans"],
        mapSrc && ["location", "Location"],
    ].filter(Boolean);

    // ----- structured data (only real fields; no ratings or reviews) -----
    const images = gallery.slice(0, 6);
    const description = p.seo_description || p.short_description || p.description?.slice(0, 155) || `${p.name} by ${p.builder} in ${p.location}.`;
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "RealEstateListing", "@id": `${url}#listing`, url, name: p.name, description,
                image: images, datePosted: p.created_at, dateModified: p.updated_at, inLanguage: "en-IN",
                breadcrumb: { "@id": `${url}#breadcrumb` }, about: { "@id": `${url}#product` },
            },
            {
                "@type": "Product", "@id": `${url}#product`, name: p.name, description, image: images,
                brand: { "@type": "Brand", name: p.builder },
                ...(price > 0 ? { offers: { "@type": "Offer", url, priceCurrency: "INR", price, availability: p.badge === "Sold Out" ? "https://schema.org/SoldOut" : "https://schema.org/InStock" } } : {}),
            },
            {
                "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`,
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
                    { "@type": "ListItem", position: 2, name: "Properties", item: `${SITE}/properties` },
                    { "@type": "ListItem", position: 3, name: p.name, item: url },
                ],
            },
        ],
    };

    return (
        <div data-testid="property-detail-page" className="pb-24 lg:pb-0">
            <Seo
                title={p.seo_title || `${p.name} by ${p.builder} | ${[p.locality, p.location].filter(Boolean).join(", ")} | Elegant Home Advisors`}
                description={description} image={gallery[0]} path={`/property/${p.slug}`} type="website" jsonLd={jsonLd}
            />

            <section className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-8">
                <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-4">
                    <Link to="/" className="hover:text-[var(--navy)]">Home</Link> / <Link to="/properties" className="hover:text-[var(--navy)]">Properties</Link> / <span className="text-[var(--navy)]" aria-current="page">{p.name}</span>
                </nav>
                <Gallery
                    images={gallery} name={p.name}
                    badge={p.badge ? <span className={`text-[10px] uppercase tracking-widest font-medium px-3 py-1.5 rounded-full ${badgeColors[p.badge] || "bg-slate-700 text-white"}`}>{p.badge}</span> : null}
                />
                {sections.length > 0 && (
                    <nav aria-label="Jump to media" className="mt-4 flex gap-2 overflow-x-auto scroll-x">
                        {sections.map(([id, label]) => (
                            <a key={id} href={`#${id}`} className="whitespace-nowrap text-xs px-4 py-2 rounded-full border border-slate-300 text-slate-700 bg-white hover:border-[var(--gold)]">{label}</a>
                        ))}
                    </nav>
                )}
            </section>

            <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2">
                        <div className="text-[11px] uppercase tracking-widest text-[var(--gold-dark)] font-medium">{p.builder} · {p.category}</div>
                        <h1 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2 leading-tight">{p.name}</h1>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-1.5"><MapPin size={14} className="text-[var(--gold)]" aria-hidden="true" />{p.address || place}</div>
                            {p.possession && <div className="flex items-center gap-1.5"><Calendar size={14} className="text-[var(--gold)]" aria-hidden="true" />{p.possession}</div>}
                            {p.rera_number && <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-[var(--gold)]" aria-hidden="true" />RERA {p.rera_number}</div>}
                        </div>

                        {/* Conversion actions: one clear primary, the rest grouped */}
                        <div className="mt-6 flex flex-wrap gap-3">
                            <button type="button" onClick={() => openDialog("site_visit")} className="btn-gold" data-testid="detail-site-visit"><CalendarCheck size={16} /> Schedule Site Visit</button>
                            <button type="button" onClick={() => openDialog("enquiry")} className="btn-primary" data-testid="detail-enquire"><MessageSquare size={16} /> Enquire Now</button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => openDialog("callback")} className="btn-outline-gold text-sm" data-testid="detail-callback"><PhoneCall size={15} /> Request Callback</button>
                            <button type="button" onClick={openBrochure} className="btn-outline-gold text-sm" data-testid="detail-brochure"><Download size={15} /> Brochure</button>
                            <SaveButton property={p} variant="full" className="text-sm" />
                            <CompareButton property={p} variant="full" className="text-sm" />
                            <button type="button" onClick={share} className="btn-outline-gold text-sm" data-testid="detail-share"><Share2 size={15} /> Share</button>
                            <a href={waShare} target="_blank" rel="noreferrer" className="btn-outline-gold text-sm" data-testid="detail-wa-share"><MessageCircle size={15} /> Share on WhatsApp</a>
                        </div>

                        {/* Overview: only fields that have data are shown */}
                        <Section id="overview" overline="At a glance" title="Property Overview" testId="overview-section">
                            <dl className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                                <Fact label="Starting price" value={p.starting_price} />
                                <Fact label="Configuration" value={p.configuration} />
                                <Fact label="Carpet area" value={area ? formatSqft(area) : ""} sub={area ? `${sqftToSqm(area)} sq.m` : ""} />
                                <Fact label="Built-up area" value={p.built_up_area ? formatSqft(p.built_up_area) : ""} />
                                <Fact label="Possession" value={p.possession} sub={p.possession_date ? new Date(p.possession_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : ""} />
                                <Fact label="Status" value={p.possession_status} />
                                <Fact label="Property type" value={p.property_type} />
                                <Fact label="RERA" value={p.rera_number} />
                                <Fact label="Developer" value={p.builder} />
                                <Fact label="Location" value={place} />
                            </dl>
                            {p.description && <p className="text-slate-600 leading-relaxed mt-6 whitespace-pre-line">{p.description}</p>}
                        </Section>

                        {p.highlights?.length > 0 && (
                            <Section id="highlights" overline="What makes it special" title="Project Highlights">
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                                    {p.highlights.map((h) => (
                                        <li key={h} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                                            <Sparkles size={18} className="text-[var(--gold)] shrink-0 mt-0.5" aria-hidden="true" />
                                            <span className="text-slate-700 text-sm">{h}</span>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {p.amenities?.length > 0 && (
                            <Section id="amenities" overline="Curated for you" title="Amenities" testId="amenities-section">
                                <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-6">
                                    {p.amenities.map((a) => (
                                        <li key={a} className="flex items-center gap-2 py-2.5 px-4 bg-white rounded-xl border border-slate-200 text-sm text-slate-700">
                                            <CheckCircle2 size={16} className="text-[var(--gold)]" aria-hidden="true" /> {a}
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {videos.length > 0 && (
                            <Section id="videos" overline="Walkthrough" title="Property Videos" testId="property-video-section">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    {videos.map((v, i) => <VideoPlayer key={v.url} url={v.url} title={v.title || `${p.name} video ${i + 1}`} />)}
                                </div>
                            </Section>
                        )}

                        {(panoIsImage || tourPage) && (
                            <Section id="tour-360" overline="Immersive" title="Explore Property in 360°" testId="tour-section">
                                <div className="mt-6 space-y-6">
                                    {panoIsImage && (
                                        <Suspense fallback={<ViewerFallback />}><PanoramaViewer src={pano} title={p.name} /></Suspense>
                                    )}
                                    {tourPage && (
                                        <div>
                                            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 h-[320px] md:h-[480px]">
                                                <iframe src={tourPage} title={`${p.name} virtual tour`} className="w-full h-full" loading="lazy" allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope" allowFullScreen />
                                            </div>
                                            <a href={tourPage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-500 mt-2 underline">Open the tour in a new tab <ExternalLink size={12} /></a>
                                        </div>
                                    )}
                                </div>
                            </Section>
                        )}

                        {model && (
                            <Section id="model-3d" overline="Interactive" title="Explore in 3D" testId="model-section">
                                <div className="mt-6">
                                    <Suspense fallback={<ViewerFallback />}><ModelViewer src={model} poster={safeUrl(p.model_3d_poster)} title={p.name} /></Suspense>
                                </div>
                            </Section>
                        )}

                        {p.floor_plans?.length > 0 && (
                            <Section id="floorplans" overline="Layouts" title="Floor Plans & Pricing" testId="floorplans-section">
                                <FloorPlans
                                    property={p}
                                    onAction={(kind, plan) => openDialog(kind, `Hi, I am interested in the ${plan.config}${plan.area ? ` (${plan.area})` : ""} layout at ${p.name}. Please share availability and pricing.`)}
                                />
                            </Section>
                        )}

                        {price > 0 && (
                            <Section id="emi" overline="Plan your finance" title="EMI Calculator" testId="detail-emi-section">
                                <div className="text-right -mt-8">
                                    <Link to="/emi-calculator" className="text-sm text-[var(--navy)] gold-underline" data-testid="detail-emi-fullpage">Open full calculator →</Link>
                                </div>
                                <div className="mt-6 p-6 md:p-8 rounded-2xl border border-slate-200 bg-white">
                                    <EMICalculator defaultPrice={price} compact />
                                </div>
                            </Section>
                        )}

                        {mapSrc && (
                            <Section id="location" overline="Location" title="On the Map" testId="map-section">
                                <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200 h-96">
                                    <iframe src={mapSrc} className="w-full h-full" title={`${p.name} location`} loading="lazy" allowFullScreen />
                                </div>
                                <a href={mapLink(p)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--navy)] mt-3 gold-underline">Open in Google Maps <ExternalLink size={13} /></a>
                            </Section>
                        )}

                        {p.nearby?.length > 0 && (
                            <Section id="nearby" overline="Neighbourhood" title="What's Around" testId="nearby-section">
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                                    {p.nearby.map((n, i) => (
                                        <li key={i} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                                            <div className="w-9 h-9 rounded-full bg-[var(--gold)]/15 text-[var(--gold-dark)] grid place-items-center" aria-hidden="true">{nearbyIcon(n.label)}</div>
                                            <div>
                                                <div className="text-xs uppercase tracking-widest text-slate-500">{n.label}</div>
                                                <div className="text-slate-800 text-sm mt-0.5">{n.value}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {docs.length > 0 && (
                            <Section id="documents" overline="Downloads" title="Documents">
                                <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {docs.map((d, i) => (
                                        <li key={i}>
                                            <a href={d.value} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-[var(--gold)]">
                                                <FileText size={18} className="text-[var(--gold)]" aria-hidden="true" /> <span className="text-sm text-slate-800">{d.label || "Document"}</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        <div className="mt-12 p-6 rounded-2xl bg-[var(--navy)] text-white flex items-center gap-5 flex-wrap">
                            <div className="w-14 h-14 rounded-full bg-white/10 grid place-items-center"><TrendingUp size={24} className="text-[var(--gold)]" aria-hidden="true" /></div>
                            <div className="flex-1 min-w-[200px]">
                                <div className="text-xs uppercase tracking-widest text-[var(--gold)]">Developer</div>
                                <div className="font-serif-display text-2xl mt-1">{p.builder}</div>
                            </div>
                            <Link to={`/properties?builder=${encodeURIComponent(p.builder)}`} className="btn-outline-gold text-sm !text-white !border-white/40">More from this developer</Link>
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="sticky top-28">
                            <InquiryForm property={p} defaultType={p.category} />
                        </div>
                    </div>
                </div>

                <SimilarProperties propertyId={p.id} />
            </section>

            {/* Mobile sticky call-to-action bar */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 shadow-2xl flex items-center gap-2" data-testid="mobile-cta">
                <button type="button" onClick={() => openDialog("callback")} className="p-2.5 rounded-full border border-slate-300 text-[var(--navy)] bg-slate-50 hover:bg-slate-100" title="Request Callback" aria-label="Request Callback">
                    <PhoneCall size={16} />
                </button>
                <button type="button" onClick={() => openDialog("enquiry")} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-full bg-[var(--navy)] text-white font-medium shadow-sm">
                    <MessageSquare size={14} /> Enquire
                </button>
                <button type="button" onClick={() => openDialog("site_visit")} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-full bg-[var(--gold)] text-[var(--navy)] font-semibold shadow-sm">
                    <CalendarCheck size={14} /> Schedule Visit
                </button>
            </div>

            {dialog && (
                <LeadDialog
                    mode={dialog} open onOpenChange={(o) => !o && setDialog(null)} property={p} source="property_page"
                    defaultMessage={layoutMsg}
                />
            )}
        </div>
    );
}
