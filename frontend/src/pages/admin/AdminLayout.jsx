import React from "react";
import { NavLink, Outlet, Navigate, useNavigate, Link } from "react-router-dom";
import { Home, Building2, Inbox, MessageSquareQuote, HelpCircle, Settings2, LogOut, Users, MapPin, BarChart3, CalendarCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
    { to: "/admin", label: "Overview", icon: Home, end: true },
    { to: "/admin/inquiries", label: "Inquiries", icon: Inbox },
    { to: "/admin/site-visits", label: "Site visits", icon: CalendarCheck },
    { to: "/admin/employees", label: "Employees", icon: Users },
    { to: "/admin/locations", label: "Locations", icon: MapPin },
    { to: "/admin/insights", label: "Insights", icon: BarChart3 },
    { to: "/admin/properties", label: "Properties", icon: Building2 },
    { to: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
    { to: "/admin/faqs", label: "FAQs", icon: HelpCircle },
    { to: "/admin/settings", label: "Settings", icon: Settings2 },
];

export default function AdminLayout() {
    const { user, loading, logout } = useAuth();
    const nav = useNavigate();

    if (loading) return <div className="p-16 text-center text-slate-500">Loading…</div>;
    if (!user) return <Navigate to="/admin/login" replace />;
    if (user.role !== "admin") return <Navigate to="/admin/login" replace />;

    return (
        <div className="min-h-screen bg-slate-50" data-testid="admin-layout">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-screen">
                <aside className="bg-[var(--navy)] text-slate-200 p-6 lg:min-h-screen">
                    <Link to="/" className="flex items-center gap-3 pb-8 border-b border-slate-800">
                        <div className="w-9 h-9 rounded-full bg-[var(--gold)] text-[var(--navy)] grid place-items-center font-serif-display">E</div>
                        <div>
                            <div className="font-serif-display text-white text-lg leading-tight">Elegant Admin</div>
                            <div className="text-[10px] uppercase tracking-widest text-[var(--gold)]">Home Advisors</div>
                        </div>
                    </Link>

                    <nav className="mt-6 space-y-1">
                        {NAV.map((n) => (
                            <NavLink key={n.to} to={n.to} end={n.end}
                                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200 ${isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                                data-testid={`admin-nav-${n.label.toLowerCase()}`}>
                                <n.icon size={18} /> {n.label}
                            </NavLink>
                        ))}
                    </nav>

                    <button
                        onClick={() => { logout(); nav("/admin/login"); }}
                        className="mt-8 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white w-full"
                        data-testid="admin-logout"
                    >
                        <LogOut size={18} /> Sign out
                    </button>
                </aside>

                <main className="p-6 lg:p-10 min-w-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
