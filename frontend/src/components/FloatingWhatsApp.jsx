import React, { useState } from "react";
import { MessageCircle, QrCode, X, ExternalLink } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useSettings } from "@/context/SettingsContext";
import { track } from "@/lib/track";
import { isPropertyRoute } from "@/lib/contactGate";

export default function FloatingWhatsApp() {
    const { settings } = useSettings();
    const [qrOpen, setQrOpen] = useState(false);
    const { pathname } = useLocation();
    if (!settings?.whatsapp) return null;
    // Property pages must not show advisor contact details: they appear only after an enquiry or site-visit request.
    if (isPropertyRoute(pathname)) return null;

    const waLink = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent("Hi, I'd like to know more about a property on Elegant Home Advisors.")}`;

    return (
        <>
            <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3" data-testid="floating-whatsapp">
                <button
                    onClick={() => setQrOpen(true)}
                    className="w-11 h-11 rounded-full bg-white text-[var(--navy)] border border-slate-200 shadow-md grid place-items-center hover:scale-105 transition-transform duration-300"
                    aria-label="Show WhatsApp QR"
                    data-testid="wa-qr-btn"
                >
                    <QrCode size={20} />
                </button>
                <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("whatsapp_click", "")}
                    className="pulse-ring w-14 h-14 rounded-full grid place-items-center text-white transition-transform duration-300 hover:scale-105"
                    style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                    aria-label="Chat on WhatsApp"
                    data-testid="wa-chat-btn"
                >
                    <MessageCircle size={26} />
                </a>
            </div>

            {qrOpen && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-center px-4"
                    onClick={() => setQrOpen(false)}
                    data-testid="wa-qr-modal"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl fade-up"
                    >
                        <div className="bg-[var(--navy)] text-white px-6 py-5 flex items-center justify-between">
                            <div>
                                <div className="font-serif-display text-2xl">Scan to Chat</div>
                                <div className="text-xs text-[var(--gold)] tracking-wider mt-0.5">Instantly reach our advisors</div>
                            </div>
                            <button onClick={() => setQrOpen(false)} className="p-1.5 rounded-full hover:bg-white/10" aria-label="Close" data-testid="wa-qr-close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 grid place-items-center">
                            <div className="p-3 bg-[var(--cream)] rounded-2xl border border-slate-200">
                                <img
                                    src={settings.qr_image}
                                    alt="WhatsApp QR"
                                    className="w-56 h-56 object-contain"
                                    data-testid="wa-qr-image"
                                />
                            </div>
                            <div className="mt-5 text-center">
                                <div className="text-xs uppercase tracking-widest text-slate-500">WhatsApp Number</div>
                                <div className="font-serif-display text-2xl text-[var(--navy)] mt-1">+{settings.whatsapp.replace(/(\d{2})(\d{5})(\d{5})/, "$1 $2 $3")}</div>
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-primary flex-1 justify-center"
                                data-testid="wa-open-btn"
                            >
                                <MessageCircle size={16} /> Open WhatsApp <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
