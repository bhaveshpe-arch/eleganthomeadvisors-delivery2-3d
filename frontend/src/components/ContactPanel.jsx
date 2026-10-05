import React, { useEffect } from "react";
import { Phone, MessageCircle } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { track } from "@/lib/track";
import { whatsappLink, propertyWhatsAppText } from "@/lib/media";

/**
 * The advisor's phone and WhatsApp details. They are only shown here, after a visitor has sent a
 * site-visit request or an enquiry, and never on the property pages themselves.
 */
export default function ContactPanel({ property }) {
    const { settings } = useSettings();
    const phone = settings?.phone;
    const wa = whatsappLink(settings, property ? propertyWhatsAppText(property) : "Hi, I just sent an enquiry on your website.");

    useEffect(() => {
        if (phone || wa) track("contact_revealed", property?.id || "");
    }, [phone, wa, property?.id]);

    if (!phone && !wa) return null;
    return (
        <div className="mt-5 rounded-2xl bg-[var(--cream)] border border-slate-200 p-4 text-left" data-testid="contact-panel">
            <div className="text-xs uppercase tracking-widest text-slate-500">Talk to your advisor</div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                {phone && (
                    <a href={`tel:${phone}`} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--navy)] text-white text-sm py-2.5" data-testid="contact-call">
                        <Phone size={15} /> {phone}
                    </a>
                )}
                {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 rounded-full text-white text-sm py-2.5" style={{ background: "#128C7E" }} data-testid="contact-whatsapp">
                        <MessageCircle size={15} /> WhatsApp us
                    </a>
                )}
            </div>
        </div>
    );
}
