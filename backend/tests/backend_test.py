"""
Backend tests for Elegant Home Advisors API.
Covers: health, properties (list/filter/search/slug/get by id), settings,
testimonials, faqs, meta filters, inquiries (validation, submit, protected list,
CSV export), auth (login/me), protected property CRUD, testimonial CRUD, faq CRUD.
"""
import os
import io
import csv
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    # fallback to reading frontend .env if env not set
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@elegant.com"
ADMIN_PASSWORD = "Elegant@2026"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        assert "Elegant Home Advisors" in r.json().get("message", "")


# ---------- Properties (public) ----------
class TestPropertiesPublic:
    def test_list_all(self, api_client):
        r = api_client.get(f"{API}/properties")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 8, f"Expected at least 8 seeded properties, got {len(data)}"
        # Check first property has required fields
        p = data[0]
        for field in ["name", "slug", "builder", "category", "location",
                      "starting_price", "price_min", "images", "floor_plans",
                      "nearby", "featured", "cover_image"]:
            assert field in p, f"Missing field: {field}"

    def test_list_featured(self, api_client):
        r = api_client.get(f"{API}/properties", params={"featured": "true"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for p in data:
            assert p["featured"] is True

    def test_filter_category_presidential(self, api_client):
        r = api_client.get(f"{API}/properties", params={"category": "Presidential Properties"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for p in data:
            assert p["category"] == "Presidential Properties"

    def test_filter_location_thane(self, api_client):
        r = api_client.get(f"{API}/properties", params={"location": "Thane"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for p in data:
            assert p["location"] == "Thane"

    def test_search_marine(self, api_client):
        r = api_client.get(f"{API}/properties", params={"q": "marine"})
        assert r.status_code == 200
        data = r.json()
        names = [p["name"] for p in data]
        assert any("Marine Grand" in n for n in names), f"Marine Grand not found in: {names}"

    def test_price_range(self, api_client):
        r = api_client.get(f"{API}/properties",
                           params={"min_price": 10000000, "max_price": 30000000})
        assert r.status_code == 200
        data = r.json()
        for p in data:
            assert 10000000 <= p["price_min"] <= 30000000

    def test_get_by_slug(self, api_client):
        r = api_client.get(f"{API}/properties/slug/marine-grand-residences")
        assert r.status_code == 200
        p = r.json()
        assert p["slug"] == "marine-grand-residences"
        assert p["name"] == "Marine Grand Residences"
        assert isinstance(p["floor_plans"], list)
        assert isinstance(p["nearby"], list)
        assert isinstance(p["amenities"], list)

    def test_get_by_slug_404(self, api_client):
        r = api_client.get(f"{API}/properties/slug/does-not-exist-abc")
        assert r.status_code == 404


# ---------- Meta / Settings / Testimonials / FAQs ----------
class TestMeta:
    def test_meta_filters(self, api_client):
        r = api_client.get(f"{API}/meta/filters")
        assert r.status_code == 200
        d = r.json()
        for k in ["categories", "locations", "possession_statuses", "configurations", "builders"]:
            assert k in d and isinstance(d[k], list)
        assert "Presidential Properties" in d["categories"]
        assert "Thane" in d["locations"]

    def test_settings(self, api_client):
        r = api_client.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        for k in ["phone", "whatsapp", "email", "hero_title", "hero_subtitle", "qr_image"]:
            assert k in d, f"Missing settings key: {k}"
        assert d["phone"]
        assert d["whatsapp"]

    def test_testimonials(self, api_client):
        r = api_client.get(f"{API}/testimonials")
        assert r.status_code == 200
        d = r.json()
        assert len(d) >= 3

    def test_faqs_sorted(self, api_client):
        r = api_client.get(f"{API}/faqs")
        assert r.status_code == 200
        d = r.json()
        assert len(d) >= 5
        orders = [x["order"] for x in d]
        assert orders == sorted(orders), f"FAQs not sorted by order: {orders}"


# ---------- Inquiry validation ----------
class TestInquiries:
    def test_submit_valid(self, api_client):
        payload = {
            "inquiry_type": "Site Visit",
            "full_name": "TEST_John Doe",
            "phone": "9876543210",
            "email": "test_john@example.com",
            "message": "Interested",
            "property_name": "Marine Grand Residences",
        }
        r = api_client.post(f"{API}/inquiries", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"]
        assert d["full_name"] == "TEST_John Doe"
        assert d["status"] == "new"

    def test_missing_full_name(self, api_client):
        payload = {
            "inquiry_type": "Site Visit",
            "phone": "9876543210",
            "email": "test@example.com",
        }
        r = api_client.post(f"{API}/inquiries", json=payload)
        assert r.status_code == 422

    def test_invalid_email(self, api_client):
        payload = {
            "inquiry_type": "Site Visit",
            "full_name": "TEST_Jane",
            "phone": "9876543210",
            "email": "not-an-email",
        }
        r = api_client.post(f"{API}/inquiries", json=payload)
        assert r.status_code == 422

    def test_phone_too_short(self, api_client):
        payload = {
            "inquiry_type": "Site Visit",
            "full_name": "TEST_Jane",
            "phone": "12345",
            "email": "test@example.com",
        }
        r = api_client.post(f"{API}/inquiries", json=payload)
        assert r.status_code == 400
        assert "10-digit mobile number" in r.json().get("detail", "").lower() or \
               "10-digit" in r.json().get("detail", "")


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "access_token" in d and d["access_token"]
        assert d["user"]["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": "WrongPass"
        })
        assert r.status_code == 401
        assert "Invalid email or password" in r.json().get("detail", "")

    def test_me_with_token(self, api_client, auth_headers):
        r = api_client.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_without_token(self, api_client):
        # Use a fresh session so we don't carry any headers
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Protected inquiries + CSV export ----------
class TestProtectedInquiries:
    def test_list_inquiries_no_auth(self, api_client):
        r = requests.get(f"{API}/inquiries")
        assert r.status_code == 401

    def test_list_inquiries_auth(self, api_client, auth_headers):
        r = api_client.get(f"{API}/inquiries", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_export_csv(self, api_client, auth_token):
        r = api_client.get(f"{API}/inquiries/export.csv", params={"token": auth_token})
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        # Parse first row (header)
        text = r.text
        reader = csv.reader(io.StringIO(text))
        header = next(reader)
        expected = ["Date", "Inquiry Type", "Full Name", "Phone", "Email",
                    "Preferred Date", "Preferred Time", "Message",
                    "Property Name", "Location", "Assigned To", "Status"]
        assert header == expected, f"CSV headers mismatch: {header}"

    def test_export_csv_bad_token(self, api_client):
        r = api_client.get(f"{API}/inquiries/export.csv", params={"token": "invalid.token"})
        assert r.status_code == 401


# ---------- Protected Property CRUD ----------
class TestPropertyCRUD:
    created_ids = []

    def test_create_property(self, api_client, auth_headers):
        payload = {
            "name": "TEST_Autotest Skyline",
            "slug": "test-autotest-skyline",
            "builder": "TEST Builder",
            "category": "Ready to Move",
            "location": "Thane",
            "starting_price": "₹1.00 Cr onwards",
            "price_min": 10000000,
            "price_max": 15000000,
            "configuration": "2 BHK",
            "configurations": ["2 BHK"],
            "possession": "Ready to Move",
            "possession_status": "Ready to Move",
            "cover_image": "https://example.com/x.jpg",
            "featured": False,
        }
        r = api_client.post(f"{API}/properties", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Autotest Skyline"
        assert d["id"]
        TestPropertyCRUD.created_ids.append(d["id"])

        # Verify via GET
        gr = api_client.get(f"{API}/properties/{d['id']}")
        assert gr.status_code == 200
        assert gr.json()["name"] == "TEST_Autotest Skyline"

    def test_slug_collision_generates_unique(self, api_client, auth_headers):
        payload = {
            "name": "TEST_Autotest Skyline 2",
            "slug": "test-autotest-skyline",  # collision
            "builder": "TEST Builder",
            "category": "Ready to Move",
            "location": "Thane",
            "starting_price": "₹1.00 Cr onwards",
            "price_min": 12000000,
            "configuration": "2 BHK",
            "possession": "Ready to Move",
            "cover_image": "",
        }
        r = api_client.post(f"{API}/properties", headers=auth_headers, json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] != "test-autotest-skyline"
        assert d["slug"].startswith("test-autotest-skyline-")
        TestPropertyCRUD.created_ids.append(d["id"])

    def test_update_property(self, api_client, auth_headers):
        assert TestPropertyCRUD.created_ids, "no created id"
        pid = TestPropertyCRUD.created_ids[0]
        payload = {
            "name": "TEST_Autotest Skyline Updated",
            "slug": "test-autotest-skyline",
            "builder": "TEST Builder",
            "category": "Ready to Move",
            "location": "Thane",
            "starting_price": "₹1.20 Cr onwards",
            "price_min": 12000000,
            "configuration": "2 BHK",
            "possession": "Ready to Move",
            "cover_image": "",
        }
        r = api_client.put(f"{API}/properties/{pid}", headers=auth_headers, json=payload)
        assert r.status_code == 200
        # Verify
        gr = api_client.get(f"{API}/properties/{pid}")
        assert gr.json()["name"] == "TEST_Autotest Skyline Updated"

    def test_delete_all_test_properties(self, api_client, auth_headers):
        for pid in TestPropertyCRUD.created_ids:
            r = api_client.delete(f"{API}/properties/{pid}", headers=auth_headers)
            assert r.status_code == 200
            gr = api_client.get(f"{API}/properties/{pid}")
            assert gr.status_code == 404

    def test_create_property_no_auth(self, api_client):
        r = requests.post(f"{API}/properties", json={"name": "x"})
        assert r.status_code == 401


# ---------- Testimonials CRUD (protected) ----------
class TestTestimonialsCRUD:
    def test_create_and_delete(self, api_client, auth_headers):
        payload = {"id": "TEST_TESTI_1", "name": "TEST_User",
                   "quote": "TEST quote", "rating": 5, "role": "Buyer"}
        r = api_client.post(f"{API}/testimonials", headers=auth_headers, json=payload)
        assert r.status_code == 200
        # Verify in list
        lr = api_client.get(f"{API}/testimonials")
        ids = [t["id"] for t in lr.json()]
        assert "TEST_TESTI_1" in ids

        dr = api_client.delete(f"{API}/testimonials/TEST_TESTI_1", headers=auth_headers)
        assert dr.status_code == 200
        lr2 = api_client.get(f"{API}/testimonials")
        assert "TEST_TESTI_1" not in [t["id"] for t in lr2.json()]


# ---------- FAQ CRUD (protected) ----------
class TestFAQCRUD:
    def test_create_and_delete(self, api_client, auth_headers):
        payload = {"id": "TEST_FAQ_1", "question": "TEST Q?", "answer": "TEST A", "order": 99}
        r = api_client.post(f"{API}/faqs", headers=auth_headers, json=payload)
        assert r.status_code == 200
        lr = api_client.get(f"{API}/faqs")
        assert "TEST_FAQ_1" in [x["id"] for x in lr.json()]
        dr = api_client.delete(f"{API}/faqs/TEST_FAQ_1", headers=auth_headers)
        assert dr.status_code == 200


# ---------- Settings update (protected) ----------
class TestSettingsUpdate:
    def test_update_settings(self, api_client, auth_headers):
        cur = api_client.get(f"{API}/settings").json()
        cur.pop("id", None)
        cur.pop("_id", None)
        original_phone = cur.get("phone")

        cur["phone"] = "+91 90000 00000"
        r = api_client.put(f"{API}/settings", headers=auth_headers, json=cur)
        assert r.status_code == 200

        gr = api_client.get(f"{API}/settings")
        assert gr.json()["phone"] == "+91 90000 00000"

        # restore
        cur["phone"] = original_phone
        api_client.put(f"{API}/settings", headers=auth_headers, json=cur)
