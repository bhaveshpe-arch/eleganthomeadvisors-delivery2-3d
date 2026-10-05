import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Phone, Menu, X, Heart, Scale } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useShortlist, useCompare } from "@/lib/listStore";
import { isPropertyRoute } from "@/lib/contactGate";

const NAV = [
    { to: "/", label: "Home" },
    { to: "/properties", label: "Properties" },
    { to: "/emi-calculator", label: "EMI Calculator" },
    { to: "/properties?category=Presidential+Properties", label: "Presidential" },
    { to: "/properties?category=Under+Construction", label: "Under Construction" },
    { to: "/properties?category=Ready+to+Move", label: "Ready to Move" },
    { to: "/contact", label: "Contact" },
];

export default function Header() {
    const { settings } = useSettings();
    const [open, setOpen] = React.useState(false);
    const { pathname } = useLocation();
    const showPhone = !isPropertyRoute(pathname);
    const shortlist = useShortlist();
    const compare = useCompare();
    const IconLink = ({ to, icon: Icon, label, count, testId }) => (
        <Link to={to} aria-label={`${label}${count ? ` (${count})` : ""}`} title={label} data-testid={testId}
            className="relative w-10 h-10 grid place-items-center rounded-full text-[var(--navy)] hover:bg-slate-100">
            <Icon size={19} />
            {count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--gold)] text-[var(--navy)] text-[10px] font-semibold grid place-items-center">{count}</span>}
        </Link>
    );

    return (
        <header className="glass-header sticky top-0 z-40" data-testid="site-header">
            <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
                <div className="flex items-center justify-between h-20">
                    <Link to="/" className="flex items-center gap-3" data-testid="brand-logo">
                        <div className="w-10 h-10 rounded-full bg-[var(--navy)] text-[var(--gold)] grid place-items-center font-serif-display text-xl">E</div>
                        <div className="leading-tight">
                            <div className="font-serif-display text-[19px] tracking-tight text-[var(--navy)]">Elegant Home Advisors</div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold-dark)]">Premium Homes • Curated</div>
                        </div>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-8">
                        {NAV.map((n) => (
                            <NavLink
                                key={n.label}
                                to={n.to}
                                data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
                                className={({ isActive }) =>
                                    `text-[14px] font-medium tracking-wide transition-colors duration-300 ${
                                        isActive ? "text-[var(--navy)]" : "text-slate-600 hover:text-[var(--navy)]"
                                    }`
                                }
                            >
                                {n.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="hidden lg:flex items-center gap-1">
                        <IconLink to="/shortlist" icon={Heart} label="Shortlisted properties" count={shortlist.ids.length} testId="nav-shortlist" />
                        <IconLink to="/compare" icon={Scale} label="Compare properties" count={compare.ids.length} testId="nav-compare" />
                    </div>
                    <div className="hidden lg:flex items-center gap-3">
                        {showPhone && settings?.phone && (
                            <a
                                href={`tel:${settings.phone}`}
                                data-testid="header-call-btn"
                                className="btn-outline-gold text-[13px] py-2 px-5 whitespace-nowrap"
                            >
                                <Phone size={15} /> {settings.phone}
                            </a>
                        )}
                    </div>

                    <div className="lg:hidden flex items-center">
                        <IconLink to="/shortlist" icon={Heart} label="Shortlisted properties" count={shortlist.ids.length} testId="nav-shortlist-m" />
                    <button
                        onClick={() => setOpen((v) => !v)}
                        className="p-2 text-[var(--navy)]"
                        data-testid="mobile-menu-btn"
                        aria-label="Menu"
                        aria-expanded={open}
                    >
                        {open ? <X /> : <Menu />}
                    </button>
                    </div>
                </div>

                {open && (
                    <div className="lg:hidden pb-6 space-y-3" data-testid="mobile-nav">
                        {NAV.map((n) => (
                            <NavLink
                                key={n.label}
                                to={n.to}
                                onClick={() => setOpen(false)}
                                className="block py-2 text-[15px] text-slate-700 border-b border-slate-100"
                            >
                                {n.label}
                            </NavLink>
                        ))}
                        <NavLink to="/compare" onClick={() => setOpen(false)} className="block py-2 text-[15px] text-slate-700 border-b border-slate-100">Compare properties{compare.ids.length ? ` (${compare.ids.length})` : ""}</NavLink>
                        {showPhone && settings?.phone && (
                            <a href={`tel:${settings.phone}`} className="btn-primary w-full justify-center mt-4">
                                <Phone size={16} /> Call {settings.phone}
                            </a>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}
