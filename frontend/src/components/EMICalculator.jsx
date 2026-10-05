import React, { useMemo, useState, useEffect } from "react";
import { Calculator, IndianRupee, Percent, Calendar, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const inr = (n) => {
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
    if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

const inrFull = (n) =>
    Number.isFinite(n) ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—";

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/**
 * EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * r  = monthly interest rate (annual / 12 / 100)
 * n  = number of months
 */
function computeEMI({ principal, ratePct, years }) {
    const n = years * 12;
    const r = ratePct / 12 / 100;
    if (principal <= 0 || n <= 0 || r <= 0) {
        return { emi: 0, totalPayment: 0, totalInterest: 0, schedule: [] };
    }
    const pow = Math.pow(1 + r, n);
    const emi = (principal * r * pow) / (pow - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - principal;

    // Year-by-year amortization (aggregate 12 months per row)
    let balance = principal;
    const schedule = [];
    for (let y = 1; y <= years; y++) {
        let yearInterest = 0;
        let yearPrincipal = 0;
        for (let m = 0; m < 12; m++) {
            const interest = balance * r;
            const princ = emi - interest;
            yearInterest += interest;
            yearPrincipal += princ;
            balance -= princ;
        }
        schedule.push({
            year: y,
            principal: yearPrincipal,
            interest: yearInterest,
            balance: Math.max(balance, 0),
        });
    }
    return { emi, totalPayment, totalInterest, schedule };
}

export default function EMICalculator({ defaultPrice = 5000000, compact = false }) {
    const [price, setPrice] = useState(defaultPrice);
    const [downPct, setDownPct] = useState(20);
    const [ratePct, setRatePct] = useState(8.5);
    const [years, setYears] = useState(20);

    useEffect(() => {
        if (defaultPrice && defaultPrice > 0) setPrice(defaultPrice);
    }, [defaultPrice]);

    const downPayment = useMemo(() => Math.round((price * downPct) / 100), [price, downPct]);
    const principal = Math.max(price - downPayment, 0);

    const { emi, totalPayment, totalInterest, schedule } = useMemo(
        () => computeEMI({ principal, ratePct, years }),
        [principal, ratePct, years]
    );

    const chartData = [
        { name: "Principal", value: principal, color: "#0A192F" },
        { name: "Interest", value: totalInterest, color: "#C5A880" },
    ];

    return (
        <div className={compact ? "" : "grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8"} data-testid="emi-calculator">
            {/* Inputs */}
            <div className={compact ? "space-y-5" : "bg-white rounded-2xl border border-slate-200 p-7 space-y-6"}>
                {!compact && (
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[var(--gold)]/15 text-[var(--gold-dark)] grid place-items-center">
                            <Calculator size={20} />
                        </div>
                        <div>
                            <div className="font-serif-display text-2xl text-[var(--navy)]">Home Loan Calculator</div>
                            <div className="text-xs text-slate-500">Estimate your monthly EMI in seconds</div>
                        </div>
                    </div>
                )}

                <SliderInput
                    label="Property Price"
                    icon={<IndianRupee size={14} />}
                    value={price}
                    onChange={(v) => setPrice(clamp(v, 500000, 500000000))}
                    min={500000}
                    max={500000000}
                    step={100000}
                    format={inr}
                    testKey="price"
                />
                <SliderInput
                    label="Down Payment"
                    icon={<Percent size={14} />}
                    value={downPct}
                    onChange={(v) => setDownPct(clamp(v, 0, 90))}
                    min={0}
                    max={90}
                    step={1}
                    format={(v) => `${v}%  ·  ${inr(downPayment)}`}
                    testKey="down"
                />
                <SliderInput
                    label="Interest Rate (p.a.)"
                    icon={<Percent size={14} />}
                    value={ratePct}
                    onChange={(v) => setRatePct(clamp(Number(v), 5, 20))}
                    min={5}
                    max={20}
                    step={0.05}
                    format={(v) => `${Number(v).toFixed(2)} %`}
                    testKey="rate"
                />
                <SliderInput
                    label="Tenure"
                    icon={<Calendar size={14} />}
                    value={years}
                    onChange={(v) => setYears(clamp(v, 1, 30))}
                    min={1}
                    max={30}
                    step={1}
                    format={(v) => `${v} year${v > 1 ? "s" : ""}`}
                    testKey="years"
                />

                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Loan Amount" value={inr(principal)} />
                    <Stat label="Down Payment" value={inr(downPayment)} />
                </div>
            </div>

            {/* Output */}
            <div className={compact ? "mt-6" : "space-y-6"}>
                <div className="bg-[var(--navy)] text-white rounded-2xl p-8 relative overflow-hidden">
                    <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[var(--gold)]/20 blur-3xl" />
                    <div className="relative">
                        <div className="text-[11px] uppercase tracking-widest text-[var(--gold)]">Your Monthly EMI</div>
                        <div className="font-serif-display text-5xl mt-2" data-testid="emi-monthly">{inr(emi)}</div>
                        <div className="text-xs text-slate-300 mt-2">{inrFull(emi)} · per month for {years} years</div>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-400">Total Interest</div>
                                <div className="font-serif-display text-2xl mt-1" data-testid="emi-total-interest">{inr(totalInterest)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-400">Total Payment</div>
                                <div className="font-serif-display text-2xl mt-1" data-testid="emi-total-payment">{inr(totalPayment)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {!compact && (
                    <>
                        <div className="bg-white rounded-2xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-serif-display text-xl text-[var(--navy)]">Break-up of Total Payment</div>
                                <TrendingUp size={16} className="text-[var(--gold)]" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-4 items-center">
                                <div className="h-56">
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={chartData} innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                                                {chartData.map((c, i) => <Cell key={i} fill={c.color} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => inrFull(v)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-3">
                                    <LegendRow color="#0A192F" label="Principal" value={inr(principal)} />
                                    <LegendRow color="#C5A880" label="Interest" value={inr(totalInterest)} />
                                    <div className="pt-2 border-t border-slate-100">
                                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Grand Total</div>
                                        <div className="font-serif-display text-2xl text-[var(--navy)] mt-1">{inr(totalPayment)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <details className="bg-white rounded-2xl border border-slate-200" data-testid="emi-schedule">
                            <summary className="cursor-pointer px-6 py-4 font-serif-display text-lg text-[var(--navy)] list-none flex items-center justify-between">
                                Year-by-year amortization
                                <span className="text-xs text-slate-500 font-body">Tap to expand</span>
                            </summary>
                            <div className="px-6 pb-6 overflow-x-auto">
                                <table className="w-full text-sm min-w-[520px]">
                                    <thead className="text-xs uppercase tracking-widest text-slate-500 text-left">
                                        <tr>
                                            <th className="py-2 pr-4">Year</th>
                                            <th className="py-2 pr-4">Principal</th>
                                            <th className="py-2 pr-4">Interest</th>
                                            <th className="py-2">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {schedule.map((r) => (
                                            <tr key={r.year}>
                                                <td className="py-2 pr-4 text-slate-700">{r.year}</td>
                                                <td className="py-2 pr-4 text-slate-700">{inr(r.principal)}</td>
                                                <td className="py-2 pr-4 text-[var(--gold-dark)]">{inr(r.interest)}</td>
                                                <td className="py-2 text-slate-500">{inr(r.balance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    </>
                )}

                {!compact && (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        These figures are indicative and for informational purposes only. Actual interest rate, EMI, and processing charges will vary by bank and applicant profile. Speak to our advisor for pre-approved home loan offers.
                    </p>
                )}
            </div>
        </div>
    );
}

function SliderInput({ label, icon, value, onChange, min, max, step, format, testKey }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-[var(--gold-dark)]">{icon}</span> {label}
                </div>
                <div className="text-sm font-medium text-[var(--navy)]" data-testid={`emi-${testKey}-display`}>{format(value)}</div>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-[var(--gold)]"
                data-testid={`emi-${testKey}-slider`}
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{format(min)}</span>
                <span>{format(max)}</span>
            </div>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
            <div className="text-[var(--navy)] font-medium mt-0.5">{value}</div>
        </div>
    );
}

function LegendRow({ color, label, value }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                <span className="text-sm text-slate-700">{label}</span>
            </div>
            <div className="text-sm font-medium text-[var(--navy)]">{value}</div>
        </div>
    );
}
