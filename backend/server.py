from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import csv
import uuid
import logging
import asyncio
import bcrypt
import jwt
import resend
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any
from zoneinfo import ZoneInfo

# India has no daylight saving, so a fixed +05:30 offset is always correct. It is used when the system has no
# time-zone database (for example Windows without the `tzdata` package), instead of crashing.
try:
    IST = ZoneInfo("Asia/Kolkata")
except Exception:
    IST = timezone(timedelta(hours=5, minutes=30), "IST")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, UploadFile, File
from fastapi.responses import StreamingResponse, PlainTextResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
JWT_TTL_HOURS = 24 * 7

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
RESEND_FROM = os.environ.get("RESEND_FROM", "Elegant Home Advisors <onboarding@resend.dev>")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Web push (employee lead notifications)
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:admin@eleganthomeadvisors.in")

INQUIRY_STATUSES = [
    "new", "contacted", "site_visit_requested", "site_visit_scheduled", "site_visit_completed",
    "site_visit_cancelled", "follow_up_required", "negotiation", "closed_won", "closed_lost",
]
OPEN_STATUSES = [s for s in INQUIRY_STATUSES if s not in ("closed_won", "closed_lost", "site_visit_cancelled")]
INQUIRY_KINDS = ["enquiry", "site_visit", "callback", "brochure", "whatsapp"]
EVENT_TYPES = [
    "property_view", "enquiry_submitted", "site_visit_requested", "callback_requested",
    "whatsapp_click", "call_click", "brochure_download", "property_saved", "property_compared",
    "contact_revealed",
]

# Weights used to rank "similar properties". Override at runtime by PUT /api/config/similarity
# (stored in the `config` collection) or via the SIMILARITY_WEIGHTS env var (JSON).
DEFAULT_SIMILARITY_WEIGHTS = {
    "location": 30, "price": 20, "configuration": 20, "carpet_area": 15, "property_type": 10, "other": 5,
}

app = FastAPI(title="Elegant Home Advisors API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- Utilities ----------
def new_id() -> str:
    return str(uuid.uuid4())

def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def get_current_employee(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Employee access required")
    return user

def strip_id(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc

# ---------- Models ----------
# ---------- Small safety helpers ----------
import re as _re
from collections import defaultdict, deque

_rate_buckets: dict = defaultdict(deque)

def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def rate_limit(request: Request, bucket: str, limit: int, window_s: int) -> None:
    """Very small in-memory limiter (per server process). Good enough to stop casual spam/brute force."""
    key = f"{bucket}:{client_ip(request)}"
    now = datetime.now(timezone.utc).timestamp()
    q = _rate_buckets[key]
    while q and now - q[0] > window_s:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment and try again.")
    q.append(now)

def add_activity(kind: str, text: str, by: str = "system") -> dict:
    return {"at": utcnow_iso(), "by": by, "type": kind, "text": text}

def valid_iso_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except (ValueError, TypeError):
        return False

def today_ist() -> str:
    return datetime.now(IST).date().isoformat()

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class NearbyPlace(BaseModel):
    label: str
    value: str

class Room(BaseModel):
    name: str                 # e.g. "Living Room"
    length_ft: float = 0      # decimal feet, e.g. 19.58 for 19' 7"
    width_ft: float = 0
    # Optional highlight box on the floor-plan picture, as percentages (0-100) of the picture's width/height.
    x: Optional[float] = Field(None, ge=0, le=100)
    y: Optional[float] = Field(None, ge=0, le=100)
    w: Optional[float] = Field(None, ge=0, le=100)
    h: Optional[float] = Field(None, ge=0, le=100)

class FloorPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    config: str  # e.g. "2 BHK"
    area: str    # e.g. "980 sq.ft"
    price: str   # e.g. "₹1.85 Cr"
    image: str = ""
    # --- optional additions (older records simply don't have these) ---
    image_3d: str = ""            # isometric / 3D floor-plan picture, if the builder supplies one
    carpet_area_sqft: float = 0
    bedrooms: int = 0
    bathrooms: int = 0
    rooms: List[Room] = []
    download_url: str = ""
    area_type: str = ""           # "Carpet Area" / "Built-up Area" / "Super Built-up Area"
    rooms_image: str = "2d"       # which picture the room highlight boxes were drawn on: "2d" or "3d"
    # Approximate 3D view traced from the 2D plan in the visitor's browser (no file is stored)
    auto_3d: bool = False
    auto_3d_threshold: int = Field(100, ge=20, le=235)   # how dark a pixel must be to count as wall
    auto_3d_detail: int = Field(1, ge=0, le=3)           # higher = ignore thinner lines
    auto_3d_height: float = Field(6, ge=2, le=15)        # wall height as % of plan width

class VideoItem(BaseModel):
    url: str
    title: str = ""

class PropertyIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    slug: str
    builder: str
    category: str          # Presidential Properties / Under Construction / Ready to Move
    location: str          # South Mumbai / Thane / Navi Mumbai / Dombivli / Kalyan
    address: str = ""
    starting_price: str    # display string e.g. "₹2.5 Cr onwards"
    price_min: int = 0     # in INR for filtering
    price_max: int = 0
    configuration: str     # e.g. "2, 3 & 4 BHK"
    configurations: List[str] = []  # ["2 BHK", "3 BHK"]
    possession: str        # e.g. "Dec 2026" or "Ready to Move"
    possession_status: str = ""     # "Ready" / "Under Construction" / "New Launch"
    short_description: str = ""
    description: str = ""
    highlights: List[str] = []
    amenities: List[str] = []
    floor_plans: List[FloorPlan] = []
    images: List[str] = []
    cover_image: str = ""
    map_embed: str = ""
    nearby: List[NearbyPlace] = []
    badge: str = ""  # New Launch, Hot Deal, Limited Inventory, Sold Out
    featured: bool = False
    seo_title: str = ""
    seo_description: str = ""
    brochure_url: str = ""
    video_url: str = ""
    video_url_2: str = ""
    # ---- optional additions: every one has a default so existing records keep working ----
    locality: str = ""
    city: str = ""
    property_type: str = ""          # Apartment / Villa / Penthouse / Commercial / Plot ...
    carpet_area: float = 0           # sq.ft (headline carpet area; floor plans may add more)
    built_up_area: float = 0
    possession_date: str = ""        # ISO date YYYY-MM-DD, used for sorting/comparison
    rera_number: str = ""
    videos: List[VideoItem] = []     # extra videos (YouTube or direct .mp4/.webm)
    tour_360_url: str = ""           # equirectangular panorama image OR hosted virtual-tour page
    virtual_tour_url: str = ""       # Matterport / Kuula / etc. page, shown in an iframe
    model_3d_url: str = ""           # .glb / .gltf
    model_3d_poster: str = ""
    latitude: float = 0
    longitude: float = 0
    documents: List[NearbyPlace] = []   # {label, value=url} e.g. price sheet, payment plan

class Property(PropertyIn):
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class InquiryIn(BaseModel):
    inquiry_type: str
    full_name: str
    phone: str
    email: str = ""      # required for enquiries & site visits (checked in submit_inquiry); optional for callbacks
    preferred_date: str = ""
    preferred_time: str = ""
    message: str = ""
    property_id: str = ""
    property_name: str = ""
    location: str = ""   # which service area this lead belongs to; auto-filled from property if blank
    # ---- optional additions (site visits, callbacks, brochure leads) ----
    kind: str = "enquiry"            # enquiry | site_visit | callback | brochure | whatsapp
    source: str = "website"          # where the lead came from, e.g. property_page, contact_page, compare
    visitors: int = 0
    visit_type: str = "site_visit"   # site_visit | home_visit
    home_address: str = ""           # address for Home Visit
    pickup_location: str = ""        # pickup location for Site Visit
    drop_location: str = ""          # drop location for Site Visit
    alternate_date: str = ""
    alternate_time: str = ""

class Inquiry(InquiryIn):
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=utcnow_iso)
    status: str = "new"
    assigned_employee_id: Optional[str] = None
    assigned_employee_name: str = ""
    notes: List[dict] = []
    site_visit_date: str = ""        # confirmed visit (YYYY-MM-DD)
    site_visit_time: str = ""
    follow_up_date: str = ""         # YYYY-MM-DD
    activity: List[dict] = []        # [{at, by, type, text}] timeline

# ---------- CRM models: locations, employees, assignment ----------
class LocationIn(BaseModel):
    name: str

class Location(LocationIn):
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=utcnow_iso)

class EmployeeIn(BaseModel):
    name: str
    email: EmailStr
    phone: str = ""
    locations: List[str] = []
    password: str

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    locations: Optional[List[str]] = None
    active: Optional[bool] = None
    password: Optional[str] = None

class EmployeeOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str = ""
    locations: List[str] = []
    active: bool = True
    role: str = "employee"
    created_at: str = ""

class AssignIn(BaseModel):
    employee_id: Optional[str] = None  # omit/None to unassign

class StatusIn(BaseModel):
    status: str

class ScheduleIn(BaseModel):
    site_visit_date: Optional[str] = None
    site_visit_time: Optional[str] = None
    follow_up_date: Optional[str] = None

class NoteIn(BaseModel):
    text: str

class PushSubscriptionIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    endpoint: str
    keys: dict

class Testimonial(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    role: str = ""
    quote: str
    avatar: str = ""
    rating: int = 5

class FAQ(BaseModel):
    id: str = Field(default_factory=new_id)
    question: str
    answer: str
    order: int = 0

class Settings(BaseModel):
    phone: str = "+91 98765 43210"
    email: str = "contact@eleganthomeadvisors.com"
    whatsapp: str = "919876543210"  # digits with country code, no + or spaces
    address: str = "Elegant Home Advisors, Bandra Kurla Complex, Mumbai, MH 400051, India"
    qr_image: str = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https%3A%2F%2Fwa.me%2F919876543210"
    hero_title: str = "Discover Homes Curated for a Refined Life"
    hero_subtitle: str = "Your Trusted Partner in Finding Premium Homes"
    hero_image: str = "https://images.pexels.com/photos/7031594/pexels-photo-7031594.jpeg"
    facebook: str = ""
    instagram: str = ""
    linkedin: str = ""
    youtube: str = ""

# ---------- Auth ----------
@api.post("/auth/login")
async def login(payload: LoginIn, request: Request):
    rate_limit(request, "login", limit=10, window_s=600)
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("role") == "employee" and not user.get("active", True):
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Contact your admin.")
    token = create_token(user["id"], email)
    return {
        "access_token": token,
        "user": {
            "id": user["id"],
            "email": email,
            "name": user.get("name", "Admin"),
            "role": user.get("role", "admin"),
            "locations": user.get("locations", []),
        },
    }

@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return current

# ---------- Public: Settings, Testimonials, FAQs ----------
@api.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        s = Settings()
        d = s.model_dump()
        d["id"] = "global"
        await db.settings.insert_one(d)
        doc = d
    doc.pop("_id", None)
    return doc

@api.put("/settings")
async def update_settings(payload: Settings, current=Depends(get_current_admin)):
    d = payload.model_dump()
    d["id"] = "global"
    await db.settings.update_one({"id": "global"}, {"$set": d}, upsert=True)
    return d

@api.get("/testimonials", response_model=List[Testimonial])
async def list_testimonials():
    docs = await db.testimonials.find({}, {"_id": 0}).to_list(500)
    return docs

@api.post("/testimonials", response_model=Testimonial)
async def create_testimonial(payload: Testimonial, current=Depends(get_current_admin)):
    doc = payload.model_dump()
    await db.testimonials.insert_one(doc)
    return payload

@api.put("/testimonials/{tid}", response_model=Testimonial)
async def update_testimonial(tid: str, payload: Testimonial, current=Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = tid
    await db.testimonials.update_one({"id": tid}, {"$set": doc}, upsert=True)
    return Testimonial(**doc)

@api.delete("/testimonials/{tid}")
async def delete_testimonial(tid: str, current=Depends(get_current_admin)):
    await db.testimonials.delete_one({"id": tid})
    return {"ok": True}

@api.get("/faqs", response_model=List[FAQ])
async def list_faqs():
    docs = await db.faqs.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return docs

@api.post("/faqs", response_model=FAQ)
async def create_faq(payload: FAQ, current=Depends(get_current_admin)):
    doc = payload.model_dump()
    await db.faqs.insert_one(doc)
    return payload

@api.put("/faqs/{fid}", response_model=FAQ)
async def update_faq(fid: str, payload: FAQ, current=Depends(get_current_admin)):
    doc = payload.model_dump()
    doc["id"] = fid
    await db.faqs.update_one({"id": fid}, {"$set": doc}, upsert=True)
    return FAQ(**doc)

@api.delete("/faqs/{fid}")
async def delete_faq(fid: str, current=Depends(get_current_admin)):
    await db.faqs.delete_one({"id": fid})
    return {"ok": True}

# ---------- Public: Properties ----------
PROPERTY_SORTS = {
    "newest": [("created_at", -1)],
    "price_asc": [("price_min", 1)],
    "price_desc": [("price_min", -1)],
    "area_desc": [("carpet_area", -1)],
    "area_asc": [("carpet_area", 1)],
    "relevance": [("featured", -1), ("created_at", -1)],
}

@api.get("/properties")
async def list_properties(
    response: Response,
    category: Optional[str] = None,
    location: Optional[str] = None,
    locality: Optional[str] = None,
    builder: Optional[str] = None,
    property_type: Optional[str] = None,
    possession_status: Optional[str] = None,
    configuration: Optional[str] = None,
    amenities: Optional[str] = None,          # comma separated; property must have ALL of them
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    min_area: Optional[float] = None,
    max_area: Optional[float] = None,
    q: Optional[str] = Query(None, max_length=100),
    featured: Optional[bool] = None,
    ready: Optional[bool] = None,
    ids: Optional[str] = None,                # comma separated property ids (used by compare / shortlist)
    sort: str = "relevance",
    skip: int = Query(0, ge=0),
    limit: int = Query(60, ge=1, le=200),
):
    query: dict = {}
    ands: list = []
    if category and category != "All":
        query["category"] = category
    if location and location != "All":
        query["location"] = location
    if locality:
        query["locality"] = locality
    if builder and builder != "All":
        query["builder"] = builder
    if property_type:
        query["property_type"] = property_type
    if possession_status and possession_status != "All":
        query["possession_status"] = possession_status
    if ready:
        query["possession_status"] = "Ready to Move"
    if configuration and configuration != "All":
        query["configurations"] = configuration
    if amenities:
        wanted = [a.strip() for a in amenities.split(",") if a.strip()]
        if wanted:
            query["amenities"] = {"$all": wanted}
    if ids:
        id_list = [i.strip() for i in ids.split(",") if i.strip()][:12]
        query["id"] = {"$in": id_list}
    if q:
        rx = {"$regex": _re.escape(q.strip()), "$options": "i"}   # escaped: user text is never a regex
        query["$or"] = [{"name": rx}, {"builder": rx}, {"location": rx}, {"locality": rx}, {"configuration": rx}]
    if featured is not None:
        query["featured"] = featured
    if min_price is not None:
        query["price_min"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price_min", {})["$lte"] = max_price
    if min_area is not None:
        ands.append({"$or": [{"carpet_area": {"$gte": min_area}},
                             {"floor_plans": {"$elemMatch": {"carpet_area_sqft": {"$gte": min_area}}}}]})
    if max_area is not None:
        ands.append({"$or": [{"carpet_area": {"$gt": 0, "$lte": max_area}},
                             {"floor_plans": {"$elemMatch": {"carpet_area_sqft": {"$gt": 0, "$lte": max_area}}}}]})
    if ands:
        query["$and"] = ands

    total = await db.properties.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    sort_spec = PROPERTY_SORTS.get(sort, PROPERTY_SORTS["relevance"])
    docs = await db.properties.find(query, {"_id": 0}).sort(sort_spec).skip(skip).to_list(limit)
    return docs

@api.get("/properties/slug/{slug}")
async def get_property_by_slug(slug: str):
    doc = await db.properties.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Property not found")
    return doc

@api.get("/properties/{pid}")
async def get_property(pid: str):
    doc = await db.properties.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Property not found")
    return doc

@api.post("/properties")
async def create_property(payload: PropertyIn, current=Depends(get_current_admin)):
    doc = Property(**payload.model_dump()).model_dump()
    # ensure unique slug
    existing = await db.properties.find_one({"slug": doc["slug"]})
    if existing:
        doc["slug"] = f"{doc['slug']}-{doc['id'][:6]}"
    await db.properties.insert_one(doc)
    return strip_id(doc)

@api.put("/properties/{pid}")
async def update_property(pid: str, payload: PropertyIn, current=Depends(get_current_admin)):
    existing = await db.properties.find_one({"id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    doc = payload.model_dump()
    doc["id"] = pid
    doc["updated_at"] = utcnow_iso()
    doc["created_at"] = existing.get("created_at", utcnow_iso())
    await db.properties.update_one({"id": pid}, {"$set": doc})
    return doc

@api.delete("/properties/{pid}")
async def delete_property(pid: str, current=Depends(get_current_admin)):
    await db.properties.delete_one({"id": pid})
    return {"ok": True}

async def _distinct_nonempty(field: str) -> list:
    vals = await db.properties.distinct(field)
    return sorted([v for v in vals if v])

@api.get("/meta/filters")
async def filter_meta():
    """Same keys as before, but lists now also include whatever exists in the database."""
    builders = await _distinct_nonempty("builder")
    locations = await _distinct_nonempty("location")
    categories = await _distinct_nonempty("category")
    configs = await _distinct_nonempty("configurations")
    possession = await _distinct_nonempty("possession_status")
    base_cats = ["Presidential Properties", "Under Construction", "Ready to Move"]
    base_cfg = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", "Villa", "Penthouse"]
    base_pos = ["Ready to Move", "Under Construction", "New Launch"]
    base_loc = ["South Mumbai", "Thane", "Navi Mumbai", "Dombivli", "Kalyan"]
    def merge(base, extra):
        return base + [x for x in extra if x not in base]
    return {
        "categories": merge(base_cats, categories),
        "locations": merge(base_loc, locations),
        "possession_statuses": merge(base_pos, possession),
        "configurations": merge(base_cfg, configs),
        "builders": builders,
        "localities": await _distinct_nonempty("locality"),
        "property_types": await _distinct_nonempty("property_type"),
        "amenities": await _distinct_nonempty("amenities"),
    }

@api.get("/meta/overview")
async def meta_overview():
    """Real inventory numbers for the homepage (no hard-coded marketing figures)."""
    total = await db.properties.count_documents({})
    builders = len(await _distinct_nonempty("builder"))
    by_loc = {d["_id"]: d["count"] async for d in db.properties.aggregate(
        [{"$group": {"_id": "$location", "count": {"$sum": 1}}}]) if d["_id"]}
    by_cat = {d["_id"]: d["count"] async for d in db.properties.aggregate(
        [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]) if d["_id"]}
    by_type = {d["_id"]: d["count"] async for d in db.properties.aggregate(
        [{"$group": {"_id": "$property_type", "count": {"$sum": 1}}}]) if d["_id"]}
    ready = await db.properties.count_documents({"possession_status": "Ready to Move"})
    new_launch = await db.properties.count_documents({"$or": [{"possession_status": "New Launch"}, {"badge": "New Launch"}]})
    return {
        "total_properties": total, "builders": builders, "ready_to_move": ready, "new_launch": new_launch,
        "locations": by_loc, "categories": by_cat, "property_types": by_type,
    }

# ---------- Similar properties (data-driven, configurable weights) ----------
def _norm_cfg(values) -> set:
    out = set()
    for v in values or []:
        t = _re.sub(r"\s+", "", str(v).lower())
        if t:
            out.add(t)
    return out

def _areas(p: dict) -> list:
    vals = []
    if p.get("carpet_area"):
        vals.append(float(p["carpet_area"]))
    for fp in p.get("floor_plans") or []:
        a = fp.get("carpet_area_sqft") or 0
        if not a:
            m = _re.search(r"[\d,]+(?:\.\d+)?", str(fp.get("area", "")))
            if m:
                try:
                    a = float(m.group(0).replace(",", ""))
                except ValueError:
                    a = 0
        if a:
            vals.append(float(a))
    return vals

def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)

def similarity_score(base: dict, cand: dict, weights: dict):
    """Returns (score 0-100, reasons). A component is only counted when the base property has data for it,
    so missing fields never drag a candidate down unfairly."""
    parts = []   # (weight, value 0..1)
    reasons = []

    # Location
    if base.get("location"):
        bl, cl = (base.get("locality") or "").strip().lower(), (cand.get("locality") or "").strip().lower()
        if bl and cl and bl == cl:
            val = 1.0; reasons.append("Same locality")
        elif base.get("location") == cand.get("location"):
            val = 0.75 if bl else 1.0; reasons.append(f"Also in {cand.get('location')}")
        elif base.get("city") and base.get("city") == cand.get("city"):
            val = 0.3
        else:
            val = 0.0
        parts.append((weights["location"], val))

    # Price
    bp, cp = base.get("price_min") or 0, cand.get("price_min") or 0
    if bp and cp:
        diff = abs(bp - cp) / max(bp, cp)
        val = max(0.0, 1 - diff / 0.5)
        if val >= 0.6:
            reasons.append("Similar price")
        parts.append((weights["price"], val))

    # Configuration
    bc, cc = _norm_cfg(base.get("configurations")), _norm_cfg(cand.get("configurations"))
    if bc:
        val = _jaccard(bc, cc)
        if val > 0:
            reasons.append("Same configuration" if bc == cc else "Overlapping configurations")
        parts.append((weights["configuration"], val))

    # Carpet area (closest pair of known areas)
    ba, ca = _areas(base), _areas(cand)
    if ba:
        if ca:
            best = min(abs(x - y) / max(x, y) for x in ba for y in ca)
            val = max(0.0, 1 - best / 0.4)
            if val >= 0.6:
                reasons.append("Similar carpet area")
        else:
            val = 0.0
        parts.append((weights["carpet_area"], val))

    # Property type
    if base.get("property_type"):
        val = 1.0 if (base["property_type"].lower() == (cand.get("property_type") or "").lower()) else 0.0
        if val:
            reasons.append(f"Same type ({cand.get('property_type')})")
        parts.append((weights["property_type"], val))

    # Other: builder, possession status, amenities
    other = []
    if base.get("builder"):
        same = 1.0 if base["builder"] == cand.get("builder") else 0.0
        if same:
            reasons.append("Same builder")
        other.append(same)
    if base.get("possession_status"):
        other.append(1.0 if base["possession_status"] == cand.get("possession_status") else 0.0)
    ba_set = {a.lower() for a in base.get("amenities") or []}
    if ba_set:
        other.append(_jaccard(ba_set, {a.lower() for a in cand.get("amenities") or []}))
    if other:
        parts.append((weights["other"], sum(other) / len(other)))

    total_w = sum(w for w, _ in parts)
    if total_w <= 0:
        return 0.0, reasons
    return round(100 * sum(w * v for w, v in parts) / total_w, 1), reasons

async def get_similarity_weights() -> dict:
    weights = dict(DEFAULT_SIMILARITY_WEIGHTS)
    env = os.environ.get("SIMILARITY_WEIGHTS")
    if env:
        try:
            import json as _j
            weights.update({k: float(v) for k, v in _j.loads(env).items() if k in weights})
        except Exception:
            logger.warning("SIMILARITY_WEIGHTS env var is not valid JSON; ignoring")
    doc = await db.config.find_one({"id": "similarity"}, {"_id": 0})
    if doc:
        weights.update({k: float(v) for k, v in (doc.get("weights") or {}).items() if k in weights})
    return weights

@api.get("/properties/{pid}/similar")
async def similar_properties(pid: str, limit: int = Query(4, ge=1, le=12)):
    base = await db.properties.find_one({"id": pid}, {"_id": 0})
    if not base:
        raise HTTPException(status_code=404, detail="Property not found")
    weights = await get_similarity_weights()
    cands = await db.properties.find({"id": {"$ne": pid}}, {"_id": 0}).to_list(2000)
    scored = []
    for c in cands:
        score, reasons = similarity_score(base, c, weights)
        if score > 0:
            scored.append((score, c, reasons))
    scored.sort(key=lambda t: (-t[0], 0 if t[1].get("featured") else 1))
    out = []
    for score, c, reasons in scored[:limit]:
        c = dict(c)
        c["similarity_score"] = score
        c["similarity_reasons"] = reasons[:3]
        out.append(c)
    return out

class SimilarityConfigIn(BaseModel):
    location: float = DEFAULT_SIMILARITY_WEIGHTS["location"]
    price: float = DEFAULT_SIMILARITY_WEIGHTS["price"]
    configuration: float = DEFAULT_SIMILARITY_WEIGHTS["configuration"]
    carpet_area: float = DEFAULT_SIMILARITY_WEIGHTS["carpet_area"]
    property_type: float = DEFAULT_SIMILARITY_WEIGHTS["property_type"]
    other: float = DEFAULT_SIMILARITY_WEIGHTS["other"]

@api.get("/config/similarity")
async def get_similarity_config(current=Depends(get_current_admin)):
    return {"weights": await get_similarity_weights(), "defaults": DEFAULT_SIMILARITY_WEIGHTS}

@api.put("/config/similarity")
async def put_similarity_config(payload: SimilarityConfigIn, current=Depends(get_current_admin)):
    w = payload.model_dump()
    if any(v < 0 for v in w.values()) or sum(w.values()) <= 0:
        raise HTTPException(status_code=400, detail="Weights must be zero or more, and not all zero")
    await db.config.update_one({"id": "similarity"}, {"$set": {"id": "similarity", "weights": w}}, upsert=True)
    return {"weights": w}

def format_inquiry_date(value: str) -> str:
    if not value:
        return "—"

    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%d %b %Y")
    except (ValueError, TypeError):
        return value


def format_inquiry_time(value: str) -> str:
    if not value:
        return "—"

    try:
        return datetime.strptime(value, "%H:%M").strftime("%I:%M %p")
    except (ValueError, TypeError):
        return value


def format_inquiry_datetime(value: str) -> str:
    if not value:
        return "—"

    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        dt = dt.astimezone(IST)

        return dt.strftime("%d %b %Y, %I:%M %p IST")
    except (ValueError, TypeError):
        return value

# ---------- CRM: lead routing ----------
async def resolve_location(payload: InquiryIn) -> str:
    """A lead's location comes straight from the form if given, otherwise from the property it's about."""
    if payload.location:
        return payload.location
    if payload.property_id:
        prop = await db.properties.find_one({"id": payload.property_id}, {"_id": 0, "location": 1})
        if prop:
            return prop.get("location", "")
    return ""

async def find_employee_for_location(location: str) -> Optional[dict]:
    """Pick the employee who owns this location. If more than one owns it, give it to
    whoever currently has the fewest open leads (simple load balancing)."""
    if not location:
        return None
    employees = await db.users.find(
        {"role": "employee", "active": {"$ne": False}, "locations": location},
        {"_id": 0, "password_hash": 0},
    ).to_list(100)
    if not employees:
        return None
    if len(employees) == 1:
        return employees[0]
    open_statuses = ["new", "contacted", "site_visit_scheduled", "negotiation"]
    counts = await asyncio.gather(*[
        db.inquiries.count_documents({"assigned_employee_id": e["id"], "status": {"$in": open_statuses}})
        for e in employees
    ])
    return sorted(zip(employees, counts), key=lambda pair: pair[1])[0][0]

async def notify_employee_push(employee_id: str, title: str, body: str, url: str = "/employee") -> None:
    if not (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY):
        return
    subs = await db.push_subscriptions.find({"user_id": employee_id}, {"_id": 0}).to_list(20)
    if not subs:
        return
    import json as _json
    from pywebpush import webpush, WebPushException
    data = _json.dumps({"title": title, "body": body, "url": url})
    for s in subs:
        try:
            await asyncio.to_thread(
                webpush,
                subscription_info=s["subscription"],
                data=data,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIMS_EMAIL},
            )
        except WebPushException as e:
            code = getattr(getattr(e, "response", None), "status_code", None)
            logger.warning(f"Push failed for {employee_id}: {e}")
            if code in (404, 410):
                await db.push_subscriptions.delete_many({"user_id": employee_id, "subscription.endpoint": s["subscription"].get("endpoint")})
        except Exception as e:
            logger.warning(f"Push error for {employee_id}: {e}")

# ---------- Inquiries ----------
def _clean(text: str, max_len: int) -> str:
    return (text or "").strip()[:max_len]

@api.post("/inquiries", response_model=Inquiry)
async def submit_inquiry(payload: InquiryIn, request: Request):
    rate_limit(request, "inquiry", limit=12, window_s=3600)

    # basic validation
    phone_digits = "".join(ch for ch in payload.phone if ch.isdigit())
    if len(phone_digits) < 10 or len(phone_digits) > 15:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number")
    if not payload.full_name.strip():
        raise HTTPException(status_code=400, detail="Please enter your name")
    email = (payload.email or "").strip()
    kind_in = payload.kind if payload.kind in INQUIRY_KINDS else "enquiry"
    if email and not _re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address")
    if not email and kind_in in ("enquiry", "site_visit"):
        raise HTTPException(status_code=422, detail="Please enter your email address")
    if payload.preferred_date and not valid_iso_date(payload.preferred_date):
        raise HTTPException(status_code=400, detail="Please choose a valid date")
    if payload.alternate_date and not valid_iso_date(payload.alternate_date):
        raise HTTPException(status_code=400, detail="Please choose a valid alternate date")

    location = await resolve_location(payload)
    data = payload.model_dump()
    data["location"] = location
    data["full_name"] = _clean(payload.full_name, 120)
    data["phone"] = _clean(payload.phone, 25)
    data["email"] = email[:200]
    data["message"] = _clean(payload.message, 2000)
    data["inquiry_type"] = _clean(payload.inquiry_type, 80) or "General"
    data["preferred_time"] = _clean(payload.preferred_time, 60)
    data["alternate_time"] = _clean(payload.alternate_time, 60)
    data["source"] = _clean(payload.source, 60) or "website"
    data["visitors"] = max(0, min(int(payload.visitors or 0), 50)) if payload.visit_type != "home_visit" else 0
    data["visit_type"] = "home_visit" if payload.visit_type == "home_visit" else "site_visit"
    data["home_address"] = _clean(payload.home_address, 500)
    data["pickup_location"] = _clean(payload.pickup_location, 500)
    data["drop_location"] = _clean(payload.drop_location, 500)
    data["kind"] = payload.kind if payload.kind in INQUIRY_KINDS else "enquiry"
    # Always trust the database over the browser for the property name
    if payload.property_id:
        prop = await db.properties.find_one({"id": payload.property_id}, {"_id": 0, "name": 1})
        if prop:
            data["property_name"] = prop.get("name", data.get("property_name", ""))
    inq = Inquiry(**data)

    visit_label = "Home visit requested" if inq.visit_type == "home_visit" else "Site visit requested"
    labels = {"site_visit": visit_label, "callback": "Callback requested",
              "brochure": "Brochure downloaded", "whatsapp": "WhatsApp enquiry", "enquiry": "Enquiry received"}
    if inq.kind == "site_visit":
        inq.status = "site_visit_requested"
    first = labels.get(inq.kind, "Enquiry received")
    if inq.property_name:
        first += f" for {inq.property_name}"
    if inq.kind == "site_visit" and inq.preferred_date:
        first += f" · preferred {format_inquiry_date(inq.preferred_date)}" + (f", {inq.preferred_time}" if inq.preferred_time else "")
    if inq.kind == "site_visit" and inq.visit_type == "home_visit" and inq.home_address:
        first += f" · Address: {inq.home_address}"
    if inq.kind == "site_visit" and inq.visit_type == "site_visit":
        if inq.pickup_location:
            first += f" · Pickup: {inq.pickup_location}"
        if inq.drop_location:
            first += f" · Drop: {inq.drop_location}"
    inq.activity.append(add_activity("created", first, by=inq.full_name))

    employee = await find_employee_for_location(location)
    if employee:
        inq.assigned_employee_id = employee["id"]
        inq.assigned_employee_name = employee.get("name", "")
        inq.activity.append(add_activity("assigned", f"Auto-assigned to {inq.assigned_employee_name} (location: {location})"))

    await db.inquiries.insert_one(inq.model_dump())
    logger.info(
        f"New {inq.kind} from {inq.full_name} for {inq.property_name or inq.inquiry_type} "
        f"· location={location or 'n/a'} · assigned={inq.assigned_employee_name or 'unassigned'}"
    )
    # Fire-and-forget email notification to admin, and push notification to the employee
    asyncio.create_task(send_lead_email(inq))
    if employee:
        asyncio.create_task(notify_employee_push(
            employee["id"], title=("New site visit request" if inq.kind == "site_visit" else "New lead assigned to you"),
            body=f"{inq.full_name} · {inq.property_name or inq.inquiry_type}",
        ))
    return inq

@api.get("/inquiries/mine", response_model=List[Inquiry])
async def list_my_inquiries(current=Depends(get_current_employee)):
    docs = await db.inquiries.find({"assigned_employee_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

def _can_touch(current: dict, doc: dict) -> bool:
    return current.get("role", "admin") == "admin" or doc.get("assigned_employee_id") == current["id"]

@api.patch("/inquiries/{iid}/assign", response_model=Inquiry)
async def assign_inquiry(iid: str, payload: AssignIn, current=Depends(get_current_admin)):
    doc = await db.inquiries.find_one({"id": iid})
    if not doc:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    employee = None
    update = {"assigned_employee_id": None, "assigned_employee_name": ""}
    event = add_activity("assigned", "Unassigned", by=current.get("name", "Admin"))
    if payload.employee_id:
        employee = await db.users.find_one({"id": payload.employee_id, "role": "employee"}, {"_id": 0, "password_hash": 0})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        update = {"assigned_employee_id": employee["id"], "assigned_employee_name": employee.get("name", "")}
        event = add_activity("assigned", f"Assigned to {employee.get('name', '')}", by=current.get("name", "Admin"))
    await db.inquiries.update_one({"id": iid}, {"$set": update, "$push": {"activity": event}})
    if employee:
        asyncio.create_task(notify_employee_push(
            employee["id"], title="Lead assigned to you",
            body=f"{doc.get('full_name')} · {doc.get('property_name') or doc.get('inquiry_type')}",
        ))
    return await db.inquiries.find_one({"id": iid}, {"_id": 0})

@api.patch("/inquiries/{iid}/status", response_model=Inquiry)
async def update_inquiry_status(iid: str, payload: StatusIn, current=Depends(get_current_user)):
    doc = await db.inquiries.find_one({"id": iid})
    if not doc:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if not _can_touch(current, doc):
        raise HTTPException(status_code=403, detail="This lead isn't assigned to you")
    if payload.status not in INQUIRY_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of {INQUIRY_STATUSES}")
    if doc.get("status") == payload.status:
        return await db.inquiries.find_one({"id": iid}, {"_id": 0})
    label = payload.status.replace("_", " ").capitalize()
    await db.inquiries.update_one({"id": iid}, {
        "$set": {"status": payload.status},
        "$push": {"activity": add_activity("status", f"Status changed to {label}", by=current.get("name", "Admin"))},
    })
    return await db.inquiries.find_one({"id": iid}, {"_id": 0})

@api.patch("/inquiries/{iid}/schedule", response_model=Inquiry)
async def schedule_inquiry(iid: str, payload: ScheduleIn, current=Depends(get_current_user)):
    """Set / clear the confirmed site-visit slot and the next follow-up date."""
    doc = await db.inquiries.find_one({"id": iid})
    if not doc:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if not _can_touch(current, doc):
        raise HTTPException(status_code=403, detail="This lead isn't assigned to you")
    fields = payload.model_dump(exclude_unset=True)
    for key in ("site_visit_date", "follow_up_date"):
        if fields.get(key) and not valid_iso_date(fields[key]):
            raise HTTPException(status_code=400, detail="Dates must look like 2026-10-31")
    if "site_visit_time" in fields:
        fields["site_visit_time"] = _clean(fields["site_visit_time"] or "", 60)
    by = current.get("name", "Admin")
    events, update = [], dict(fields)
    if "site_visit_date" in fields and fields["site_visit_date"] != doc.get("site_visit_date", ""):
        if fields["site_visit_date"]:
            when = format_inquiry_date(fields["site_visit_date"]) + (f", {fields.get('site_visit_time') or doc.get('site_visit_time', '')}".rstrip(", "))
            events.append(add_activity("visit", f"Site visit scheduled for {when}", by=by))
            if doc.get("status") in ("new", "contacted", "site_visit_requested", "follow_up_required"):
                update["status"] = "site_visit_scheduled"
        else:
            events.append(add_activity("visit", "Site visit date cleared", by=by))
    if "follow_up_date" in fields and fields["follow_up_date"] != doc.get("follow_up_date", ""):
        events.append(add_activity("follow_up", f"Follow-up set for {format_inquiry_date(fields['follow_up_date'])}" if fields["follow_up_date"] else "Follow-up cleared", by=by))
    ops: dict = {"$set": update}
    if events:
        ops["$push"] = {"activity": {"$each": events}}
    if update:
        await db.inquiries.update_one({"id": iid}, ops)
    return await db.inquiries.find_one({"id": iid}, {"_id": 0})

@api.post("/inquiries/{iid}/notes", response_model=Inquiry)
async def add_inquiry_note(iid: str, payload: NoteIn, current=Depends(get_current_user)):
    doc = await db.inquiries.find_one({"id": iid})
    if not doc:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if not _can_touch(current, doc):
        raise HTTPException(status_code=403, detail="This lead isn't assigned to you")
    text = _clean(payload.text, 2000)
    if not text:
        raise HTTPException(status_code=400, detail="Note can't be empty")
    by = current.get("name", current.get("email", ""))
    note = {"text": text, "author": by, "created_at": utcnow_iso()}
    await db.inquiries.update_one({"id": iid}, {
        "$push": {"notes": note, "activity": add_activity("note", f"Note: {text[:140]}", by=by)},
    })
    return await db.inquiries.find_one({"id": iid}, {"_id": 0})

# ---------- Site visits & follow-ups dashboard ----------
VISIT_STATUSES = ["site_visit_requested", "site_visit_scheduled", "site_visit_completed", "site_visit_cancelled"]

def _visit_base() -> dict:
    return {"$or": [{"kind": "site_visit"}, {"site_visit_date": {"$nin": ["", None]}}, {"status": {"$in": VISIT_STATUSES}}]}

def _visit_scope_query(scope: str, today: str) -> dict:
    scheduled = ["site_visit_requested", "site_visit_scheduled"]
    if scope == "today":
        return {"site_visit_date": today, "status": {"$nin": ["site_visit_cancelled"]}}
    if scope == "upcoming":
        return {"site_visit_date": {"$gt": today}, "status": {"$in": scheduled}}
    if scope == "pending":
        return {"status": "site_visit_requested", "$or": [{"site_visit_date": ""}, {"site_visit_date": None}, {"site_visit_date": {"$exists": False}}]}
    if scope == "completed":
        return {"status": "site_visit_completed"}
    if scope == "cancelled":
        return {"status": "site_visit_cancelled"}
    if scope == "followups":
        return {"follow_up_date": {"$nin": ["", None]}, "status": {"$in": OPEN_STATUSES}}
    return {}

def _and(*parts: dict) -> dict:
    parts = [p for p in parts if p]
    return {"$and": parts} if parts else {}

async def _visit_owner_filter(current: dict, employee_id: Optional[str]) -> dict:
    if current.get("role", "admin") == "employee":
        return {"assigned_employee_id": current["id"]}
    if employee_id == "unassigned":
        return {"$or": [{"assigned_employee_id": None}, {"assigned_employee_id": {"$exists": False}}]}
    if employee_id:
        return {"assigned_employee_id": employee_id}
    return {}

@api.get("/site-visits", response_model=List[Inquiry])
async def list_site_visits(
    scope: str = "all",
    employee_id: Optional[str] = None,
    property_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    q: Optional[str] = Query(None, max_length=100),
    current=Depends(get_current_user),
):
    today = today_ist()
    extra: dict = {}
    if property_id:
        extra["property_id"] = property_id
    if status:
        extra["status"] = status
    if date_from or date_to:
        rng: dict = {}
        if date_from and valid_iso_date(date_from):
            rng["$gte"] = date_from
        if date_to and valid_iso_date(date_to):
            rng["$lte"] = date_to
        if rng:
            extra["site_visit_date"] = rng
    if q:
        rx = {"$regex": _re.escape(q.strip()), "$options": "i"}
        extra["$or"] = [{"full_name": rx}, {"phone": rx}, {"email": rx}]
    base = {} if scope == "followups" else _visit_base()
    query = _and(base, _visit_scope_query(scope, today), await _visit_owner_filter(current, employee_id), extra)
    sort_key = "follow_up_date" if scope == "followups" else "site_visit_date"
    docs = await db.inquiries.find(query, {"_id": 0}).sort([(sort_key, 1), ("created_at", -1)]).to_list(1000)
    return docs

@api.get("/site-visits/summary")
async def site_visit_summary(employee_id: Optional[str] = None, current=Depends(get_current_user)):
    today = today_ist()
    owner = await _visit_owner_filter(current, employee_id)
    out = {"today_date": today}
    for scope in ("today", "upcoming", "pending", "completed", "cancelled", "followups"):
        base = {} if scope == "followups" else _visit_base()
        out[scope] = await db.inquiries.count_documents(_and(base, _visit_scope_query(scope, today), owner))
    out["overdue_followups"] = await db.inquiries.count_documents(_and(
        {"follow_up_date": {"$nin": ["", None], "$lt": today}, "status": {"$in": OPEN_STATUSES}}, owner))
    return out

# ---------- CRM: locations ----------
@api.get("/locations", response_model=List[Location])
async def list_locations():
    docs = await db.locations.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return docs

@api.post("/locations", response_model=Location)
async def create_location(payload: LocationIn, current=Depends(get_current_admin)):
    if await db.locations.find_one({"name": payload.name}):
        raise HTTPException(status_code=400, detail="That location already exists")
    loc = Location(**payload.model_dump())
    await db.locations.insert_one(loc.model_dump())
    return loc

@api.delete("/locations/{lid}")
async def delete_location(lid: str, current=Depends(get_current_admin)):
    await db.locations.delete_one({"id": lid})
    return {"ok": True}

# ---------- CRM: employees ----------
@api.get("/employees", response_model=List[EmployeeOut])
async def list_employees(current=Depends(get_current_admin)):
    docs = await db.users.find({"role": "employee"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return docs

@api.post("/employees", response_model=EmployeeOut)
async def create_employee(payload: EmployeeIn, current=Depends(get_current_admin)):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    doc = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "phone": payload.phone,
        "locations": payload.locations,
        "role": "employee",
        "active": True,
        "created_at": utcnow_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    return doc

@api.put("/employees/{eid}", response_model=EmployeeOut)
async def update_employee(eid: str, payload: EmployeeUpdate, current=Depends(get_current_admin)):
    if not await db.users.find_one({"id": eid, "role": "employee"}):
        raise HTTPException(status_code=404, detail="Employee not found")
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if k != "password"}
    if payload.password:
        update["password_hash"] = hash_password(payload.password)
    if update:
        await db.users.update_one({"id": eid}, {"$set": update})
    return await db.users.find_one({"id": eid}, {"_id": 0, "password_hash": 0})

@api.delete("/employees/{eid}")
async def delete_employee(eid: str, current=Depends(get_current_admin)):
    await db.inquiries.update_many(
        {"assigned_employee_id": eid},
        {"$set": {"assigned_employee_id": None, "assigned_employee_name": ""}},
    )
    await db.users.delete_one({"id": eid, "role": "employee"})
    return {"ok": True}

# ---------- CRM: insights ----------
@api.get("/insights")
async def get_insights(current=Depends(get_current_admin)):
    total = await db.inquiries.count_documents({})
    by_status = {d["_id"] or "new": d["count"] async for d in db.inquiries.aggregate(
        [{"$group": {"_id": "$status", "count": {"$sum": 1}}}])}
    by_location = {(d["_id"] or "Unassigned"): d["count"] async for d in db.inquiries.aggregate(
        [{"$group": {"_id": "$location", "count": {"$sum": 1}}}])}
    by_employee = {(d["_id"] or "Unknown"): d["count"] async for d in db.inquiries.aggregate(
        [{"$match": {"assigned_employee_id": {"$ne": None}}},
         {"$group": {"_id": "$assigned_employee_name", "count": {"$sum": 1}}}])}
    unassigned = await db.inquiries.count_documents(
        {"$or": [{"assigned_employee_id": None}, {"assigned_employee_id": {"$exists": False}}]})
    closed_won = by_status.get("closed_won", 0)
    conversion_rate = round((closed_won / total) * 100, 1) if total else 0.0
    return {
        "total": total,
        "unassigned": unassigned,
        "by_status": by_status,
        "by_location": by_location,
        "by_employee": by_employee,
        "conversion_rate": conversion_rate,
    }

# ---------- CRM: web push subscriptions ----------
@api.get("/push/public-key")
async def push_public_key():
    return {"public_key": VAPID_PUBLIC_KEY}

@api.post("/push/subscribe")
async def push_subscribe(payload: PushSubscriptionIn, current=Depends(get_current_user)):
    sub = payload.model_dump()
    await db.push_subscriptions.delete_many({"user_id": current["id"], "subscription.endpoint": sub.get("endpoint")})
    await db.push_subscriptions.insert_one({
        "id": new_id(), "user_id": current["id"], "subscription": sub, "created_at": utcnow_iso(),
    })
    return {"ok": True}

@api.post("/push/unsubscribe")
async def push_unsubscribe(payload: dict, current=Depends(get_current_user)):
    await db.push_subscriptions.delete_many({"user_id": current["id"], "subscription.endpoint": payload.get("endpoint")})
    return {"ok": True}


async def send_lead_email(inq: "Inquiry") -> None:
    if not RESEND_API_KEY:
        return
    settings_doc = await db.settings.find_one({"id": "global"}, {"_id": 0}) or {}
    notify_to = os.environ.get("NOTIFY_EMAIL") or settings_doc.get("email")
    if not notify_to:
        return
    whatsapp = settings_doc.get("whatsapp", "")
    wa_link = f"https://wa.me/{whatsapp}" if whatsapp else "#"
    label = {"site_visit": "Site Visit Request", "callback": "Callback Request", "brochure": "Brochure Lead"}.get(inq.kind, "New Lead")
    subject = f"{label} · {inq.full_name} · {inq.property_name or inq.inquiry_type}"
    # customer-supplied text must never be interpreted as HTML in the admin's inbox
    import html as _html
    inq = inq.model_copy(update={k: _html.escape(str(getattr(inq, k) or "")) for k in (
        "full_name", "phone", "email", "inquiry_type", "property_name", "message", "preferred_date", "preferred_time")})
    html = f"""
    <div style="font-family: -apple-system, Segoe UI, sans-serif; background:#FDFBF7; padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0A192F;color:#FFFFFF;padding:24px 28px;">
          <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#C5A880;">New Inquiry Received</div>
          <div style="font-family:Georgia,serif;font-size:26px;margin-top:6px;">Elegant Home Advisors</div>
        </td></tr>
        <tr><td style="padding:24px 28px;color:#0A192F;">
          <p style="margin:0 0 14px;color:#475569;font-size:14px;">You have a new lead — reach out within 30 minutes for best conversion.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#0A192F;">
            <tr><td style="padding:6px 0;color:#94A3B8;">Name</td><td style="padding:6px 0;font-weight:600;text-align:right;">{inq.full_name}</td></tr>
            <tr><td style="padding:6px 0;color:#94A3B8;">Phone</td><td style="padding:6px 0;text-align:right;"><a href="tel:{inq.phone}" style="color:#0A192F;text-decoration:none;font-weight:600;">{inq.phone}</a></td></tr>
            <tr><td style="padding:6px 0;color:#94A3B8;">Email</td><td style="padding:6px 0;text-align:right;"><a href="mailto:{inq.email}" style="color:#0A192F;text-decoration:none;">{inq.email}</a></td></tr>
            <tr><td style="padding:6px 0;color:#94A3B8;">Inquiry Type</td><td style="padding:6px 0;text-align:right;">{inq.inquiry_type}</td></tr>
            <tr><td style="padding:6px 0;color:#94A3B8;">Property</td><td style="padding:6px 0;text-align:right;">{inq.property_name or '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#94A3B8;">Preferred Date</td><td style="padding:6px 0;text-align:right;">{format_inquiry_date(inq.preferred_date)}</td></tr>
            <tr><td style="padding:6px 0;color:#94A3B8;">Preferred Time</td><td style="padding:6px 0;text-align:right;">{format_inquiry_time(inq.preferred_time)}</td></tr>
            {f'<tr><td style="padding:6px 0;color:#94A3B8;">Visit Preference</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#C5A880;">{"Home Visit (At Customer Address)" if inq.visit_type == "home_visit" else "Site Visit"}</td></tr>' if inq.kind == "site_visit" else ''}
            {f'<tr><td style="padding:6px 0;color:#94A3B8;">Home Address</td><td style="padding:6px 0;text-align:right;">{inq.home_address}</td></tr>' if inq.home_address else ''}
            {f'<tr><td style="padding:6px 0;color:#94A3B8;">Pickup Location</td><td style="padding:6px 0;text-align:right;">{inq.pickup_location}</td></tr>' if inq.pickup_location else ''}
            {f'<tr><td style="padding:6px 0;color:#94A3B8;">Drop Location</td><td style="padding:6px 0;text-align:right;">{inq.drop_location}</td></tr>' if inq.drop_location else ''}
            {f'<tr><td style="padding:6px 0;color:#94A3B8;">Number of Visitors</td><td style="padding:6px 0;text-align:right;">{inq.visitors}</td></tr>' if inq.visit_type != "home_visit" and inq.visitors > 0 else ''}
          </table>
          {f'<div style="margin-top:16px;padding:14px 16px;background:#F8FAFC;border-radius:12px;font-size:14px;color:#475569;"><b style="color:#0A192F;">Message:</b><br/>{inq.message}</div>' if inq.message else ''}
          <div style="margin-top:24px;text-align:center;">
            <a href="tel:{inq.phone}" style="display:inline-block;background:#0A192F;color:#FFFFFF;padding:12px 26px;border-radius:9999px;text-decoration:none;font-weight:500;margin:4px;">Call {inq.full_name.split()[0]}</a>
            <a href="{wa_link}" style="display:inline-block;background:#25D366;color:#FFFFFF;padding:12px 26px;border-radius:9999px;text-decoration:none;font-weight:500;margin:4px;">WhatsApp</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#F8FAFC;color:#94A3B8;font-size:11px;text-align:center;">
          Received {format_inquiry_datetime(inq.created_at)} · Manage all inquiries in your admin dashboard.
        </td></tr>
      </table>
    </div>
    """
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": RESEND_FROM,
            "to": [notify_to],
            **({"reply_to": inq.email} if inq.email else {}),
            "subject": subject,
            "html": html,
        })
        logger.info(f"Lead email sent to {notify_to}")
    except Exception as e:
        logger.error(f"Lead email failed: {e}")

@api.get("/inquiries", response_model=List[Inquiry])
async def list_inquiries(current=Depends(get_current_admin)):
    docs = await db.inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs

@api.delete("/inquiries/{iid}")
async def delete_inquiry(iid: str, current=Depends(get_current_admin)):
    await db.inquiries.delete_one({"id": iid})
    return {"ok": True}

@api.get("/inquiries/export.csv")
async def export_inquiries_csv(request: Request, token: Optional[str] = Query(None)):
    # Accepts an Authorization header (preferred) or ?token= (kept so old links keep working). Admin only.
    auth = request.headers.get("Authorization", "")
    raw = auth[7:] if auth.startswith("Bearer ") else token
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(raw, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")
    if user.get("role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    def safe(v):
        # stop spreadsheet formula injection from customer-supplied text
        v = "" if v is None else str(v)
        return "'" + v if v[:1] in ("=", "+", "-", "@") else v

    docs = await db.inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Date", "Inquiry Type", "Full Name", "Phone", "Email",
        "Preferred Date", "Preferred Time", "Message", "Property Name",
        "Location", "Assigned To", "Status"
    ])
    for d in docs:
        writer.writerow([safe(x) for x in [
            d.get("created_at", ""), d.get("inquiry_type", ""), d.get("full_name", ""),
            d.get("phone", ""), d.get("email", ""), d.get("preferred_date", ""),
            d.get("preferred_time", ""), d.get("message", ""), d.get("property_name", ""),
            d.get("location", ""), d.get("assigned_employee_name", ""), d.get("status", ""),
        ]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=elegant-inquiries.csv"},
    )

# ---------- Analytics (privacy-friendly: no IPs, cookies or user agents are stored) ----------
class EventIn(BaseModel):
    type: str
    property_id: str = ""

@api.post("/events", status_code=204)
async def track_event(payload: EventIn, request: Request):
    rate_limit(request, "events", limit=240, window_s=60)
    if payload.type not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail="Unknown event")
    await db.events.insert_one({
        "id": new_id(), "type": payload.type, "property_id": _clean(payload.property_id, 64),
        "at": utcnow_iso(), "day": today_ist(),
    })
    return Response(status_code=204)

async def _top_properties(match: dict, source: str = "events", limit: int = 5) -> list:
    coll = db.events if source == "events" else db.inquiries
    pipeline = [{"$match": {**match, "property_id": {"$nin": ["", None]}}},
                {"$group": {"_id": "$property_id", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}, {"$limit": limit}]
    rows = [r async for r in coll.aggregate(pipeline)]
    names = {p["id"]: p for p in await db.properties.find(
        {"id": {"$in": [r["_id"] for r in rows]}}, {"_id": 0, "id": 1, "name": 1, "slug": 1}).to_list(50)}
    return [{"property_id": r["_id"], "name": names.get(r["_id"], {}).get("name", "(removed property)"),
             "slug": names.get(r["_id"], {}).get("slug", ""), "count": r["count"]} for r in rows]

@api.get("/analytics/summary")
async def analytics_summary(days: int = Query(30, ge=1, le=365), current=Depends(get_current_admin)):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    totals = {t: 0 for t in EVENT_TYPES}
    async for r in db.events.aggregate([{"$match": {"at": {"$gte": since}}},
                                        {"$group": {"_id": "$type", "count": {"$sum": 1}}}]):
        totals[r["_id"]] = r["count"]
    ev = lambda t: {"type": t, "at": {"$gte": since}}
    inq_recent = {"created_at": {"$gte": since}}
    total_leads = await db.inquiries.count_documents(inq_recent)
    won = await db.inquiries.count_documents({**inq_recent, "status": "closed_won"})
    return {
        "days": days,
        "event_totals": totals,
        "top_viewed": await _top_properties(ev("property_view")),
        "top_shortlisted": await _top_properties(ev("property_saved")),
        "top_compared": await _top_properties(ev("property_compared")),
        "top_enquired": await _top_properties(inq_recent, source="inquiries"),
        "top_site_visits": await _top_properties({**inq_recent, "kind": "site_visit"}, source="inquiries"),
        "leads": total_leads, "closed_won": won,
        "conversion_rate": round(100 * won / total_leads, 1) if total_leads else 0.0,
    }

# ---------- SEO: sitemap ----------
@api.get("/sitemap.xml")
async def sitemap():
    base = os.environ.get("SITE_URL", "https://eleganthomeadvisors.in").rstrip("/")
    urls = [(f"{base}/", None), (f"{base}/properties", None), (f"{base}/contact", None), (f"{base}/emi-calculator", None)]
    async for p in db.properties.find({}, {"_id": 0, "slug": 1, "updated_at": 1}):
        if p.get("slug"):
            urls.append((f"{base}/property/{p['slug']}", (p.get("updated_at") or "")[:10] or None))
    body = "".join(f"<url><loc>{u}</loc>" + (f"<lastmod>{m}</lastmod>" if m else "") + "</url>" for u, m in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    return Response(content=xml, media_type="application/xml")

# ---------- Image uploads (admin only, stored in MongoDB so they survive redeploys) ----------
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_UPLOAD_SIDE = 2400

def _process_image(raw: bytes) -> bytes:
    """Validates that the bytes really are an image, fixes rotation, shrinks it, strips metadata, returns WebP."""
    from PIL import Image, ImageOps
    Image.MAX_IMAGE_PIXELS = 50_000_000
    img = Image.open(io.BytesIO(raw))
    if img.format not in ("JPEG", "PNG", "WEBP"):
        raise ValueError("format")
    img = ImageOps.exif_transpose(img)
    img.thumbnail((MAX_UPLOAD_SIDE, MAX_UPLOAD_SIDE))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "transparency" in img.info else "RGB")
    out = io.BytesIO()
    img.save(out, "WEBP", quality=90, method=4)
    return out.getvalue()

@api.post("/uploads")
async def upload_image(file: UploadFile = File(...), current=Depends(get_current_admin)):
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large (maximum 8 MB)")
    try:
        data = await asyncio.to_thread(_process_image, raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG or WebP image")
    uid = uuid.uuid4().hex
    await db.uploads.insert_one({"id": uid, "data": data, "content_type": "image/webp", "size": len(data),
                                 "created_at": datetime.now(timezone.utc).isoformat(), "by": current.get("email", "")})
    return {"id": uid, "path": f"/api/uploads/{uid}.webp", "size": len(data)}

@api.get("/uploads/{name}")
async def get_upload(name: str):
    uid = name.split(".")[0]
    doc = await db.uploads.find_one({"id": uid}, {"_id": 0, "data": 1, "content_type": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(content=bytes(doc["data"]), media_type=doc.get("content_type", "image/webp"),
                    headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"})

# ---------- Share preview (WhatsApp / Facebook link cards) ----------
# The site renders in the browser, so link-preview bots see no property details. Sharing this URL instead gives bots
# a small page with Open Graph tags, and sends real visitors straight on to the property page.
@api.get("/share/{slug}")
async def share_preview(slug: str):
    import html as _html
    base = os.environ.get("SITE_URL", "https://eleganthomeadvisors.in").rstrip("/")
    p = await db.properties.find_one({"slug": slug}, {"_id": 0})
    if not p:
        return Response(content=f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={_html.escape(base, quote=True)}/properties">', media_type="text/html", status_code=404)
    target = f"{base}/property/{p['slug']}"
    price = p.get("price_min") or 0
    price_txt = (f"From ₹{price / 1_00_00_000:.2f} Cr" if price >= 1_00_00_000 else f"From ₹{price / 1_00_000:.1f} L") if price else ""
    where = ", ".join(x for x in [p.get("locality"), p.get("location")] if x)
    bits = [x for x in [p.get("configuration"), where, price_txt] if x]
    title = f"{p.get('name', 'Property')}" + (f" by {p['builder']}" if p.get("builder") else "")
    desc = (p.get("seo_description") or p.get("short_description") or " · ".join(bits))[:200]
    img = p.get("cover_image") or (p.get("images") or [""])[0]
    e = lambda v: _html.escape(str(v or ""), quote=True)
    tags = [("og:type", "website"), ("og:site_name", "Elegant Home Advisors"), ("og:title", title), ("og:description", desc), ("og:url", target)]
    if img:
        tags.append(("og:image", img))
    meta = "".join(f'<meta property="{k}" content="{e(v)}">' for k, v in tags)
    meta += f'<meta name="twitter:card" content="{"summary_large_image" if img else "summary"}"><link rel="canonical" href="{e(target)}">'
    body = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{e(title)}</title>'
            f'<meta name="description" content="{e(desc)}">{meta}'
            f'<meta http-equiv="refresh" content="0;url={e(target)}"></head>'
            f'<body><p><a href="{e(target)}">{e(title)}</a></p></body></html>')
    return Response(content=body, media_type="text/html", headers={"Cache-Control": "public, max-age=300"})

@api.get("/")
async def root():
    return {"message": "Elegant Home Advisors API"}

# ---------- Seed ----------
DEMO_IMAGES = [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3",
    "https://images.unsplash.com/photo-1600585152220-90363fe7e115",
    "https://images.unsplash.com/photo-1600607687644-c7171b42498b",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
    "https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg",
    "https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg",
    "https://images.pexels.com/photos/2029731/pexels-photo-2029731.jpeg",
    "https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg",
]

DEMO_PROPERTIES = [
    {
        "name": "Marine Grand Residences", "slug": "marine-grand-residences",
        "builder": "Lodha Group", "category": "Presidential Properties", "location": "South Mumbai",
        "address": "Marine Drive, Nariman Point, Mumbai",
        "starting_price": "₹8.75 Cr onwards", "price_min": 87500000, "price_max": 250000000,
        "configuration": "3, 4 & 5 BHK", "configurations": ["3 BHK", "4 BHK", "5 BHK"],
        "possession": "Ready to Move", "possession_status": "Ready to Move",
        "short_description": "Sea-facing sky residences with private lift lobbies overlooking the Queen's Necklace.",
        "description": "An architectural landmark on Marine Drive, Marine Grand Residences offers a limited collection of sea-facing sky homes. Each residence is designed with double-height living, imported marble flooring, and floor-to-ceiling glass to frame Mumbai's most iconic coastline.",
        "highlights": ["Private lift lobby per apartment", "Concierge & valet", "Sky infinity pool on 42nd floor", "Wine cellar & cigar lounge"],
        "amenities": ["Infinity Pool", "Spa & Sauna", "Concierge", "Valet Parking", "Private Cinema", "Wine Cellar", "Kids Play Zone", "Gymnasium", "Business Lounge", "24x7 Security"],
        "floor_plans": [
            {"config": "3 BHK", "area": "1,850 sq.ft", "price": "₹8.75 Cr", "image": ""},
            {"config": "4 BHK", "area": "2,640 sq.ft", "price": "₹14.20 Cr", "image": ""},
            {"config": "5 BHK Duplex", "area": "4,120 sq.ft", "price": "₹25.00 Cr", "image": ""},
        ],
        "images": [
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
            "https://images.unsplash.com/photo-1613490493576-7fde63acd811",
            "https://images.pexels.com/photos/7031594/pexels-photo-7031594.jpeg",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
        ],
        "cover_image": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
        "map_embed": "https://www.google.com/maps?q=Marine+Drive+Mumbai&output=embed",
        "nearby": [
            {"label": "Nearest Metro", "value": "Churchgate Metro — 1.2 km"},
            {"label": "Nearest Railway", "value": "Churchgate Station — 1.4 km"},
            {"label": "Schools", "value": "Cathedral & John Connon — 2.1 km"},
            {"label": "Hospitals", "value": "Bombay Hospital — 1.8 km"},
            {"label": "Shopping Mall", "value": "Palladium, Lower Parel — 6 km"},
        ],
        "badge": "Limited Inventory", "featured": True,
    },
    {
        "name": "Hiranandani Meadows Signature", "slug": "hiranandani-meadows-signature",
        "builder": "Hiranandani Developers", "category": "Ready to Move", "location": "Thane",
        "address": "Ghodbunder Road, Thane West",
        "starting_price": "₹2.15 Cr onwards", "price_min": 21500000, "price_max": 65000000,
        "configuration": "2, 3 & 4 BHK", "configurations": ["2 BHK", "3 BHK", "4 BHK"],
        "possession": "Ready to Move", "possession_status": "Ready to Move",
        "short_description": "Landscaped township living with Roman-inspired architecture and 40+ amenities.",
        "description": "A signature enclave within the acclaimed Hiranandani Meadows township, offering ready-to-move homes with sweeping views of Yeoor Hills and Upvan Lake.",
        "highlights": ["Yeoor Hills view", "Clubhouse over 80,000 sq.ft", "Township with schools & hospitals inside"],
        "amenities": ["Swimming Pool", "Clubhouse", "Tennis Court", "Squash", "Yoga Deck", "Jogging Track", "Kids Play Area", "Landscaped Gardens", "Amphitheatre", "24x7 Security"],
        "floor_plans": [
            {"config": "2 BHK", "area": "1,050 sq.ft", "price": "₹2.15 Cr", "image": ""},
            {"config": "3 BHK", "area": "1,540 sq.ft", "price": "₹3.60 Cr", "image": ""},
        ],
        "images": [
            "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
            "https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg",
        ],
        "cover_image": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
        "map_embed": "https://www.google.com/maps?q=Hiranandani+Meadows+Thane&output=embed",
        "nearby": [
            {"label": "Nearest Metro", "value": "Kapurbawdi Metro — 2.6 km"},
            {"label": "Nearest Railway", "value": "Thane Station — 5 km"},
            {"label": "Schools", "value": "Hiranandani Foundation School — inside township"},
            {"label": "Hospitals", "value": "Hiranandani Hospital — 900 m"},
            {"label": "Shopping Mall", "value": "Viviana Mall — 4 km"},
        ],
        "badge": "Hot Deal", "featured": True,
    },
    {
        "name": "Vashi Skyline Heights", "slug": "vashi-skyline-heights",
        "builder": "Godrej Properties", "category": "Under Construction", "location": "Navi Mumbai",
        "address": "Sector 15, Vashi, Navi Mumbai",
        "starting_price": "₹1.65 Cr onwards", "price_min": 16500000, "price_max": 42000000,
        "configuration": "2 & 3 BHK", "configurations": ["2 BHK", "3 BHK"],
        "possession": "Dec 2027", "possession_status": "Under Construction",
        "short_description": "Vertical living with sky decks, curated for young families near the Palm Beach Road.",
        "description": "Vashi Skyline Heights brings resort-style living to the heart of Navi Mumbai, with 3-side open apartments and a 30,000 sq.ft rooftop sky deck.",
        "highlights": ["Rooftop sky deck", "3-side open apartments", "Walk to Vashi Station"],
        "amenities": ["Rooftop Pool", "Sky Lounge", "Co-working Space", "Kids Zone", "Pet Park", "Gym", "Multipurpose Hall", "Landscape Garden"],
        "floor_plans": [
            {"config": "2 BHK", "area": "890 sq.ft", "price": "₹1.65 Cr", "image": ""},
            {"config": "3 BHK", "area": "1,220 sq.ft", "price": "₹2.65 Cr", "image": ""},
        ],
        "images": [
            "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3",
            "https://images.unsplash.com/photo-1600607687644-c7171b42498b",
            "https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg",
        ],
        "cover_image": "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3",
        "map_embed": "https://www.google.com/maps?q=Vashi+Navi+Mumbai&output=embed",
        "nearby": [
            {"label": "Nearest Metro", "value": "Vashi Metro (upcoming) — 700 m"},
            {"label": "Nearest Railway", "value": "Vashi Station — 900 m"},
            {"label": "Schools", "value": "Ryan International — 1.8 km"},
            {"label": "Hospitals", "value": "MGM Hospital — 2.3 km"},
            {"label": "Shopping Mall", "value": "Inorbit Mall — 1.5 km"},
        ],
        "badge": "New Launch", "featured": True,
    },
    {
        "name": "Dombivli Elegant Enclave", "slug": "dombivli-elegant-enclave",
        "builder": "Runwal Group", "category": "Under Construction", "location": "Dombivli",
        "address": "Manpada Road, Dombivli East",
        "starting_price": "₹68 L onwards", "price_min": 6800000, "price_max": 18000000,
        "configuration": "1, 2 & 3 BHK", "configurations": ["1 BHK", "2 BHK", "3 BHK"],
        "possession": "Jun 2026", "possession_status": "Under Construction",
        "short_description": "Value-luxury homes with township amenities, minutes from Dombivli station.",
        "description": "A thoughtfully designed enclave with lush green spaces and a full amenity clubhouse, close to the Dombivli–Kalyan corridor.",
        "highlights": ["Clubhouse with pool", "Vaastu-compliant layouts", "Near proposed Metro"],
        "amenities": ["Swimming Pool", "Gym", "Community Hall", "Kids Play Area", "Jogging Track", "Yoga Zone", "Landscape Garden"],
        "floor_plans": [
            {"config": "1 BHK", "area": "460 sq.ft", "price": "₹68 L", "image": ""},
            {"config": "2 BHK", "area": "720 sq.ft", "price": "₹1.15 Cr", "image": ""},
        ],
        "images": [
            "https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg",
            "https://images.unsplash.com/photo-1600585152220-90363fe7e115",
        ],
        "cover_image": "https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg",
        "map_embed": "https://www.google.com/maps?q=Dombivli+East&output=embed",
        "nearby": [
            {"label": "Nearest Metro", "value": "Proposed Metro Line 12"},
            {"label": "Nearest Railway", "value": "Dombivli Station — 1.5 km"},
            {"label": "Schools", "value": "Model English School — 1 km"},
            {"label": "Hospitals", "value": "AIMS Hospital — 1.7 km"},
            {"label": "Shopping Mall", "value": "Metro Junction Mall — 6 km"},
        ],
        "badge": "New Launch", "featured": False,
    },
    {
        "name": "Kalyan Riviera Estates", "slug": "kalyan-riviera-estates",
        "builder": "Kalpataru Limited", "category": "Ready to Move", "location": "Kalyan",
        "address": "Kolsewadi, Kalyan East",
        "starting_price": "₹85 L onwards", "price_min": 8500000, "price_max": 20000000,
        "configuration": "2 & 3 BHK", "configurations": ["2 BHK", "3 BHK"],
        "possession": "Ready to Move", "possession_status": "Ready to Move",
        "short_description": "Riverside living with promenade views and a private garden podium.",
        "description": "Kalyan Riviera Estates offers ready-to-move homes along a landscaped promenade, with private podium gardens and modern security systems.",
        "highlights": ["Riverside promenade", "Podium gardens", "Ready possession"],
        "amenities": ["Pool", "Gym", "Clubhouse", "Landscape Podium", "24x7 Security", "Kids Play Area"],
        "floor_plans": [
            {"config": "2 BHK", "area": "780 sq.ft", "price": "₹85 L", "image": ""},
            {"config": "3 BHK", "area": "1,180 sq.ft", "price": "₹1.45 Cr", "image": ""},
        ],
        "images": [
            "https://images.pexels.com/photos/2029731/pexels-photo-2029731.jpeg",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
        ],
        "cover_image": "https://images.pexels.com/photos/2029731/pexels-photo-2029731.jpeg",
        "map_embed": "https://www.google.com/maps?q=Kalyan+East&output=embed",
        "nearby": [
            {"label": "Nearest Metro", "value": "Metro Line 12 (upcoming)"},
            {"label": "Nearest Railway", "value": "Kalyan Junction — 3 km"},
            {"label": "Schools", "value": "St. Thomas School — 1.6 km"},
            {"label": "Hospitals", "value": "Fortis Hospital — 4 km"},
            {"label": "Shopping Mall", "value": "Metro Junction Mall — 2 km"},
        ],
        "badge": "", "featured": False,
    },
    {
        "name": "The Bandra Address", "slug": "the-bandra-address",
        "builder": "Oberoi Realty", "category": "Presidential Properties", "location": "South Mumbai",
        "address": "Bandra Reclamation, Mumbai",
        "starting_price": "₹6.20 Cr onwards", "price_min": 62000000, "price_max": 180000000,
        "configuration": "3 & 4 BHK", "configurations": ["3 BHK", "4 BHK"],
        "possession": "Mar 2027", "possession_status": "Under Construction",
        "short_description": "Sea-view boutique tower with a private residents-only clubhouse.",
        "description": "The Bandra Address is a boutique 34-storey tower with only two apartments per floor, delivering unobstructed Bandra-Worli Sea Link views.",
        "highlights": ["Only 2 residences per floor", "Sea Link views", "Boutique tower"],
        "amenities": ["Infinity Pool", "Spa", "Private Cinema", "Wine Cellar", "Concierge", "Valet"],
        "floor_plans": [
            {"config": "3 BHK", "area": "1,740 sq.ft", "price": "₹6.20 Cr", "image": ""},
            {"config": "4 BHK", "area": "2,480 sq.ft", "price": "₹9.90 Cr", "image": ""},
        ],
        "images": [
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
            "https://images.pexels.com/photos/7031594/pexels-photo-7031594.jpeg",
        ],
        "cover_image": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
        "map_embed": "https://www.google.com/maps?q=Bandra+Reclamation+Mumbai&output=embed",
        "nearby": [
            {"label": "Nearest Metro", "value": "Bandra Metro — 1.9 km"},
            {"label": "Nearest Railway", "value": "Bandra Station — 2.5 km"},
            {"label": "Schools", "value": "American School of Bombay — 3 km"},
            {"label": "Hospitals", "value": "Lilavati Hospital — 1.2 km"},
            {"label": "Shopping Mall", "value": "Palladium — 6 km"},
        ],
        "badge": "Hot Deal", "featured": True,
    },
    {
        "name": "Thane Serene Woods", "slug": "thane-serene-woods",
        "builder": "Rustomjee", "category": "Under Construction", "location": "Thane",
        "address": "Majiwada, Thane West",
        "starting_price": "₹1.35 Cr onwards", "price_min": 13500000, "price_max": 32000000,
        "configuration": "2 & 3 BHK", "configurations": ["2 BHK", "3 BHK"],
        "possession": "Aug 2026", "possession_status": "Under Construction",
        "short_description": "Forest-view homes with biophilic design and wellness-first amenities.",
        "description": "Nestled beside Yeoor Hills, Thane Serene Woods delivers homes that connect residents to nature with private balconies and biophilic interiors.",
        "highlights": ["Yeoor Hills view", "Biophilic design", "Wellness clubhouse"],
        "amenities": ["Wellness Spa", "Pool", "Gym", "Meditation Deck", "Cafe", "Kids Zone", "Pet Park"],
        "floor_plans": [
            {"config": "2 BHK", "area": "820 sq.ft", "price": "₹1.35 Cr", "image": ""},
            {"config": "3 BHK", "area": "1,240 sq.ft", "price": "₹2.10 Cr", "image": ""},
        ],
        "images": [
            "https://images.unsplash.com/photo-1613490493576-7fde63acd811",
            "https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg",
        ],
        "cover_image": "https://images.unsplash.com/photo-1613490493576-7fde63acd811",
        "map_embed": "https://www.google.com/maps?q=Majiwada+Thane&output=embed",
        "nearby": [
            {"label": "Nearest Metro", "value": "Majiwada Metro — 500 m"},
            {"label": "Nearest Railway", "value": "Thane Station — 3.4 km"},
            {"label": "Schools", "value": "Singhania School — 2 km"},
            {"label": "Hospitals", "value": "Jupiter Hospital — 1.1 km"},
            {"label": "Shopping Mall", "value": "Viviana Mall — 2.3 km"},
        ],
        "badge": "New Launch", "featured": False,
    },
    {
        "name": "Navi Mumbai Palm Grove", "slug": "navi-mumbai-palm-grove",
        "builder": "L&T Realty", "category": "Ready to Move", "location": "Navi Mumbai",
        "address": "Seawoods, Navi Mumbai",
        "starting_price": "₹2.80 Cr onwards", "price_min": 28000000, "price_max": 75000000,
        "configuration": "3 & 4 BHK", "configurations": ["3 BHK", "4 BHK"],
        "possession": "Ready to Move", "possession_status": "Ready to Move",
        "short_description": "Ready homes with palm-lined driveways near Seawoods Grand Central.",
        "description": "Palm Grove is a low-density gated community with tree-lined boulevards and a clubhouse designed by a Singapore-based studio.",
        "highlights": ["Low density", "Ready to move", "Designer clubhouse"],
        "amenities": ["Pool", "Gym", "Clubhouse", "Tennis", "Basketball", "Amphitheatre"],
        "floor_plans": [
            {"config": "3 BHK", "area": "1,420 sq.ft", "price": "₹2.80 Cr", "image": ""},
            {"config": "4 BHK", "area": "2,180 sq.ft", "price": "₹4.60 Cr", "image": ""},
        ],
        "images": [
            "https://images.unsplash.com/photo-1600585152220-90363fe7e115",
            "https://images.unsplash.com/photo-1600607687644-c7171b42498b",
        ],
        "cover_image": "https://images.unsplash.com/photo-1600585152220-90363fe7e115",
        "map_embed": "https://www.google.com/maps?q=Seawoods+Navi+Mumbai&output=embed",
        "nearby": [
            {"label": "Nearest Metro", "value": "Seawoods Metro — 1.1 km"},
            {"label": "Nearest Railway", "value": "Seawoods Darave — 800 m"},
            {"label": "Schools", "value": "DAV Public School — 1.5 km"},
            {"label": "Hospitals", "value": "Apollo Hospital — 2 km"},
            {"label": "Shopping Mall", "value": "Seawoods Grand Central — 700 m"},
        ],
        "badge": "", "featured": False,
    },
]

DEMO_TESTIMONIALS = [
    {"id": new_id(), "name": "Aarav & Riya Mehta", "role": "Homeowners, Marine Grand", "rating": 5,
     "quote": "Elegant Home Advisors turned our home search into a truly bespoke experience. The team's attention to detail is unmatched.",
     "avatar": "https://images.unsplash.com/photo-1592246030975-b7d803d99e6a"},
    {"id": new_id(), "name": "Kabir Shah", "role": "Investor, Thane", "rating": 5,
     "quote": "Transparent, discreet and always available. They helped us close two premium investments in under a month.",
     "avatar": "https://images.unsplash.com/photo-1585240975735-4826abe53080"},
    {"id": new_id(), "name": "Neha Kapoor", "role": "First-time Buyer, Navi Mumbai", "rating": 5,
     "quote": "From the first call to the handover, every step felt effortless. This is what luxury service should feel like.",
     "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956"},
]

DEMO_FAQS = [
    {"id": new_id(), "order": 1, "question": "How do I schedule a private site visit?",
     "answer": "Submit an inquiry from any property page or tap our WhatsApp button. A relationship manager will confirm your slot within 30 minutes on business hours."},
    {"id": new_id(), "order": 2, "question": "Do you help with home loans?",
     "answer": "Yes. We work with top private and public sector banks to arrange pre-approved home loans at preferential rates."},
    {"id": new_id(), "order": 3, "question": "Are the prices shown final?",
     "answer": "Prices are indicative starting values. Final pricing depends on floor, view, and current inventory — our team shares a detailed cost sheet on request."},
    {"id": new_id(), "order": 4, "question": "Do you assist NRIs?",
     "answer": "Absolutely. We handle NRI documentation, remote virtual tours, POA management and end-to-end handover on your behalf."},
    {"id": new_id(), "order": 5, "question": "Is there a brokerage fee?",
     "answer": "For most primary sales, our services are complimentary to buyers as we are empanelled with leading developers."},
]

async def seed():
    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@elegant.com").lower()
    env_password = os.environ.get("ADMIN_PASSWORD")
    admin_password = env_password or "Elegant@2026"
    if not env_password:
        logger.warning("ADMIN_PASSWORD is not set. Set it in your environment variables; the built-in default is public.")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": utcnow_iso(),
        })
        logger.info(f"Seeded admin: {admin_email}")
    else:
        # keep password in sync with env (only when it is explicitly set, so a restart can never
        # silently put the publicly-known default password back)
        if env_password and not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
            logger.info("Admin password re-synced from env")

    # Settings
    if not await db.settings.find_one({"id": "global"}):
        s = Settings().model_dump()
        s["id"] = "global"
        await db.settings.insert_one(s)

    # Properties
    if await db.properties.count_documents({}) == 0:
        for p in DEMO_PROPERTIES:
            prop = Property(**p).model_dump()
            await db.properties.insert_one(prop)
        logger.info(f"Seeded {len(DEMO_PROPERTIES)} properties")

    # Testimonials
    if await db.testimonials.count_documents({}) == 0:
        await db.testimonials.insert_many(DEMO_TESTIMONIALS)

    # FAQs
    if await db.faqs.count_documents({}) == 0:
        await db.faqs.insert_many(DEMO_FAQS)

    # CRM locations — seed from the property location list the first time
    if await db.locations.count_documents({}) == 0:
        seed_names = sorted({p["location"] for p in DEMO_PROPERTIES if p.get("location")})
        if seed_names:
            await db.locations.insert_many([Location(name=n).model_dump() for n in seed_names])
            logger.info(f"Seeded {len(seed_names)} locations")

# Register router & middleware
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

async def ensure_indexes():
    """Plain (non-unique) indexes: safe on existing data, and they keep list/filter queries fast as inventory grows."""
    specs = [
        (db.properties, [("slug", 1)]), (db.properties, [("id", 1)]), (db.properties, [("location", 1)]),
        (db.properties, [("price_min", 1)]), (db.properties, [("featured", -1), ("created_at", -1)]),
        (db.inquiries, [("id", 1)]), (db.inquiries, [("assigned_employee_id", 1), ("status", 1)]),
        (db.inquiries, [("created_at", -1)]), (db.inquiries, [("site_visit_date", 1)]),
        (db.inquiries, [("follow_up_date", 1)]), (db.inquiries, [("property_id", 1)]),
        (db.events, [("type", 1), ("at", -1)]), (db.events, [("property_id", 1)]),
        (db.users, [("email", 1)]), (db.users, [("id", 1)]),
    ]
    for coll, keys in specs:
        try:
            await coll.create_index(keys)
        except Exception as e:  # never block startup on an index problem
            logger.warning(f"Index {keys} skipped: {e}")

@app.on_event("startup")
async def on_startup():
    await seed()
    await ensure_indexes()

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
