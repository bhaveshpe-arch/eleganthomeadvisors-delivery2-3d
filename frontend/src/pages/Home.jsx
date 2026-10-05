import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Building2, MapPin, ShieldCheck, Sparkles, Handshake, ChevronRight, Star, CalendarCheck, FileCheck2, Scale } from "lucide-react";
import api from "@/lib/api";
import PropertyCard from "@/components/PropertyCard";
import LeadDialog from "@/components/LeadDialog";
import Seo, { SITE } from "@/components/Seo";
import { BUDGETS } from "@/lib/filters";
import { useSettings } from "@/context/SettingsContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const CATEGORIES = [
    { name: "Presidential Properties", desc: "Ultra-luxury sky homes & sea-view residences.", image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750" },
    { name: "Under Construction", desc: "Get in early on tomorrow's landmark projects.", image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3" },
    { name: "Ready to Move", desc: "Own it today. Move in this month.", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c" },
];

// Photos for the neighbourhoods we know about. Project counts come from the database, never from this file.
const LOCATION_IMAGES = {
    "South Mumbai": "https://images.unsplash.com/photo-1595658658481-d53d3f999875",
    "Thane": "https://images.unsplash.com/photo-1580237072617-771c3ecc4a24",
    "Navi Mumbai": "https://images.unsplash.com/photo-1568605114967-8130f3a36994",
    "Dombivli": "https://images.unsplash.com/photo-1600585152220-90363fe7e115",
    "Kalyan": "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd",
};

const WHY = [
    { icon: ShieldCheck, title: "Verified Listings", text: "Every project is RERA-checked and personally verified by our advisors before we present it." },
    { icon: Sparkles, title: "Bespoke Curation", text: "We shortlist only 3 to 5 homes per client. No spam. No confusion. Only signal." },
    { icon: Handshake, title: "End-to-end Handholding", text: "From site visits to registration, loan and handover — we walk with you every step." },
    { icon: CalendarCheck, title: "Guided Site Visits", text: "Book a slot online. An advisor meets you at the site and answers questions on the spot." },
    { icon: Scale, title: "Negotiation Support", text: "We help you compare options and negotiate with developers on your behalf." },
    { icon: FileCheck2, title: "Documentation Help", text: "Agreements, home-loan paperwork and registration — handled with you, not left to you." },
];

export default function Home() {
    const { settings } = useSettings();
    const nav = useNavigate();
    const [properties, setProperties] = useState([]);
    const [featured, setFeatured] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [faqs, setFaqs] = useState([]);
    const [search, setSearch] = useState({ q: "", location: "", category: "", budget: "", configuration: "" });
    const [overview, setOverview] = useState(null);
    const [meta, setMeta] = useState({ builders: [], configurations: [], locations: [], categories: [] });
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    const [dialog, setDialog] = useState(null);

    useEffect(() => {
        api.get("/properties?limit=8&sort=newest").then((r) => setProperties(r.data)).catch(() => {});
        api.get("/properties?featured=true&limit=6").then((r) => setFeatured(r.data)).catch(() => {}).finally(() => setLoadingFeatured(false));
        api.get("/testimonials").then((r) => setTestimonials(r.data)).catch(() => {});
        api.get("/faqs").then((r) => setFaqs(r.data)).catch(() => {});
        api.get("/meta/overview").then((r) => setOverview(r.data)).catch(() => {});
        api.get("/meta/filters").then((r) => setMeta(r.data)).catch(() => {});
    }, []);

    // Only show locations / categories / builders that actually have inventory
    const locationCards = Object.entries(overview?.locations || {}).map(([name, count]) => ({ name, count, image: LOCATION_IMAGES[name] })).sort((a, b) => b.count - a.count);
    const categoryCards = CATEGORIES.filter((c) => !overview || (overview.categories || {})[c.name] > 0);
    const builders = meta.builders || [];

    const doSearch = (e) => {
        e.preventDefault();
        const p = new URLSearchParams();
        if (search.q) p.set("q", search.q);
        if (search.location) p.set("location", search.location);
        if (search.category) p.set("category", search.category);
        if (search.budget) p.set("budget", search.budget);
        if (search.configuration) p.set("configuration", search.configuration);
        nav(`/properties?${p.toString()}`);
    };

    const agentLd = {
        "@context": "https://schema.org",
        "@type": "RealEstateAgent",
        name: "Elegant Home Advisors", url: SITE,
        ...(settings?.phone ? { telephone: settings.phone } : {}),
        ...(settings?.email ? { email: settings.email } : {}),
        ...(settings?.address ? { address: { "@type": "PostalAddress", streetAddress: settings.address, addressCountry: "IN" } } : {}),
        areaServed: Object.keys(overview?.locations || {}),
        sameAs: [settings?.facebook, settings?.instagram, settings?.linkedin, settings?.youtube].filter(Boolean),
    };

    return (
        <div>
            <Seo
                title="Elegant Home Advisors | Find the right property with the right advice"
                description="Browse verified homes, compare projects, book site visits and get personal guidance from property advisors across Mumbai, Thane, Navi Mumbai, Dombivli and Kalyan."
                path="/" jsonLd={agentLd}
            />
            {/* Hero */}
            <section className="relative min-h-[92vh] flex items-end overflow-hidden" data-testid="hero-section">
                <img
                    src={settings?.hero_image || "https://images.pexels.com/photos/7031594/pexels-photo-7031594.jpeg"}
                    alt="Luxury home"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 hero-gradient" />
                <div className="relative w-full max-w-[1400px] mx-auto px-6 lg:px-10 pb-20 pt-40">
                    <div className="max-w-3xl fade-up">
                        <div className="text-[var(--gold-light)] uppercase tracking-[0.28em] text-xs font-semibold">Boutique Real Estate Advisory</div>
                        <h1 className="font-serif-display text-white text-5xl md:text-7xl font-light leading-[1.02] mt-4">
                            Find the Right Property With the Right Advice.
                        </h1>
                        <p className="text-slate-200 text-lg mt-5 max-w-2xl leading-relaxed font-light">
                            {settings?.hero_subtitle || "Your Trusted Partner in Finding Premium Homes"} — Expert curation, end-to-end guidance, and verified luxury homes across Mumbai, Thane, Navi Mumbai, Dombivli and Kalyan.
                        </p>
                    </div>

                    <form onSubmit={doSearch} role="search" aria-label="Search properties" className="mt-10 bg-white rounded-2xl shadow-xl p-4 md:p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] gap-2 max-w-6xl" data-testid="hero-search">
                        <div className="flex items-center gap-2 px-3 py-2 xl:border-r border-slate-200">
                            <Search size={18} className="text-[var(--gold-dark)]" aria-hidden="true" />
                            <input value={search.q} onChange={(e) => setSearch({ ...search, q: e.target.value })} placeholder="Project or builder" aria-label="Search project or builder" className="flex-1 min-w-0 text-sm bg-transparent outline-none" data-testid="hero-search-input" />
                        </div>
                        <select value={search.location} onChange={(e) => setSearch({ ...search, location: e.target.value })} aria-label="Location" className="px-3 py-2 text-sm bg-transparent xl:border-r border-slate-200 outline-none" data-testid="hero-search-location">
                            <option value="">Any location</option>
                            {(meta.locations || []).map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <select value={search.category} onChange={(e) => setSearch({ ...search, category: e.target.value })} aria-label="Property type" className="px-3 py-2 text-sm bg-transparent xl:border-r border-slate-200 outline-none" data-testid="hero-search-category">
                            <option value="">Any category</option>
                            {(meta.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={search.budget} onChange={(e) => setSearch({ ...search, budget: e.target.value })} aria-label="Budget" className="px-3 py-2 text-sm bg-transparent xl:border-r border-slate-200 outline-none" data-testid="hero-search-budget">
                            <option value="">Any budget</option>
                            {BUDGETS.map((b) => <option key={b.label} value={b.label}>{b.label}</option>)}
                        </select>
                        <select value={search.configuration} onChange={(e) => setSearch({ ...search, configuration: e.target.value })} aria-label="Configuration" className="px-3 py-2 text-sm bg-transparent outline-none" data-testid="hero-search-config">
                            <option value="">Any BHK</option>
                            {(meta.configurations || []).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="submit" className="btn-primary justify-center shadow-lg hover:shadow-xl transition-all" data-testid="hero-search-btn">
                            <Search size={16} /> Search
                        </button>
                    </form>

                    {overview && overview.total_properties > 0 && (
                        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-white/90 text-sm bg-black/30 backdrop-blur-md py-3 px-6 rounded-2xl w-fit border border-white/10" data-testid="hero-stats">
                            <div className="flex items-center gap-2"><span className="font-serif-display text-2xl text-[var(--gold)] font-medium">{overview.total_properties}</span> <span className="text-slate-300">Curated Homes</span></div>
                            {overview.builders > 0 && <div className="flex items-center gap-2"><span className="font-serif-display text-2xl text-[var(--gold)] font-medium">{overview.builders}</span> <span className="text-slate-300">Verified Developers</span></div>}
                            {overview.ready_to_move > 0 && <div className="flex items-center gap-2"><span className="font-serif-display text-2xl text-[var(--gold)] font-medium">{overview.ready_to_move}</span> <span className="text-slate-300">Ready to Move</span></div>}
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono pl-2 border-l border-white/20">
                                <span>100% RERA Verified</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Featured Projects */}
            <section className="py-24 max-w-[1400px] mx-auto px-6 lg:px-10" data-testid="featured-section">
                <div className="flex items-end justify-between gap-6 mb-10">
                    <div>
                        <div className="overline">Handpicked this month</div>
                        <h2 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2">Featured Projects</h2>
                    </div>
                    <Link to="/properties" className="hidden md:inline-flex items-center gap-1 text-sm font-medium text-[var(--navy)] gold-underline">View all <ChevronRight size={16} /></Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {loadingFeatured
                        ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[28rem] rounded-2xl skeleton" />)
                        : featured.slice(0, 6).map((p) => <PropertyCard key={p.id} property={p} />)}
                </div>
                {!loadingFeatured && featured.length === 0 && (
                    <p className="text-slate-500 text-sm">Featured projects will appear here. <Link to="/properties" className="underline">Browse all properties</Link></p>
                )}
            </section>

            {/* Browse by Category — asymmetric bento */}
            <section className="py-20 bg-white border-y border-slate-100" data-testid="categories-section">
                <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
                    <div className="max-w-2xl mb-12">
                        <div className="overline">Explore by Aspiration</div>
                        <h2 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2">Browse by Category</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                        {categoryCards.map((c, i) => (
                            <Link
                                to={`/properties?category=${encodeURIComponent(c.name)}`}
                                key={c.name}
                                data-testid={`category-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                                className={`relative group overflow-hidden rounded-2xl h-72 md:h-80 ${i === 0 ? "md:col-span-3" : "md:col-span-3"} ${i === 1 ? "lg:col-span-2" : ""}`}
                            >
                                <img src={c.image} alt={c.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[var(--navy)]/85 via-[var(--navy)]/30 to-transparent" />
                                <div className="absolute inset-0 p-7 flex flex-col justify-end text-white">
                                    <Building2 size={22} className="text-[var(--gold)]" />
                                    <div className="font-serif-display text-3xl mt-3">{c.name}</div>
                                    <div className="text-sm text-slate-200 mt-1 max-w-xs">{c.desc}</div>
                                    <div className="mt-4 inline-flex items-center gap-1 text-[var(--gold-light)] text-sm">Explore <ChevronRight size={16} /></div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Browse by Location */}
            <section className="py-24 max-w-[1400px] mx-auto px-6 lg:px-10" data-testid="locations-section">
                <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
                    <div>
                        <div className="overline">Prime neighbourhoods</div>
                        <h2 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2">Browse by Location</h2>
                    </div>
                    <div className="text-sm text-slate-500 max-w-md">From Marine Drive's Queen's Necklace to the tranquil forests of Yeoor — every micro-market, curated.</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                    {locationCards.map((l) => (
                        <Link
                            to={`/properties?location=${encodeURIComponent(l.name)}`}
                            key={l.name}
                            data-testid={`location-${l.name.toLowerCase().replace(/\s+/g, "-")}`}
                            className="relative overflow-hidden rounded-2xl h-52 md:h-72 group card-elegant bg-[var(--navy)]"
                        >
                            {l.image && <img src={l.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-[var(--navy)]/85 via-transparent to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                                <MapPin size={16} className="text-[var(--gold)]" aria-hidden="true" />
                                <div className="font-serif-display text-xl mt-1">{l.name}</div>
                                <div className="text-xs text-slate-200">{l.count} {l.count === 1 ? "project" : "projects"}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Why Choose */}
            <section className="py-24 bg-[var(--navy)] text-white" data-testid="why-section">
                <div className="max-w-[1400px] mx-auto px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-1">
                        <div className="overline text-[var(--gold)]">Why Elegant</div>
                        <h2 className="font-serif-display text-4xl md:text-5xl mt-2 leading-tight">A quieter, wiser way to buy.</h2>
                        <p className="text-slate-300 mt-5 leading-relaxed">We're not a directory. We are your family's private property advisor — patient, discreet, and always in your corner.</p>
                    </div>
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {WHY.map((w) => (
                            <div key={w.title} className="p-6 rounded-2xl border border-slate-800 bg-white/[0.03] backdrop-blur-sm" data-testid={`why-${w.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                <div className="w-11 h-11 rounded-full grid place-items-center bg-[var(--gold)]/15 text-[var(--gold)]">
                                    <w.icon size={20} />
                                </div>
                                <div className="font-serif-display text-2xl mt-5">{w.title}</div>
                                <p className="text-slate-300 text-sm mt-2 leading-relaxed">{w.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Developers we currently list (from the database) */}
            {builders.length > 0 && (
                <section className="py-16 border-b border-slate-100 bg-white" data-testid="builders-section">
                    <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
                        <div className="text-center mb-10">
                            <div className="overline">Developers</div>
                            <h2 className="font-serif-display text-3xl md:text-4xl text-[var(--navy)] mt-2">Projects from these developers</h2>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                            {builders.map((b) => (
                                <Link key={b} to={`/properties?builder=${encodeURIComponent(b)}`} className="font-serif-display text-lg md:text-xl text-slate-500 hover:text-[var(--navy)] transition-colors duration-300" data-testid={`builder-${b.toLowerCase().replace(/\s+/g, "-")}`}>{b}</Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Latest Properties */}
            <section className="py-24 max-w-[1400px] mx-auto px-6 lg:px-10" data-testid="latest-section">
                <div className="flex items-end justify-between gap-6 mb-10">
                    <div>
                        <div className="overline">Freshly listed</div>
                        <h2 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2">Latest Properties</h2>
                    </div>
                    <Link to="/properties" className="hidden md:inline-flex items-center gap-1 text-sm font-medium text-[var(--navy)] gold-underline">View all <ChevronRight size={16} /></Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {properties.slice(0, 6).map((p) => <PropertyCard key={p.id} property={p} />)}
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-24 bg-white border-y border-slate-100" data-testid="testimonials-section">
                <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <div className="overline">Words from our clients</div>
                        <h2 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2">Trusted by discerning homeowners</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {testimonials.slice(0, 3).map((t) => (
                            <div key={t.id} className="card-elegant p-7" data-testid={`testimonial-${t.id}`}>
                                <div className="flex gap-1 text-[var(--gold)]">
                                    {Array.from({ length: t.rating || 0 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                                </div>
                                <p className="font-serif-display text-2xl leading-snug text-[var(--navy)] mt-4">“{t.quote}”</p>
                                <div className="mt-6 flex items-center gap-3">
                                    {t.avatar && <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover" />}
                                    <div>
                                        <div className="font-medium text-[var(--navy)]">{t.name}</div>
                                        <div className="text-xs text-slate-500">{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-24 max-w-4xl mx-auto px-6 lg:px-10" data-testid="faq-section">
                <div className="text-center mb-10">
                    <div className="overline">Answers</div>
                    <h2 className="font-serif-display text-4xl md:text-5xl text-[var(--navy)] mt-2">Frequently Asked Questions</h2>
                </div>
                <Accordion type="single" collapsible className="space-y-3">
                    {faqs.map((f) => (
                        <AccordionItem key={f.id} value={f.id} className="border border-slate-200 rounded-2xl px-5 bg-white" data-testid={`faq-${f.id}`}>
                            <AccordionTrigger className="text-left hover:no-underline py-5 font-serif-display text-xl text-[var(--navy)]">{f.question}</AccordionTrigger>
                            <AccordionContent className="text-slate-600 leading-relaxed pb-5">{f.answer}</AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </section>

            {/* Contact CTA */}
            <section className="pb-24 max-w-[1400px] mx-auto px-6 lg:px-10" data-testid="cta-section">
                <div className="rounded-3xl bg-[var(--navy)] text-white p-10 md:p-16 relative overflow-hidden">
                    <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-[var(--gold)]/20 blur-3xl" />
                    <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div>
                            <div className="overline text-[var(--gold)]">Ready to begin?</div>
                            <h2 className="font-serif-display text-4xl md:text-5xl mt-2 leading-tight">Let's find the home you've always imagined.</h2>
                            <p className="text-slate-300 mt-4 max-w-md">Share your preferences and our advisor will curate a private shortlist within 24 hours.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
                            <button
    type="button" onClick={() => setDialog("site_visit")}
    className="flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-[var(--gold)] text-[var(--navy)] font-semibold text-sm tracking-wide border border-[var(--gold)] transition-all duration-300 hover:bg-[var(--gold-dark)] hover:border-[var(--gold-dark)]"
    data-testid="cta-site-visit"
>
    <CalendarCheck size={16} /> Schedule a Site Visit
</button>

<button
    type="button" onClick={() => setDialog("callback")}
    className="flex items-center justify-center px-7 py-3 rounded-full bg-transparent text-white font-medium text-sm tracking-wide border border-[var(--gold)] transition-all duration-300 hover:bg-[var(--gold)] hover:text-[var(--navy)]"
    data-testid="cta-contact"
>
    Request a Callback
</button>

<Link
    to="/properties"
    className="flex items-center justify-center px-7 py-3 rounded-full bg-transparent text-white font-medium text-sm tracking-wide border border-[var(--gold)] transition-all duration-300 hover:bg-[var(--gold)] hover:text-[var(--navy)]"
    data-testid="cta-browse"
>
    Browse Properties
</Link>
                        </div>
                    </div>
                </div>
            </section>
            {dialog && <LeadDialog mode={dialog} open onOpenChange={(o) => !o && setDialog(null)} source="home_page" />}
        </div>
    );
}
