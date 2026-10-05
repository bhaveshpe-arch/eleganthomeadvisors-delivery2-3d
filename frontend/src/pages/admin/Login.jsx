import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function AdminLogin() {
    const { login } = useAuth();
    const nav = useNavigate();
    const [email, setEmail] = useState("admin@elegant.com");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        setBusy(true);
        try {
            await login(email, password);
            toast.success("Welcome back");
            nav("/admin");
        } catch (ex) {
            const msg = formatApiError(ex.response?.data?.detail) || ex.message;
            setErr(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-6 py-16" data-testid="admin-login-page">
            <div className="w-full max-w-md">
                <Link to="/" className="text-sm text-slate-500 hover:text-[var(--navy)]">← Back to site</Link>
                <div className="mt-6 bg-white border border-slate-200 rounded-3xl p-9 shadow-sm">
                    <div className="overline">Restricted</div>
                    <h1 className="font-serif-display text-3xl text-[var(--navy)] mt-2">Admin Sign In</h1>
                    <p className="text-sm text-slate-500 mt-1">Sign in to manage properties, inquiries and website content.</p>

                    <form onSubmit={submit} className="mt-8 space-y-4">
                        <label className="block">
                            <span className="text-xs text-slate-600">Email</span>
                            <div className="mt-1 relative">
                                <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" data-testid="admin-email" />
                            </div>
                        </label>
                        <label className="block">
                            <span className="text-xs text-slate-600">Password</span>
                            <div className="mt-1 relative">
                                <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]" data-testid="admin-password" />
                            </div>
                        </label>

                        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3" data-testid="admin-error">{err}</div>}

                        <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-70" data-testid="admin-submit">
                            {busy ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : "Sign In"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
