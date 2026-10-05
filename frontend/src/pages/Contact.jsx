import React from "react";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import { useSettings } from "@/context/SettingsContext";

export default function Contact() {
    const { settings } = useSettings();
    if (!settings) return null;

    const wa = `https://wa.me/${settings.whatsapp}`;

    return (
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16" data-testid="contact-page">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div>
                    <div className="overline">Get in touch</div>
                    <h1 className="font-serif-display text-5xl md:text-6xl text-[var(--navy)] mt-2 leading-tight">Speak to a private advisor</h1>
                    <p className="text-slate-600 mt-5 max-w-md leading-relaxed">
                        Every conversation is confidential and tailored to your preferences. Reach out any way you like — we typically respond within 30 minutes on business hours.
                    </p>

                    <div className="mt-10 space-y-6">
                        <a href={`tel:${settings.phone}`} className="flex items-center gap-5 group" data-testid="contact-phone">
                            <div className="w-12 h-12 rounded-full bg-[var(--gold)]/15 text-[var(--gold-dark)] grid place-items-center"><Phone size={20} /></div>
                            <div className="min-w-0">
                                <div className="overline">Call us</div>
                                <div className="font-serif-display text-2xl text-[var(--navy)] [overflow-wrap:anywhere] group-hover:text-[var(--gold-dark)] transition-colors duration-300">{settings.phone}</div>
                            </div>
                        </a>
                        <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-5 group" data-testid="contact-whatsapp">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center"><MessageCircle size={20} /></div>
                            <div className="min-w-0">
                                <div className="overline">WhatsApp</div>
                                <div className="font-serif-display text-2xl text-[var(--navy)] [overflow-wrap:anywhere] group-hover:text-emerald-700 transition-colors duration-300">Chat instantly</div>
                            </div>
                        </a>
                        <a href={`mailto:${settings.email}`} className="flex items-center gap-5 group" data-testid="contact-email">
                            <div className="w-12 h-12 rounded-full bg-slate-100 text-[var(--navy)] grid place-items-center"><Mail size={20} /></div>
                            <div className="min-w-0">
                                <div className="overline">Email</div>
                                <div className="font-serif-display text-2xl text-[var(--navy)] [overflow-wrap:anywhere] group-hover:text-[var(--gold-dark)] transition-colors duration-300">{settings.email}</div>
                            </div>
                        </a>
                        <div className="flex items-start gap-5">
                            <div className="w-12 h-12 rounded-full bg-slate-100 text-[var(--navy)] grid place-items-center shrink-0"><MapPin size={20} /></div>
                            <div className="min-w-0">
                                <div className="overline">Office</div>
                                <div className="text-slate-700 mt-1 max-w-sm leading-relaxed">{settings.address}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <InquiryForm />
                </div>
            </div>
        </div>
    );
}
