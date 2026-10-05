# Elegant Home Advisors — Setup & Deployment Guide

> **Note:** The problem statement asked for a WordPress build. This platform (Emergent) provisions React + FastAPI + MongoDB apps and cannot install PHP/WordPress. So the live site was built as an **equivalent modern real-estate website with a built-in admin dashboard that mirrors the WordPress workflow**. Everything on the site — properties, banners, testimonials, FAQs, contact info, inquiries — is managed **without touching any code**, exactly as WordPress would.
>
> A **WordPress migration/setup guide** is also included below in case you still want to deploy to GoDaddy shared hosting later.

---

## 1. Live App Overview

**Website Name:** Elegant Home Advisors
**Tagline:** Your Trusted Partner in Finding Premium Homes

### Public Pages
| Route | Purpose |
|---|---|
| `/` | Home (Hero, Search, Featured, Categories, Locations, Why Us, Builders, Latest, Testimonials, FAQ, CTA) |
| `/properties` | Listings with sidebar filters (Category, Location, Budget, Configuration, Possession, Builder, Search) |
| `/property/:slug` | Property detail (Gallery, Overview, Highlights, Amenities, Floor Plans, Map, Nearby, Inquiry Sidebar) |
| `/contact` | Contact page with inquiry form |
| `/admin/login` | Admin login |
| `/admin/*` | Admin dashboard |

### Admin Dashboard (`/admin`)
- **Overview**: KPIs + recent leads
- **Properties**: Add / Edit / Delete / Feature. Full ACF-style field editor (name, builder, category, location, price, config, possession, description, highlights, amenities, floor plans, images, map embed, nearby places, badge, SEO title/description, brochure URL)
- **Inquiries**: All submissions with search + Export **CSV / Excel**
- **Testimonials**: Add / Delete
- **FAQs**: Add / Delete
- **Settings**: Contact details, WhatsApp number, QR code, office address, hero banner, social links

### Global Features
- Floating **WhatsApp** button (with pulse) + **QR popup** in bottom-right on every page
- Property status **badges**: New Launch, Hot Deal, Limited Inventory, Sold Out
- **Cookie consent** banner
- **WhatsApp share** button on property pages
- Inquiry form with client-side validation (required fields, valid email, 10-digit phone) and success toast
- Global settings — change once, updates everywhere (phone, email, WhatsApp, QR, address, hero, socials)

---

## 2. Default Credentials

| Item | Value |
|---|---|
| Admin URL | `/admin/login` |
| Email | `admin@elegant.com` |
| Password | `Elegant@2026` |

Change the password by editing `/app/backend/.env` → `ADMIN_PASSWORD` and restarting the backend. The seed logic re-syncs the password on startup.

---

## 3. Environment Variables

### `/app/backend/.env`
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
JWT_SECRET="<64-char random hex>"
ADMIN_EMAIL="admin@elegant.com"
ADMIN_PASSWORD="Elegant@2026"
```

### `/app/frontend/.env`
```
REACT_APP_BACKEND_URL=<your deployed backend base URL>
```

---

## 4. Everyday Admin Tasks (No Coding)

### 4.1 Add a new property
1. Go to `/admin/login`, sign in.
2. Click **Properties** → **Add Property**.
3. Fill in name, builder, category, location, price, configuration, description.
4. Add gallery **image URLs** (paste from Unsplash / your CDN / GDrive share link).
5. Optional: highlights, amenities, floor plans, Google Map embed URL, nearby places, brochure PDF URL.
6. Toggle **Featured** to show on the homepage carousel.
7. Pick a **Badge** (New Launch / Hot Deal / Limited / Sold Out) if applicable.
8. Click **Save**.

### 4.2 Change the phone / WhatsApp / email / address
- `/admin/settings` → update the field → **Save**. It reflects everywhere on the site — footer, header call button, floating WhatsApp, contact page, inquiry alerts.

### 4.3 Replace the WhatsApp QR
- Generate a QR at https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https%3A%2F%2Fwa.me%2F<yourNumber> (already the default) OR upload your own image URL.
- Paste the URL in **Settings → WhatsApp QR Image URL** → Save.

### 4.4 Change the homepage banner
- **Settings → Homepage Hero** → replace Title, Subtitle, and Image URL.

### 4.5 Update logo / brand name
- The header logo is rendered as the `E` monogram + brand text. To change the wordmark, edit `/app/frontend/src/components/Header.jsx` (line with "Elegant Home Advisors").

### 4.6 Export leads / inquiries
- `/admin/inquiries` → **Export CSV** or **Export Excel** (opens in Excel natively).

### 4.7 Add/edit testimonials & FAQs
- `/admin/testimonials` and `/admin/faqs` — fill form on the left, list on the right.

---

## 5. WordPress Migration Guide (Optional — GoDaddy Hosting)

If you still want a WordPress build on GoDaddy, follow the summary below and hand this to any WordPress freelancer. The custom site above already contains all the content, images and copy you'll need.

### 5.1 Recommended stack
- **Theme:** Astra (free) or Blocksy — both are fast and Elementor-friendly
- **Page Builder:** Elementor Pro
- **CPT + fields:** Custom Post Type UI + Advanced Custom Fields (ACF Pro)
- **Forms:** WPForms Pro or Fluent Forms (has entry export + email notification)
- **SEO:** Rank Math
- **Cache:** LiteSpeed Cache (if GoDaddy plan supports) or WP Rocket
- **Images:** Smush
- **Backup:** UpdraftPlus
- **Security:** Wordfence + Really Simple SSL
- **Redirects:** Redirection

### 5.2 GoDaddy deploy steps
1. Log in to **GoDaddy → My Products → Web Hosting → Manage**.
2. In **cPanel**, launch **Installatron** (or "Install WordPress") → install WordPress on your primary domain.
3. **Domain connect**: In GoDaddy DNS, ensure your domain's A record points to the hosting IP shown in cPanel (already configured if you bought hosting through GoDaddy).
4. **SSL**: In GoDaddy → SSL Certificates → activate free "GoDaddy Managed SSL" or install "Let's Encrypt" via cPanel.
5. Log into WordPress (`yourdomain.com/wp-admin`).
6. Install the plugins above (Plugins → Add New → search → Install → Activate).
7. Install the Astra theme and activate.
8. **Settings → Permalinks** → choose "Post name".
9. **Really Simple SSL** → enable HTTPS site-wide.

### 5.3 Content model
Create a **Property** CPT with slug `property` and these ACF fields:

| Field | Type |
|---|---|
| Builder | Text |
| Category | Select (Presidential Properties, Under Construction, Ready to Move) |
| Location | Select (South Mumbai, Thane, Navi Mumbai, Dombivli, Kalyan) |
| Address | Text |
| Starting Price (display) | Text |
| Configuration (display) | Text |
| Possession | Text |
| Possession Status | Select |
| Short Description | Textarea |
| Description | WYSIWYG |
| Highlights | Repeater (Text) |
| Amenities | Repeater (Text) |
| Floor Plans | Repeater (Config, Area, Price, Image) |
| Gallery | Gallery |
| Cover Image | Image |
| Google Map Embed | URL |
| Nearby Places | Repeater (Label, Value) |
| Badge | Select (New Launch, Hot Deal, Limited Inventory, Sold Out) |
| Featured | True/False |
| Brochure PDF | File |
| SEO Title | Text |
| SEO Description | Textarea |

### 5.4 Homepage build (Elementor)
Design each section using Elementor + Essential Addons:
1. Hero with background image + search bar
2. Featured Projects (Posts widget filtered by Featured=True)
3. Browse by Category (Icon Box grid)
4. Browse by Location (Image Card grid)
5. Why Choose Us (Icon List)
6. Featured Builders (Image logo strip)
7. Latest Properties (Posts widget)
8. Testimonials (Testimonial Slider)
9. FAQ (Accordion)
10. Contact CTA
11. Footer

### 5.5 Inquiry form
- Build the same 8-field form (Inquiry Type, Full Name, Phone, Email, Preferred Date, Preferred Time, Message, Property Name) using WPForms.
- Under **Settings → Notifications**, send new-entry emails to your inbox.
- Under **Entries → Export**, download CSV / XLSX.

### 5.6 Floating WhatsApp + QR
- Install **"Click to Chat by Holithemes"** for the floating WhatsApp button.
- Add a custom HTML widget to display a QR code image beside the button (or use "Click to Chat Pro" which supports QR popups).

### 5.7 SEO + Analytics
- Rank Math → configure sitemap, meta, schema
- Rank Math → **Sitemap → submit** to Google Search Console
- Add GA4 measurement ID under Rank Math → Analytics
- Facebook Pixel: install the "PixelYourSite" plugin

### 5.8 Backup and Restore
- **UpdraftPlus** → Settings → schedule daily backups to Google Drive / Dropbox
- To restore: UpdraftPlus → Existing Backups → **Restore**

---

## 6. Deploying the Current React/Fast API App

- Push to GitHub via the **"Save to GitHub"** button in this chat's input bar.
- Use Emergent's **1-click Deploy** to publish under your subdomain, then set your custom domain to point via DNS CNAME.
- To also deploy to GoDaddy: you'd need a VPS / cPanel that supports Node.js + Python + MongoDB (GoDaddy shared hosting only supports PHP/MySQL). Alternative hosts: DigitalOcean, Railway, Render.

---

## 7. Future Enhancements (Ready to Slot In)
- Blog / Insights CPT
- EMI + Mortgage calculators
- Property comparison
- Saved / shortlisted properties (requires user auth)
- CRM integration (HubSpot, Zoho, Salesforce)
- GA4 + Facebook Pixel (drop the snippet in `/app/frontend/public/index.html`)
- Automatic sitemap submission

---

## 8. Support Commands (Devs Only)

```bash
# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# Check logs
tail -n 100 /var/log/supervisor/backend.err.log
tail -n 100 /var/log/supervisor/frontend.err.log
```
