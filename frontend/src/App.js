import React, { Suspense, lazy, useEffect } from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { SettingsProvider } from "@/context/SettingsContext";
import { AuthProvider } from "@/context/AuthContext";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import CookieBanner from "@/components/CookieBanner";
import CompareBar from "@/components/CompareBar";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollReveal from "@/components/ScrollReveal";

import Home from "@/pages/Home";

// Everything below is loaded on demand, so the first page a visitor opens stays light.
const Properties = lazy(() => import("@/pages/Properties"));
const PropertyDetail = lazy(() => import("@/pages/PropertyDetail"));
const Compare = lazy(() => import("@/pages/Compare"));
const Shortlist = lazy(() => import("@/pages/Shortlist"));
const Contact = lazy(() => import("@/pages/Contact"));
const EMIPage = lazy(() => import("@/pages/EMIPage"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));

const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("@/pages/admin/Overview"));
const AdminProperties = lazy(() => import("@/pages/admin/Properties"));
const AdminInquiries = lazy(() => import("@/pages/admin/Inquiries"));
const AdminSiteVisits = lazy(() => import("@/pages/admin/SiteVisits"));
const AdminTestimonials = lazy(() => import("@/pages/admin/Testimonials"));
const AdminFAQs = lazy(() => import("@/pages/admin/FAQs"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminEmployees = lazy(() => import("@/pages/admin/Employees"));
const AdminLocations = lazy(() => import("@/pages/admin/Locations"));
const AdminInsights = lazy(() => import("@/pages/admin/Insights"));


const PageLoader = () => (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24" role="status" aria-label="Loading">
        <div className="h-8 w-1/3 rounded skeleton" />
        <div className="h-72 rounded-2xl skeleton mt-8" />
    </div>
);

const PublicLayout = ({ children }) => (
    <div className="min-h-screen flex flex-col">
        <ScrollReveal />
        <a href="#main" className="skip-link">Skip to main content</a>
        <Header />
        <main id="main" className="flex-1" tabIndex={-1}>
            <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>{children}</Suspense>
            </ErrorBoundary>
        </main>
        <Footer />
        <FloatingWhatsApp />
        <CompareBar />
        <CookieBanner />
    </div>
);

function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [pathname]);

    return null;
}

function App() {
    return (
        <SettingsProvider>
            <AuthProvider>
                <BrowserRouter>
                    <ScrollToTop />
                    <Toaster position="top-right" richColors closeButton />
                    <ErrorBoundary>
                        <Suspense fallback={<PageLoader />}>
                            <Routes>
                                <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
                                <Route path="/properties" element={<PublicLayout><Properties /></PublicLayout>} />
                                <Route path="/property/:slug" element={<PublicLayout><PropertyDetail /></PublicLayout>} />
                                <Route path="/compare" element={<PublicLayout><Compare /></PublicLayout>} />
                                <Route path="/shortlist" element={<PublicLayout><Shortlist /></PublicLayout>} />
                                <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
                                <Route path="/emi-calculator" element={<PublicLayout><EMIPage /></PublicLayout>} />
                                <Route path="/privacy-policy" element={<PublicLayout><PrivacyPolicy /></PublicLayout>} />
                                <Route path="/terms-of-service" element={<PublicLayout><TermsOfService /></PublicLayout>} />

                                <Route path="/admin/login" element={<AdminLogin />} />
                                <Route path="/admin" element={<AdminLayout />}>
                                    <Route index element={<AdminOverview />} />
                                    <Route path="properties" element={<AdminProperties />} />
                                    <Route path="inquiries" element={<AdminInquiries />} />
                                    <Route path="site-visits" element={<AdminSiteVisits />} />
                                    <Route path="employees" element={<AdminEmployees />} />
                                    <Route path="locations" element={<AdminLocations />} />
                                    <Route path="insights" element={<AdminInsights />} />
                                    <Route path="testimonials" element={<AdminTestimonials />} />
                                    <Route path="faqs" element={<AdminFAQs />} />
                                    <Route path="settings" element={<AdminSettings />} />
                                </Route>

                                <Route path="*" element={<PublicLayout><Home /></PublicLayout>} />
                            </Routes>
                        </Suspense>
                    </ErrorBoundary>
                </BrowserRouter>
            </AuthProvider>
        </SettingsProvider>
    );
}

export default App;
