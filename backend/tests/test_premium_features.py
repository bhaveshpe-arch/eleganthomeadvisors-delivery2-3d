"""
Offline tests for the premium-platform features. They run against an in-memory MongoDB (mongomock-motor),
so no real database is touched:   pip install mongomock-motor httpx pytest && pytest tests/test_premium_features.py
"""
import os, sys, asyncio
from pathlib import Path
import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "eha_test")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret")
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "AdminPass#123"

import mongomock_motor
import motor.motor_asyncio as _motor
_motor.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient   # swap the driver BEFORE importing server

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:      # runs startup -> seeds admin + demo data + indexes
        yield c


@pytest.fixture(scope="module")
def admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "AdminPass#123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_existing_properties_still_load_without_new_fields(client):
    r = client.get("/api/properties")
    assert r.status_code == 200 and len(r.json()) > 0
    assert int(r.headers["X-Total-Count"]) >= len(r.json())
    first = r.json()[0]
    assert client.get(f"/api/properties/slug/{first['slug']}").status_code == 200


def test_new_property_fields_roundtrip_and_old_style_payload_ok(client, admin):
    base = client.get("/api/properties").json()[0]
    # old-style payload (none of the new fields) must still be accepted
    old = {k: base[k] for k in ("name", "builder", "category", "location", "starting_price", "configuration", "possession")}
    old.update(slug="legacy-style-prop", price_min=9000000)
    r = client.post("/api/properties", json=old, headers=admin)
    assert r.status_code == 200
    # new-style payload
    new = dict(old, slug="premium-prop", name="Premium Prop", locality="Somatane", property_type="Apartment",
               carpet_area=851, rera_number="P-TEST-1", tour_360_url="https://example.com/pano.jpg",
               model_3d_url="https://example.com/m.glb",
               floor_plans=[{"config": "2 BHK", "area": "851 sq.ft", "price": "₹1.36 Cr", "carpet_area_sqft": 851,
                             "bedrooms": 2, "bathrooms": 2,
                             "rooms": [{"name": "Living Room", "length_ft": 19.58, "width_ft": 9.25}]}])
    r = client.post("/api/properties", json=new, headers=admin)
    assert r.status_code == 200
    got = client.get("/api/properties/slug/premium-prop").json()
    assert got["floor_plans"][0]["rooms"][0]["name"] == "Living Room" and got["model_3d_url"].endswith(".glb")


def test_filters_sort_and_regex_safety(client):
    assert client.get("/api/properties?q=.*").status_code == 200       # must not be treated as a regex
    assert client.get("/api/properties?q=" + "a" * 300).status_code == 422
    r = client.get("/api/properties?sort=price_asc&limit=50").json()
    prices = [p["price_min"] for p in r]
    assert prices == sorted(prices)
    assert all(p["id"] for p in client.get("/api/properties?min_area=800&max_area=900").json())
    ids = ",".join(p["id"] for p in r[:2])
    assert len(client.get(f"/api/properties?ids={ids}").json()) == 2


def test_similar_properties_are_data_driven(client):
    props = client.get("/api/properties").json()
    base = props[0]
    sim = client.get(f"/api/properties/{base['id']}/similar?limit=3")
    assert sim.status_code == 200
    out = sim.json()
    assert all(p["id"] != base["id"] for p in out)
    scores = [p["similarity_score"] for p in out]
    assert scores == sorted(scores, reverse=True)
    assert client.get("/api/properties/nope/similar").status_code == 404


def test_similarity_handles_missing_fields_and_weights():
    base = {"location": "Thane", "price_min": 15000000, "configurations": ["3 BHK"], "builder": "X"}
    near = {"location": "Thane", "price_min": 15500000, "configurations": ["3 BHK"], "builder": "X"}
    far = {"location": "Kalyan", "price_min": 90000000, "configurations": ["1 BHK"], "builder": "Y"}
    w = server.DEFAULT_SIMILARITY_WEIGHTS
    s_near, _ = server.similarity_score(base, near, w)
    s_far, _ = server.similarity_score(base, far, w)
    assert s_near > 90 and s_far < 20 and s_near > s_far
    assert server.similarity_score({}, near, w)[0] == 0.0            # nothing to compare -> no crash


def test_site_visit_flow_activity_and_dashboard(client, admin):
    prop = client.get("/api/properties").json()[0]
    emp = client.post("/api/employees", headers=admin, json={
        "name": "Rahul", "email": "rahul@test.com", "password": "Rahul#12345", "locations": [prop["location"]]})
    assert emp.status_code == 200
    r = client.post("/api/inquiries", json={
        "inquiry_type": "Site Visit", "full_name": "Asha Rao", "phone": "9876543210", "email": "asha@example.com",
        "preferred_date": "2099-01-05", "preferred_time": "11 AM – 1 PM", "visitors": 3,
        "property_id": prop["id"], "kind": "site_visit", "source": "property_page"})
    assert r.status_code == 200
    lead = r.json()
    assert lead["status"] == "site_visit_requested" and lead["assigned_employee_name"] == "Rahul"
    assert lead["visitors"] == 3 and lead["property_name"] == prop["name"]
    assert [a["type"] for a in lead["activity"]] == ["created", "assigned"]

    summ = client.get("/api/site-visits/summary", headers=admin).json()
    assert summ["pending"] >= 1

    r = client.patch(f"/api/inquiries/{lead['id']}/schedule", headers=admin,
                     json={"site_visit_date": "2099-01-06", "site_visit_time": "11:30", "follow_up_date": "2099-01-07"})
    assert r.status_code == 200 and r.json()["status"] == "site_visit_scheduled"
    assert client.patch(f"/api/inquiries/{lead['id']}/schedule", headers=admin,
                        json={"site_visit_date": "31/12/2099"}).status_code == 400
    assert client.get("/api/site-visits?scope=upcoming", headers=admin).json()[0]["id"] == lead["id"]
    assert client.get("/api/site-visits?scope=followups", headers=admin).json()[0]["id"] == lead["id"]

    assert client.patch(f"/api/inquiries/{lead['id']}/status", headers=admin, json={"status": "bogus"}).status_code == 400
    r = client.patch(f"/api/inquiries/{lead['id']}/status", headers=admin, json={"status": "site_visit_completed"})
    assert r.json()["status"] == "site_visit_completed"
    assert client.get("/api/site-visits?scope=completed", headers=admin).json()[0]["id"] == lead["id"]
    final = client.post(f"/api/inquiries/{lead['id']}/notes", headers=admin, json={"text": "Liked the 2 BHK"}).json()
    kinds = [a["type"] for a in final["activity"]]
    assert kinds[:2] == ["created", "assigned"] and "visit" in kinds and "status" in kinds and kinds[-1] == "note"

    # the employee only sees their own work, and cannot reach admin-only data
    tok = client.post("/api/auth/login", json={"email": "rahul@test.com", "password": "Rahul#12345"}).json()["access_token"]
    eh = {"Authorization": f"Bearer {tok}"}
    assert len(client.get("/api/site-visits", headers=eh).json()) >= 1
    assert client.get("/api/inquiries", headers=eh).status_code == 403
    assert client.get("/api/inquiries/export.csv", headers=eh).status_code == 403   # was open to any user before
    assert client.get("/api/analytics/summary", headers=eh).status_code == 403


def test_public_validation_and_old_payload(client):
    base = {"inquiry_type": "Ready to Move", "full_name": "Old Form", "phone": "9876543210", "email": "o@example.com"}
    assert client.post("/api/inquiries", json=base).status_code == 200            # exactly what the old form sent
    assert client.post("/api/inquiries", json=dict(base, phone="123")).status_code == 400
    assert client.post("/api/inquiries", json=dict(base, preferred_date="tomorrow")).status_code == 400
    r = client.post("/api/inquiries", json=dict(base, kind="hacker", visitors=9999, message="x" * 5000))
    assert r.json()["kind"] == "enquiry" and r.json()["visitors"] == 50 and len(r.json()["message"]) == 2000


def test_csv_blocks_formula_injection(client, admin):
    client.post("/api/inquiries", json={"inquiry_type": "x", "full_name": "=HYPERLINK(\"http://evil\")",
                                        "phone": "9876543210", "email": "c@example.com"})
    text = client.get("/api/inquiries/export.csv", headers=admin).text
    assert "'=HYPERLINK" in text


def test_events_and_analytics(client, admin):
    pid = client.get("/api/properties").json()[0]["id"]
    for _ in range(3):
        assert client.post("/api/events", json={"type": "property_view", "property_id": pid}).status_code == 204
    assert client.post("/api/events", json={"type": "property_saved", "property_id": pid}).status_code == 204
    assert client.post("/api/events", json={"type": "drop_table"}).status_code == 400
    a = client.get("/api/analytics/summary", headers=admin).json()
    assert a["event_totals"]["property_view"] == 3 and a["top_viewed"][0]["property_id"] == pid


def test_meta_overview_is_real_data(client):
    o = client.get("/api/meta/overview").json()
    assert o["total_properties"] == len(client.get("/api/properties?limit=200").json())
    assert client.get("/api/meta/filters").json()["builders"]
    assert "<urlset" in client.get("/api/sitemap.xml").text


def test_similarity_config_admin_only(client, admin):
    assert client.put("/api/config/similarity", json={"location": 10}).status_code == 401
    r = client.put("/api/config/similarity", headers=admin, json={"location": 50, "price": 10, "configuration": 10,
                                                                    "carpet_area": 10, "property_type": 10, "other": 10})
    assert r.status_code == 200
    assert client.get("/api/config/similarity", headers=admin).json()["weights"]["location"] == 50
    assert client.put("/api/config/similarity", headers=admin, json={"location": -1}).status_code == 400


def test_login_rate_limit(client):
    codes = [client.post("/api/auth/login", json={"email": "x@y.com", "password": "bad"}).status_code for _ in range(14)]
    assert 429 in codes


def test_lead_email_escapes_customer_html(client, monkeypatch):
    sent = {}
    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server.resend.Emails, "send", lambda payload: sent.update(payload))
    monkeypatch.setenv("NOTIFY_EMAIL", "owner@example.com")
    inq = server.Inquiry(inquiry_type="Site Visit", full_name="<script>alert(1)</script>", phone="9876543210",
                         email="a@example.com", kind="site_visit", message="<img src=x onerror=1>")
    asyncio.run(server.send_lead_email(inq))
    assert "<script>" not in sent["html"] and "&lt;script&gt;" in sent["html"]
    assert "<img src=x" not in sent["html"]
    assert sent["subject"].startswith("Site Visit Request")


def test_callback_needs_no_email_but_enquiry_does(client):
    cb = {"inquiry_type": "Callback", "full_name": "Call Me", "phone": "9876543210", "kind": "callback"}
    assert client.post("/api/inquiries", json=cb).status_code == 200
    assert client.post("/api/inquiries", json=dict(cb, kind="enquiry")).status_code == 422
    assert client.post("/api/inquiries", json=dict(cb, kind="site_visit")).status_code == 422
    assert client.post("/api/inquiries", json=dict(cb, email="not-an-email")).status_code == 422


def test_india_time_helpers_work_even_without_a_system_tz_database():
    from datetime import datetime, timedelta
    assert datetime.now(server.IST).utcoffset() == timedelta(hours=5, minutes=30)
    day = server.today_ist()
    assert len(day) == 10 and server.valid_iso_date(day)
    assert server.format_inquiry_datetime("2026-01-01T00:00:00+00:00").endswith("05:30 AM IST")


def test_floor_plan_new_fields_roundtrip_and_limits(client, admin):
    base = client.get("/api/properties").json()[0]
    p = {k: base[k] for k in ("name", "builder", "category", "location", "starting_price", "configuration", "possession")}
    p.update(slug="fp-fields", name="FP Fields", price_min=9000000, floor_plans=[{
        "config": "3 BHK", "area": "1878 sq.ft", "price": "₹2.07 Cr", "area_type": "Super Built-up Area", "rooms_image": "3d",
        "auto_3d": True, "auto_3d_threshold": 120, "auto_3d_detail": 2, "auto_3d_height": 8,
        "rooms": [{"name": "Living Room", "length_ft": 19.5, "width_ft": 9, "x": 10, "y": 20, "w": 30, "h": 25},
                  {"name": "Kitchen"}]}])
    assert client.post("/api/properties", json=p, headers=admin).status_code == 200
    got = client.get("/api/properties/slug/fp-fields").json()["floor_plans"][0]
    assert got["area_type"] == "Super Built-up Area" and got["auto_3d"] is True and got["rooms"][0]["w"] == 30
    assert got["rooms"][1]["x"] is None                      # a room without a highlight box is fine
    bad = dict(p, slug="fp-bad", floor_plans=[dict(p["floor_plans"][0], auto_3d_threshold=999)])
    assert client.post("/api/properties", json=bad, headers=admin).status_code == 422
    bad2 = dict(p, slug="fp-bad2", floor_plans=[dict(p["floor_plans"][0], rooms=[{"name": "X", "x": 150}])])
    assert client.post("/api/properties", json=bad2, headers=admin).status_code == 422
    old_style = dict(p, slug="fp-old", floor_plans=[{"config": "2 BHK", "area": "900 sq.ft", "price": "₹1 Cr"}])
    assert client.post("/api/properties", json=old_style, headers=admin).status_code == 200   # old records still valid


def test_contact_revealed_event_is_accepted(client):
    pid = client.get("/api/properties").json()[0]["id"]
    assert client.post("/api/events", json={"type": "contact_revealed", "property_id": pid}).status_code == 204


def test_share_preview_has_og_tags_and_escapes(client, admin):
    r = client.get("/api/properties?limit=1")
    slug = r.json()[0]["slug"]
    page = client.get(f"/api/share/{slug}")
    assert page.status_code == 200 and 'property="og:title"' in page.text and f"/property/{slug}" in page.text
    assert client.get("/api/share/does-not-exist").status_code == 404


def test_image_upload_validates_and_serves(client, admin):
    import io
    from PIL import Image
    buf = io.BytesIO(); Image.new("RGB", (40, 30), "white").save(buf, "PNG")
    assert client.post("/api/uploads", files={"file": ("a.png", buf.getvalue(), "image/png")}).status_code in (401, 403)
    r = client.post("/api/uploads", headers=admin, files={"file": ("a.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200
    got = client.get(r.json()["path"])
    assert got.status_code == 200 and got.headers["content-type"] == "image/webp"
    bad = client.post("/api/uploads", headers=admin, files={"file": ("x.png", b"<script>alert(1)</script>", "image/png")})
    assert bad.status_code == 400


def test_site_visit_and_home_visit_support(client):
    # Test standard site visit with pickup and drop
    sv_payload = {
        "inquiry_type": "Site Visit", "full_name": "Rohan Sharma", "phone": "9876543210",
        "email": "rohan@example.com", "kind": "site_visit", "visit_type": "site_visit",
        "pickup_location": "Bandra Kurla Complex", "drop_location": "Bandra West",
        "preferred_date": "2026-12-15", "preferred_time": "11 AM – 1 PM", "visitors": 2
    }
    r = client.post("/api/inquiries", json=sv_payload)
    assert r.status_code == 200
    res = r.json()
    assert res["status"] == "site_visit_requested"
    assert res["visit_type"] == "site_visit"
    assert res["pickup_location"] == "Bandra Kurla Complex"
    assert res["drop_location"] == "Bandra West"
    assert res["visitors"] == 2
    assert any("Pickup:" in act["text"] for act in res["activity"])

    # Test home visit with address (visitors forced to 0)
    hv_payload = {
        "inquiry_type": "Site Visit", "full_name": "Priya Patel", "phone": "9812345678",
        "email": "priya@example.com", "kind": "site_visit", "visit_type": "home_visit",
        "home_address": "Flat 402, Royal Palms, Hiranandani Estate, Thane West",
        "preferred_date": "2026-12-16", "preferred_time": "3 PM – 5 PM", "visitors": 5
    }
    r2 = client.post("/api/inquiries", json=hv_payload)
    assert r2.status_code == 200
    res2 = r2.json()
    assert res2["status"] == "site_visit_requested"
    assert res2["visit_type"] == "home_visit"
    assert res2["visitors"] == 0  # No visitors on home visit
    assert "Hiranandani Estate" in res2["home_address"]
    # Verify address recorded in activity timeline
    assert any("Address:" in act["text"] for act in res2["activity"])

