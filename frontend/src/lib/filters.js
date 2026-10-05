// Budget bands shared by the homepage search and the property listing filters.
export const BUDGETS = [
    { label: "Under ₹1 Cr", min: 0, max: 10000000 },
    { label: "₹1 – 3 Cr", min: 10000000, max: 30000000 },
    { label: "₹3 – 6 Cr", min: 30000000, max: 60000000 },
    { label: "₹6 – 10 Cr", min: 60000000, max: 100000000 },
    { label: "₹10 Cr+", min: 100000000, max: 999999999 },
];

// Price steps for the custom min / max selectors (INR).
export const PRICE_STEPS = [2500000, 5000000, 7500000, 10000000, 15000000, 20000000, 30000000, 50000000, 75000000, 100000000, 200000000];
