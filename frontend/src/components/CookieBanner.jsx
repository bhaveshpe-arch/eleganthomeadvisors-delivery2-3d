import React, { useState, useEffect } from "react";

export default function CookieBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem("eha_cookie_ok")) setVisible(true);
    }, []);

    if (!visible) return null;

    const accept = () => {
        localStorage.setItem("eha_cookie_ok", "1");
        setVisible(false);
    };

    return (
        <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-4" data-testid="cookie-banner">
            <div className="max-w-3xl mx-auto bg-[var(--navy)] text-slate-200 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="text-sm leading-relaxed flex-1">
                    We use cookies to enhance your browsing experience and analyse traffic. By continuing to use this site, you consent to our privacy policy.
                </div>
                <button onClick={accept} className="btn-gold text-sm" data-testid="cookie-accept">
                    Accept
                </button>
            </div>
        </div>
    );
}
