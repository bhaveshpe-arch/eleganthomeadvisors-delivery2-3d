import React from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import useManifest from "@/lib/useManifest";

export default function EmployeeLayout() {
    const { user, loading, logout } = useAuth();
    const nav = useNavigate();
    useManifest();

    if (loading) return <div className="p-16 text-center text-slate-500">Loading…</div>;
    if (!user) return <Navigate to="/employee/login" replace />;
    if (user.role !== "employee") return <Navigate to="/admin/login" replace />;

    return (
        <div className="min-h-screen bg-slate-50" data-testid="employee-layout">
            <header className="bg-[var(--navy)] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div>
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--gold)]">
                        {(user.locations || []).join(" · ") || "No location assigned"}
                    </div>
                </div>
                <button
                    onClick={() => { logout(); nav("/employee/login"); }}
                    className="p-2 rounded-lg hover:bg-white/10"
                    aria-label="Sign out"
                    data-testid="employee-logout"
                >
                    <LogOut size={18} />
                </button>
            </header>
            <main className="max-w-2xl mx-auto px-3 py-4 pb-16">
                <Outlet />
            </main>
        </div>
    );
}
