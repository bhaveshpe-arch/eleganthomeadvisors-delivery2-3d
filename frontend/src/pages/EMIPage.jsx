import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ShieldCheck, Zap, Landmark } from "lucide-react";
import EMICalculator from "@/components/EMICalculator";

export default function EMIPage() {
    return (
        <div data-testid="emi-page">
            {/* Header band */}
            <section className="bg-[var(--navy)] text-white">
                <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 md:py-20">
                    <div className="text-xs text-slate-400 mb-4">
                        <Link to="/" className="hover:text-white">Home</Link> / <span className="text-white">EMI Calculator</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
                        <div>
                            <div className="text-[var(--gold)] uppercase tracking-[0.28em] text-xs font-medium">Home Loan Tools</div>
                            <h1 className="font-serif-display text-5xl md:text-6xl font-light mt-4 leading-[1.05]">
                                Plan your EMI before you fall in love with the home.
                            </h1>
                            <p className="text-slate-300 mt-5 max-w-xl leading-relaxed">
                                Move the sliders to see how price, down payment, interest rate and tenure change your monthly outflow. When you're ready, our advisors will fetch pre-approved offers from partner banks.
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <Feature icon={ShieldCheck} label="Bank-grade formula" sub="Standard reducing balance" />
                            <Feature icon={Zap} label="Instant results" sub="No sign-up required" />
                            <Feature icon={Landmark} label="Partner banks" sub="Preferential rates" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Calculator */}
            <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
                <EMICalculator defaultPrice={10000000} />
            </section>

            {/* CTA */}
            <section className="max-w-[1400px] mx-auto px-6 lg:px-10 pb-24">
                <div className="rounded-3xl bg-white border border-slate-200 p-8 md:p-12 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6 items-center">
                    <div>
                        <div className="overline">Ready for the next step?</div>
                        <h2 className="font-serif-display text-3xl md:text-4xl text-[var(--navy)] mt-2">Get a pre-approved home loan offer</h2>
                        <p className="text-slate-600 mt-3 max-w-xl">
                            Share a few basic details and our advisors will pull pre-approved offers from top private &amp; public sector banks — all at preferential rates.
                        </p>
                    </div>
                    <div className="flex md:justify-end gap-3 flex-wrap">
                        <Link to="/contact" className="btn-primary" data-testid="emi-cta-contact">Talk to an Advisor <ChevronRight size={16} /></Link>
                        <Link to="/properties" className="btn-outline-gold" data-testid="emi-cta-browse">Browse Homes</Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

function Feature({ icon: Icon, label, sub }) {
    return (
        <div className="p-4 rounded-2xl border border-slate-800 bg-white/[0.03]">
            <Icon size={18} className="text-[var(--gold)]" />
            <div className="font-medium text-sm mt-3">{label}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
        </div>
    );
}
