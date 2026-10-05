# Elegant Home Advisors — Product Requirements Document

_Last updated: 2026-07-23_

## Original Problem Statement
Build a complete, responsive, SEO-optimised real estate website for "Elegant Home Advisors" (tagline: _Your Trusted Partner in Finding Premium Homes_), inspired by homebazaar.com but original. Originally requested as WordPress + Elementor Pro + ACF; because this platform only supports React + FastAPI + MongoDB, we delivered the equivalent modern site with a built-in admin CMS that mirrors the WordPress workflow, plus a step-by-step WordPress migration guide for GoDaddy hosting.

## Architecture
- **Frontend:** React 19 + React Router v7 + TailwindCSS + shadcn/ui + Framer Motion (installed) + Sonner toasts + Lucide icons. Google Fonts: Cormorant Garamond (headings) + Outfit (body).
- **Backend:** FastAPI + Motor (async MongoDB) + PyJWT + bcrypt.
- **Auth:** JWT (7-day access token) in `localStorage` (`eha_token`), Bearer header. Admin seeded on startup, password re-syncs with `ADMIN_PASSWORD` env on each boot.
- **Data model (Mongo collections):** `properties`, `inquiries`, `testimonials`, `faqs`, `settings` (single `global` doc), `users`.

## User Personas
1. **Home Buyer** — browses properties, filters by category/location/budget, submits inquiry.
2. **Admin (owner)** — manages properties, exports leads, updates contact info, hero banner, testimonials, FAQs — all from `/admin`, no coding.

## Design System
Deep Navy `#0A192F` + Gold `#C5A880` on cream `#FDFBF7`. Cormorant Garamond serif headings, Outfit body. Rounded cards (rounded-2xl), glassmorphism header, cinematic hero, minimalist status badges, pulse-ring floating WhatsApp.

## Completed (v1.0 — 2026-07-23)
- ✅ FastAPI backend with 20+ endpoints: auth, properties (CRUD + 7 filters), inquiries (submit + protected list + CSV export), settings, testimonials, FAQs, meta/filters
- ✅ Seed data: 8 luxury properties across all 3 categories × 5 locations, 3 testimonials, 5 FAQs, global settings, admin user
- ✅ Homepage: cinematic hero + search, featured (6), 3 category bento cards, 5 location cards, why-us, 8 builders, latest 6, 3 testimonials, FAQ accordion, CTA
- ✅ Property listings page with sidebar filters (Category, Location, Budget bands, Configuration, Possession, Builder, keyword)
- ✅ Property detail page: gallery + thumbs, price bar, overview, highlights, amenities, floor plans, Google Map iframe, nearby places, sticky inquiry sidebar, Call/WhatsApp/Share/WA-Share buttons, brochure link
- ✅ Inquiry form: 8 fields, client-side + server-side validation (email format, 10-digit phone), success toast
- ✅ Floating WhatsApp button with pulse ring + QR modal (image, WA number, Open WhatsApp CTA)
- ✅ Cookie consent banner with localStorage persistence
- ✅ Full admin dashboard at `/admin`: Overview (KPIs + recent leads), Properties (list + editor with lists for highlights/amenities/floor-plans/nearby/images), Inquiries (search + CSV/Excel export via token-signed URL), Testimonials, FAQs, Settings (contact, WhatsApp QR, hero banner, socials)
- ✅ Property status badges: New Launch (emerald), Hot Deal (red), Limited Inventory (amber), Sold Out (slate)
- ✅ SEO: descriptive page title, meta description, OG tags, Twitter card
- ✅ Full responsive layout (mobile filters drawer, adaptive nav, touch-friendly buttons)
- ✅ Complete Setup + WordPress migration guide at `/app/DEPLOYMENT_GUIDE.md`
- ✅ Testing agent: 33/33 backend cases pass, all frontend flows verified

## Backlog / Future (Prioritized)
### P1 — Nice next steps
- Real email delivery for new-lead alerts (SendGrid / Resend + API key from user)
- Blog / Insights CPT-style module
- Google Analytics 4 + Facebook Pixel snippet injection (settings-driven)
- EMI + Mortgage calculators
- Property comparison + saved shortlists (needs buyer accounts)

### P2 — Future
- CRM integration (HubSpot / Zoho)
- reCAPTCHA on inquiry form (spam protection)
- Image upload direct from admin (currently URL-based)
- Multi-currency support for NRI buyers

## Credentials
See `/app/memory/test_credentials.md`. Admin: `admin@elegant.com` / `Elegant@2026`.

## Environment Notes
- Backend port: 8001 (supervisor)
- Frontend port: 3000 (supervisor, hot reload)
- MongoDB local at `mongodb://localhost:27017` DB `test_database`
- All routes prefixed `/api` on backend
