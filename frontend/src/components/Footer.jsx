import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { isPropertyRoute } from "@/lib/contactGate";

export default function Footer() {
    const { settings } = useSettings();
    const hideContact = isPropertyRoute(useLocation().pathname);
    if (!settings) return null;

    return (
        <footer className="mt-24 bg-[var(--navy)] text-slate-200" data-testid="site-footer">
            <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-4 gap-10 [&>*]:min-w-0">
                <div className="md:col-span-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--gold)] text-[var(--navy)] grid place-items-center font-serif-display text-xl">E</div>
                        <div>
                            <div className="font-serif-display text-2xl text-white">Elegant Home Advisors</div>
                            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)]">Your Trusted Partner in Finding Premium Homes</div>
                        </div>
                    </div>
                    <p className="mt-6 text-slate-300 max-w-md leading-relaxed">
                        A boutique real estate advisory specialising in premium residences across Mumbai, Thane, Navi Mumbai and its extended suburbs.
                    </p>
                    <div className="flex gap-3 mt-6">
                        {settings.facebook && <a href={settings.facebook} className="w-9 h-9 rounded-full border border-slate-700 grid place-items-center hover:border-[var(--gold)]" data-testid="footer-facebook"><Facebook size={16} /></a>}
                        {settings.instagram && <a href={settings.instagram} className="w-9 h-9 rounded-full border border-slate-700 grid place-items-center hover:border-[var(--gold)]" data-testid="footer-instagram"><Instagram size={16} /></a>}
                        {settings.linkedin && <a href={settings.linkedin} className="w-9 h-9 rounded-full border border-slate-700 grid place-items-center hover:border-[var(--gold)]" data-testid="footer-linkedin"><Linkedin size={16} /></a>}
                        {settings.youtube && <a href={settings.youtube} className="w-9 h-9 rounded-full border border-slate-700 grid place-items-center hover:border-[var(--gold)]" data-testid="footer-youtube"><Youtube size={16} /></a>}
                    </div>
                </div>

                <div>
                    <div className="overline text-[var(--gold)]">Explore</div>
                    <ul className="mt-5 space-y-2.5 text-slate-300">
                        <li><Link to="/properties" className="hover:text-[var(--gold)]">All Properties</Link></li>
                        <li><Link to="/emi-calculator" className="hover:text-[var(--gold)]">EMI Calculator</Link></li>
                        <li><Link to="/properties?category=Presidential+Properties" className="hover:text-[var(--gold)]">Presidential</Link></li>
                        <li><Link to="/properties?category=Under+Construction" className="hover:text-[var(--gold)]">Under Construction</Link></li>
                        <li><Link to="/properties?category=Ready+to+Move" className="hover:text-[var(--gold)]">Ready to Move</Link></li>
                        <li><Link to="/contact" className="hover:text-[var(--gold)]">Contact</Link></li>
                    </ul>
                </div>

                <div>
                    <div className="overline text-[var(--gold)]">Get in touch</div>
                    <ul className="mt-5 space-y-3 text-slate-300">
                        {!hideContact && <li className="flex items-start gap-2"><Phone size={16} className="mt-1 text-[var(--gold)]" /><a href={`tel:${settings.phone}`} className="min-w-0 [overflow-wrap:anywhere]">{settings.phone}</a></li>}
                        {!hideContact && <li className="flex items-start gap-2"><Mail size={16} className="mt-1 text-[var(--gold)]" /><a href={`mailto:${settings.email}`} className="min-w-0 [overflow-wrap:anywhere]">{settings.email}</a></li>}
                        <li className="flex items-start gap-2"><MapPin size={16} className="mt-1 text-[var(--gold)]" /><span className="min-w-0 [overflow-wrap:anywhere]">{settings.address}</span></li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-slate-800">
                <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
                    <div>© {new Date().getFullYear()} Elegant Home Advisors. All rights reserved. · MahaRERA: <span className="text-slate-300 font-medium">A031332601432</span></div>
                    <div className="flex gap-6">
    <Link
        to="/privacy-policy"
        className="hover:text-[var(--gold)]"
    >
        Privacy Policy
    </Link>

    <Link
        to="/terms-of-service"
        className="hover:text-[var(--gold)]"
    >
        Terms of Service
    </Link>

    <Link
        to="/admin/login"
        className="hover:text-[var(--gold)]"
        data-testid="admin-login-link"
    >
        Admin
    </Link>
</div>
                </div>
            </div>
        </footer>
    );
}
