import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import useManifest from "@/lib/useManifest";

export default function EmployeeLogin() {
    const { login } = useAuth();
    useManifest();
    const nav = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        setBusy(true);
        try {
            const user = await login(email, password);
            if (user.role !== "employee") {
                setErr("This sign-in is for field staff. Admins should use /admin/login.");
                setBusy(false);
                return;
            }
            toast.success(`Welcome, ${user.name?.split(" ")[0] || "there"}`);
            nav("/employee");
        } catch (ex) {
            const msg = formatApiError(ex.response?.data?.detail) || ex.message;
            setErr(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-slate-50" data-testid="employee-login-page">
            <div className="w-full max-w-sm">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 mx-auto rounded-full bg-[var(--navy)] text-[var(--gold)] grid place-items-center font-serif-display text-xl">E</div>
                    <div className="mt-3 font-serif-display text-2xl text-[var(--navy)]">Elegant Home Advisors</div>
                    <div className="text-xs uppercase tracking-widest text-slate-400 mt-1">Employee sign in</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
                    <form onSubmit={submit} className="space-y-4">
                        <label className="block">
                            <span className="text-xs text-slate-600">Email</span>
                            <div className="mt-1 relative">
                                <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoFocus
                                    className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                                    data-testid="employee-email" />
                            </div>
                        </label>
                        <label className="block">
                            <span className="text-xs text-slate-600">Password</span>
                            <div className="mt-1 relative">
                                <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
                                    className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                                    data-testid="employee-password" />
                            </div>
                        </label>

                        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3" data-testid="employee-error">{err}</div>}

                        <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-70" data-testid="employee-submit">
                            {busy ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : "Sign In"}
                        </button>
                    </form>
                </div>
                <p className="text-center text-xs text-slate-400 mt-6">
                    Not staff? <Link to="/" className="underline">Back to the site</Link>
                </p>
            </div>
        </div>
    );
}
