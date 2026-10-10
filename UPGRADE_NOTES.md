# Upgrade notes: premium property platform

This upgrade extends the existing app. Nothing was rebuilt, no database migration is needed, and every new
field is optional, so existing properties, enquiries, employees and URLs keep working.

## 1. Deploy

1. Copy the `backend/` and `frontend/` folders over your repo (or replace the repo contents) and push to GitHub.
   Render redeploys on its own.
2. Frontend: `npm install` now also installs three packages: `pannellum` (360° viewer), `@google/model-viewer`
   and `three` (3D viewer). They only download in a visitor's browser when a property has that media.
3. On startup the backend creates ordinary (non-unique) database indexes. It is safe on existing data.

### Environment variables (backend service)

| Variable | Needed | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | **Yes** | Must be set. If it is missing the server logs a warning and the built-in default password is public. |
| `CORS_ORIGINS` | Strongly advised | Set to your site, e.g. `https://eleganthomeadvisors.in`. It currently defaults to `*`. |
| `SITE_URL` | Recommended | Used in `sitemap.xml`. Defaults to `https://eleganthomeadvisors.in`. |
| `SIMILARITY_WEIGHTS` | Optional | JSON, e.g. `{"location":40,"price":20}`. Keys left out keep their default. |
| `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `RESEND_API_KEY`, `NOTIFY_EMAIL` | As before | Unchanged. `VAPID_*` is no longer used and can be deleted. |

Frontend (build-time): `REACT_APP_BACKEND_URL` as before. Optional `REACT_APP_SITE_URL` for canonical links.

### Sitemap

The backend serves `/api/sitemap.xml`. To have `https://yourdomain/sitemap.xml` work, add a **Rewrite** rule on the
Render static site: source `/sitemap.xml`, destination `https://<your-backend>.onrender.com/api/sitemap.xml`
(Render accepts a full public URL as a rewrite destination). Then submit the sitemap in Google Search Console.
`frontend/public/robots.txt` already points to `/sitemap.xml` and hides `/admin`.

## 2. What the admin can now do

* **Properties → edit**: sections for basic info, pricing, project details, description, amenities, media, location,
  SEO and documents. Media manager handles photos (make primary, reorder, delete), videos (YouTube or `.mp4`),
  360° tour, 3D model and floor plans with room sizes.
* **Inquiries**: filters, a lead panel with contact buttons, assignment, status, site-visit date, follow-up date,
  notes and a full activity timeline.
* **Site visits**: today, upcoming, pending, completed, cancelled and follow-ups, filterable by employee, property,
  status, date and customer.
* **Insights**: pipeline and employee charts as before, plus website activity (views, saves, compares, WhatsApp and
  call clicks, brochure downloads) and most viewed / enquired / shortlisted / visited properties.
* Similar-property weighting can be changed with `PUT /api/config/similarity` (admin login) or the env variable.

## 3. Media: what you need to provide

**Photos and floor-plan pictures (2D and 3D) can be uploaded from the editor** (JPG, PNG or WebP, up to 8 MB). The backend
checks that the file really is an image, shrinks it to 2400 px, converts it to WebP and stores it in MongoDB, so it survives
redeploys. Uploaded plans are served by your own backend with CORS headers, so the automatic 3D view works with them. Videos,
360° images, 3D models and brochures are still pasted as links. Backend needs `Pillow` (added to `requirements.txt`).
Share links: the Share buttons use `/api/share/<slug>`, which gives WhatsApp/Facebook a preview card and then opens the property page.

* **360° tour**: needs a real equirectangular panorama (2:1 ratio, `.jpg/.png/.webp`) whose host sends CORS headers,
  or a Matterport/Kuula page link. A normal flat photo will look wrong. Nothing shows until a link is added.
* **3D model**: a real `.glb` or `.gltf` file. A photograph cannot be turned into an accurate model automatically; that
  needs an external 3D/AI service, which can be added later behind the same field.
* **Floor plans**: add the 2D image, an optional 3D picture, carpet area, bedrooms, bathrooms and room sizes.
  Room sizes accept `19'7"`, `19 7` or `19.6`. Without images the older card view is shown.

## 4. Data handling

* Shortlist and compare are stored in the visitor's browser (no account needed).
* Analytics store only an event type, a property id and a date. No IP address, cookie or device details.
* Distances under "What's Around" are whatever you type. The site never invents them.
* The homepage numbers (homes, developers, ready to move, per-area counts) come from your database.
  Seeded demo testimonials may still be in your database: replace them under Admin → Testimonials.

## 5. Security changes

* CSV export is admin-only (it was open to any logged-in user) and is protected against spreadsheet formula injection.
* Search text is no longer treated as a regex. Customer text is HTML-escaped in the lead email.
* Login (10 per 10 min) and the public enquiry/event endpoints are rate limited per IP, per server process.
* Input is trimmed and bounded; dates and emails are validated (invalid email still returns 422 as before).
* Editor links must start with `http://` or `https://`; the 3D link must end in `.glb`/`.gltf`.
* The CSV download now sends the token in a header instead of a URL.

## 6. Tests

```
cd backend
pip install -r requirements.txt
pip install mongomock-motor httpx pytest pytest-xdist
pytest tests/test_premium_features.py -n0     # new features, in-memory database
REACT_APP_BACKEND_URL=<url> pytest tests/backend_test.py -n0   # original suite (needs a running API)
```

## 7. Known limits

* Rate limiting is per server process; with several instances each keeps its own counters.
* Social-share previews (WhatsApp/Facebook cards) for property pages are not generated, because the site renders in
  the browser. Google reads the page tags and structured data; link-preview bots usually do not.
* Image sizes are not auto-resized because photos are external links. Use a host that resizes (for example
  Cloudinary URL transformations).
* Rollback: redeploy the previous commit. The extra fields are ignored by older code.

## 8. Third-party scripts removed

`frontend/public/index.html` no longer loads: the Google AdSense script, the `assets.emergent.sh` script, and the
PostHog tracker that reported to `ap.emergent.sh` with session recording on. The small error-hiding script that
existed only for those was removed too. The site now makes no requests to those hosts. If you later want analytics,
the built-in counters in Admin -> Insights already cover views, saves, compares and enquiries without cookies.

## 9. Windows note

Windows has no built-in time-zone database, so the backend now lists `tzdata` in `requirements.txt`, and falls back to a
fixed +05:30 offset (India has no daylight saving) if the database is still missing. On Render (Linux) nothing changes.

## 10. Employee portal removed

The employee login (`/employee/login`), the employee dashboard, the "install as app" manifest and phone push
notifications were removed, ahead of moving to a third-party CRM. Only the admin can sign in. Employees still exist
under Admin -> Employees as records (name, email, phone, locations) so leads can be assigned to them, but they have no
password and cannot log in; any token an employee already had stops working. `pywebpush` was dropped from
`requirements.txt`, and the browser removes the old `/sw.js` service worker on its next visit. The leftover
`push_subscriptions` collection in MongoDB is unused and can be dropped.

## 11. Floor plans & pricing, 3D, room highlights

* The property page now has **Floor Plans & Pricing**: pills per layout type, and one card per layout with size
  (sq.ft and sq.m), area type, picture, price, status and possession, and a Request Callback button. "View homes in 3D"
  swaps in the 3D pictures. Clicking a card opens the full view with room sizes (ft / m), a room highlight on the
  picture, and Schedule site visit / Callback / Enquire.
* **3D pictures**: if you have the isometric renders that builders put in brochures (like the furnished 3D plans on
  big property sites), paste their links in the "3D floor plan image link" field. These are made by 3D artists; no
  script can produce that look from a 2D drawing.
* **Automatic 3D view (approximate)**: tick "Offer an approximate 3D view built automatically from the 2D plan" for a
  layout. The visitor's browser traces the thick dark walls of the 2D drawing and raises them into a rotatable 3D model,
  with the original drawing on the floor. It shows walls only (no furniture) and heights are not exact. Quality depends
  on the drawing: clean plans with thick dark walls work; plans where walls are drawn as thin double lines do not.
  The editor shows a live preview with three sliders so you can judge it before saving, and visitors see nothing if
  too few walls are found. Nothing is uploaded or stored. The plan image must be hosted where other websites may read
  it (CORS), for example Cloudinary; otherwise visitors see a short message instead of the 3D view.
* **Room highlights**: in the editor, add room names, click "Mark rooms on the picture" and drag a box around each room.
* New optional layout fields: area type, room boxes, which picture the boxes were drawn on, and the 3D settings.

## 12. Contact details shown only after a request

Call Now and WhatsApp buttons were removed from property cards, property pages, the mobile bar, the compare page, the
shortlist page and the floating WhatsApp button. The header phone and the footer phone/email are also hidden on those
pages (`frontend/src/lib/contactGate.js` holds the rule). After a customer sends a **site-visit request** or an
**enquiry** (from a card, a layout, the property page or the side form) a pop-up shows the advisor's phone and a
WhatsApp link with a message about that property. Callback and brochure requests do not reveal them. The header,
footer and floating WhatsApp still show on the home, contact and EMI pages. This is a convenience gate, not
security: the details are still in your public settings.
