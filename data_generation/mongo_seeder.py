#!/usr/bin/env python3
import os
import sys
import time
import uuid
import random
import math
import argparse
from datetime import datetime, timedelta, timezone
from enum import Enum

try:
    from pymongo import MongoClient, InsertOne
    from pymongo.errors import BulkWriteError
except ImportError:
    print("Error: pymongo not installed. Run: pip install pymongo")
    sys.exit(1)

try:
    from faker import Faker
    from pydantic import BaseModel, Field, field_validator, model_validator
except ImportError:
    print("Error: faker or pydantic not installed. Run: pip install faker pydantic")
    sys.exit(1)


fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)


class Platform(str, Enum):
    IOS = "iOS"
    ANDROID = "Android"
    WEB = "Web"


class Hotspot(BaseModel):
    name: str
    lat: float
    lon: float
    weight: float
    radius_km: float


HOTSPOTS = [
    Hotspot(name="HITEC City", lat=17.4435, lon=78.3772, weight=0.15, radius_km=0.8),
    Hotspot(name="Madhapur", lat=17.4483, lon=78.3915, weight=0.13, radius_km=0.8),
    Hotspot(name="Jubilee Hills", lat=17.4326, lon=78.4071, weight=0.11, radius_km=0.9),
    Hotspot(name="Banjara Hills", lat=17.4156, lon=78.4347, weight=0.10, radius_km=0.8),
    Hotspot(name="Raidurg", lat=17.4265, lon=78.3830, weight=0.08, radius_km=0.7),
    Hotspot(name="Durgam Cheruvu", lat=17.4290, lon=78.3890, weight=0.07, radius_km=0.6),
    Hotspot(name="Yousufguda", lat=17.4381, lon=78.4254, weight=0.06, radius_km=0.6),
    Hotspot(name="Film Nagar", lat=17.4150, lon=78.4100, weight=0.05, radius_km=0.7),
    Hotspot(name="Shaikpet", lat=17.4072, lon=78.3960, weight=0.05, radius_km=0.7),
    Hotspot(name="Sri Nagar Colony", lat=17.4295, lon=78.4400, weight=0.06, radius_km=0.5),
    Hotspot(name="Kavuri Hills", lat=17.4450, lon=78.4020, weight=0.09, radius_km=0.5),
    Hotspot(name="Borabanda", lat=17.4500, lon=78.4140, weight=0.05, radius_km=0.6),
]

OUT_OF_RANGE_HOTSPOTS = [
    Hotspot(name="Charminar", lat=17.3616, lon=78.4747, weight=0.03, radius_km=0.8),
    Hotspot(name="Secunderabad", lat=17.4399, lon=78.4983, weight=0.02, radius_km=1.0),
    Hotspot(name="Kukatpally", lat=17.4948, lon=78.3996, weight=0.02, radius_km=0.8),
    Hotspot(name="Rajiv Gandhi International Airport", lat=17.2403, lon=78.4294, weight=0.01, radius_km=1.5),
]

USER_POOL_SIZE = 50000
APP_VERSIONS = ["3.4.1", "3.4.0", "3.3.2", "3.3.1"]
SEARCH_RADII = [500, 1000, 2000, 3000, 5000, 8000, 10000]
MIN_PRICES = [1000, 1500, 2000, 3000, 4000, 5000]
MAX_PRICES = [6000, 8000, 10000, 12000, 15000, 20000, 25000]
MIN_RATINGS = [3.0, 3.5, 4.0, 4.5]


ALL_AMENITIES = [
    "High-Speed WiFi",
    "Dedicated Workspace",
    "Air Conditioning",
    "Kitchen",
    "Free Parking",
    "Pet Friendly",
    "Pool",
    "Gym",
    "Washing Machine",
    "Power Backup",
    "EV Charging",
    "Rooftop Access",
    "Balcony",
    "Lake View",
    "City View",
    "Geyser",
    "RO Water Purifier",
    "Housekeeping",
    "Bicycle Storage",
    "Elevator",
    "Security Guard",
    "CCTV",
    "Smart Lock",
    "Keyless Entry",
    "Coffee Machine",
    "Induction Cooktop",
    "Microwave",
    "Refrigerator",
    "Smart TV",
    "Pooja Room",
]

HOUSE_RULES = [
    "No smoking",
    "No parties",
    "Quiet hours after 10pm",
    "No pets",
    "Check-in after 12pm",
    "Checkout by 11am",
    "Remove shoes at entry",
    "Segregate wet and dry waste",
    "Max 2 guests per bedroom",
    "No outside visitors after 9pm",
    "Lock door when leaving",
    "Keep the AC at 24°C or above",
    "Switch off the geyser after use",
]

HOUSE_RULES_OBJECTS = [
    {
        "rule": "early_checkin",
        "description": "Early check-in available on request - contact host 24h in advance",
    },
    {
        "rule": "late_checkout",
        "description": "Late checkout until 2pm available for a ₹500 fee",
    },
    {
        "rule": "id_verification",
        "description": "Every guest must show a government photo ID at check-in",
    },
    {
        "rule": "parking_instructions",
        "description": "Society parking only - show the guest pass at the gate",
    },
    {
        "rule": "noise_policy",
        "description": "Society rules apply - complaints after 10pm result in a ₹2,000 fine",
    },
]

ACCESSIBILITY_FEATURES = [
    "Step-free entrance",
    "Wide doorways (90+ cm)",
    "Elevator access",
    "Grab bars in bathroom",
    "Roll-in shower",
    "Lowered light switches",
    "Accessible parking spot",
    "Western-style toilet",
    "Braille elevator buttons",
]

ACCESSIBILITY_FEATURES_OBJECTS = [
    {
        "feature": "wheelchair_ramp",
        "description": "Portable wheelchair ramp available at entrance",
    },
    {"feature": "shower_seat", "description": "Fold-down shower seat installed"},
    {
        "feature": "handheld_shower",
        "description": "Handheld shower for seated bathing",
    },
]

SAFETY_FEATURES = [
    "Smoke detector",
    "Fire extinguisher",
    "First aid kit",
    "CCTV at entrance",
    "Lockbox for keys",
    "Exterior lighting",
]

LOCATION_TAGS = [
    "it_corridor",
    "walkable",
    "metro_station",
    "restaurants",
    "nightlife",
    "shopping_mall",
    "lake_view",
    "parks",
    "museums",
    "tourist_attractions",
    "quiet_neighborhood",
    "central_location",
    "street_food",
    "cafes",
    "grocery_stores",
    "fitness_center",
    "hospital_nearby",
    "airport_convenient",
    "rock_formations",
    "gated_community",
    "historic_area",
    "temple_nearby",
]

REVIEW_SUB_RATINGS = [
    "cleanliness",
    "accuracy",
    "communication",
    "location",
    "check_in",
    "value",
]


def generate_amenity_set() -> list[str]:
    num_amenities = random.randint(5, 15)
    return random.sample(ALL_AMENITIES, num_amenities)


class GeoPoint(BaseModel):
    type: str = "Point"
    coordinates: list[float] = Field(..., min_length=2, max_length=2)

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, v: list[float]) -> list[float]:
        if len(v) != 2:
            raise ValueError("Coordinates must be [longitude, latitude]")
        lon, lat = v
        if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
            raise ValueError("Invalid longitude/latitude")
        return [round(lon, 6), round(lat, 6)]


class DeviceInfo(BaseModel):
    platform: Platform
    app_version: str
    device_model: str = Field(
        default_factory=lambda: fake.random_element(
            [
                "iPhone 15 Pro",
                "iPhone 14",
                "Samsung Galaxy S24",
                "Samsung Galaxy M34",
                "OnePlus 12",
                "Redmi Note 13",
                "Realme 12 Pro",
                "Vivo V29",
                "Google Pixel 8",
                "Windows Laptop",
                "Chrome Browser",
            ]
        )
    )


class SearchFilters(BaseModel):
    min_price: int = Field(default_factory=lambda: random.choice(MIN_PRICES))
    max_price: int = Field(default_factory=lambda: random.choice(MAX_PRICES))
    min_rating: float = Field(default_factory=lambda: random.choice(MIN_RATINGS))
    required_amenities: list[str] = Field(default_factory=generate_amenity_set)
    check_in_date: str | None = Field(
        default_factory=lambda: (
            datetime.now() + timedelta(days=random.randint(1, 60))
        ).strftime("%Y-%m-%d")
    )
    guests: int = Field(default_factory=lambda: random.randint(1, 6))
    instant_book: bool = Field(default_factory=lambda: random.choice([True, False]))


class SearchSession(BaseModel):
    session_id: str = Field(default_factory=lambda: f"sess-{uuid.uuid4().hex[:12]}")
    user_id: str
    location: GeoPoint
    search_radius_meters: int = Field(
        default_factory=lambda: random.choice(SEARCH_RADII)
    )
    filters: SearchFilters = Field(default_factory=SearchFilters)
    device_info: DeviceInfo = Field(
        default_factory=lambda: DeviceInfo(
            platform=random.choice(list(Platform)),
            app_version=random.choice(APP_VERSIONS),
        )
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_price_range(self) -> "SearchSession":
        if self.filters.min_price >= self.filters.max_price:
            self.filters.max_price = self.filters.min_price + 1000
        return self

    def to_mongo_dict(self) -> dict[str, object]:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "location": self.location.model_dump(),
            "search_radius_meters": self.search_radius_meters,
            "filters": self.filters.model_dump(),
            "device_info": self.device_info.model_dump(),
            "created_at": self.created_at,
        }


class HouseRule(BaseModel):
    rule: str


class PropertyAmenities(BaseModel):
    property_id: str
    property_title: str | None = None
    amenities: list[str]
    house_rules: list
    accessibility_features: list
    safety_features: list[str] | None = None
    host_guidelines: dict[str, object] | None = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo_dict(self) -> dict[str, object]:
        doc = {
            "property_id": self.property_id,
            "amenities": self.amenities,
            "house_rules": self.house_rules,
            "accessibility_features": self.accessibility_features,
            "updated_at": self.updated_at,
        }
        if self.property_title:
            doc["property_title"] = self.property_title
        if self.safety_features:
            doc["safety_features"] = self.safety_features
        if self.host_guidelines:
            doc["host_guidelines"] = self.host_guidelines
        return doc


class SubRatings(BaseModel):
    cleanliness: int | None = None
    accuracy: int | None = None
    communication: int | None = None
    location: int | None = None
    check_in: int | None = None
    value: int | None = None


class PropertyReview(BaseModel):
    property_id: str
    guest_id: str
    booking_id: str | None = None
    rating: int
    sub_ratings: dict[str, object] | None = None
    location_tags: list[str]
    review_text: str
    created_at: datetime

    def to_mongo_dict(self) -> dict[str, object]:
        doc = {
            "property_id": self.property_id,
            "guest_id": self.guest_id,
            "rating": self.rating,
            "location_tags": self.location_tags,
            "review_text": self.review_text,
            "created_at": self.created_at,
        }
        if self.booking_id:
            doc["booking_id"] = self.booking_id
        if self.sub_ratings:
            doc["sub_ratings"] = self.sub_ratings
        return doc


def generate_user_pool(size: int) -> list[str]:
    return [str(uuid.uuid4()) for _ in range(size)]


def random_point_in_radius(
    center_lat: float, center_lon: float, radius_km: float
) -> tuple:
    angle = random.random() * 2 * math.pi
    r = radius_km * math.sqrt(random.random())
    dlat = (r / 111.32) * math.cos(angle)
    dlon = (r / (111.32 * math.cos(center_lat * math.pi / 180))) * math.sin(angle)
    return round(center_lat + dlat, 6), round(center_lon + dlon, 6)


def generate_session(
    user_pool: list[str], hotspot: Hotspot, created_at: datetime
) -> SearchSession:
    lat, lon = random_point_in_radius(hotspot.lat, hotspot.lon, hotspot.radius_km)
    return SearchSession(
        user_id=random.choice(user_pool),
        location=GeoPoint(coordinates=[lon, lat]),
        created_at=created_at,
    )


def seed_search_sessions(
    uri: str,
    db_name: str,
    target_count: int,
    user_pool: list[str],
    batch_size: int = 5000,
    clear_existing: bool = True,
) -> int:
    client = MongoClient(uri)
    db = client[db_name]
    collection = db["SearchSessions"]

    if clear_existing:
        print(f"Clearing existing SearchSessions...")
        collection.delete_many({})

    collection.create_index(
        [("location", "2dsphere")], name="idx_searchsessions_location_2dsphere"
    )
    collection.create_index(
        [("created_at", 1)],
        name="idx_searchsessions_created_at_ttl_2h",
        expireAfterSeconds=7200,
    )
    collection.create_index(
        [("user_id", 1), ("created_at", -1)], name="idx_searchsessions_user_time"
    )

    print(f"Target: {target_count:,} SearchSessions")
    print(f"Batch size: {batch_size:,}")
    print(
        f"Hotspots: {len(HOTSPOTS)} in-range + {len(OUT_OF_RANGE_HOTSPOTS)} out-of-range"
    )
    print()

    now = datetime.now(timezone.utc)

    all_hotspots = HOTSPOTS + OUT_OF_RANGE_HOTSPOTS
    weights = [h.weight for h in all_hotspots]

    total_inserted = 0
    batch = []

    try:
        for i in range(target_count):
            hotspot = random.choices(all_hotspots, weights=weights, k=1)[0]
            session = generate_session(
                user_pool, hotspot, now - timedelta(minutes=random.randint(1, 115))
            )
            batch.append(InsertOne(session.to_mongo_dict()))

            if len(batch) >= batch_size:
                result = collection.bulk_write(batch, ordered=False)
                total_inserted += result.inserted_count
                batch = []
                if total_inserted % 50000 == 0:
                    print(
                        f"  Inserted: {total_inserted:,} / {target_count:,} ({total_inserted / target_count * 100:.1f}%)"
                    )

        if batch:
            result = collection.bulk_write(batch, ordered=False)
            total_inserted += result.inserted_count

    except BulkWriteError as e:
        print(f"Bulk write error: {e.details}")
        total_inserted += e.details.get("nInserted", 0)

    print(f"\nCompleted: {total_inserted:,} SearchSessions inserted")
    print(f"Collection count: {collection.count_documents({}):,}")

    client.close()
    return total_inserted


def generate_property_amenities(
    property_id: str, property_title: str | None = None
) -> PropertyAmenities:
    house_rules = random.sample(HOUSE_RULES, random.randint(2, 6))
    house_rules += [
        r.copy() for r in random.sample(HOUSE_RULES_OBJECTS, random.randint(0, 2))
    ]

    accessibility_features = random.sample(ACCESSIBILITY_FEATURES, random.randint(1, 4))
    accessibility_features += [
        f.copy()
        for f in random.sample(ACCESSIBILITY_FEATURES_OBJECTS, random.randint(0, 2))
    ]

    safety_features = None
    if random.random() < 0.6:
        num_safety = random.randint(2, 4)
        safety_features = random.sample(SAFETY_FEATURES, num_safety)

    host_guidelines = None
    if random.random() < 0.4:
        host_guidelines = {
            "keyless_entry": f"Code: {random.randint(1000, 9999)}",
            "parking": random.choice(
                ["Free parking in the society", "Paid parking - ₹100/day", "No parking available"]
            ),
            "wifi": f"Network: StaySpot-Guest Password: {fake.word()}{random.randint(10, 99)}",
            "host_contact": fake.email(),
            "host_phone": fake.phone_number(),
        }

    return PropertyAmenities(
        property_id=property_id,
        property_title=property_title,
        amenities=generate_amenity_set(),
        house_rules=house_rules,
        accessibility_features=accessibility_features,
        safety_features=safety_features,
        host_guidelines=host_guidelines,
    )


RATING_WEIGHTS = [5, 7, 15, 33, 40]  # share of 1..5 star reviews, in percent

REVIEW_TEMPLATES = {
    "positive": [
        "Great place to stay! {} Highly recommended.",
        "Beautiful property. {} The host was wonderful.",
        "{} Perfect location. Would definitely book again.",
        "Fantastic experience! {} Everything was clean and comfortable.",
    ],
    "neutral": [
        "Decent stay overall. {} A few things could be better.",
        "The place was fine for a short trip. {}",
    ],
    "negative": [
        "Disappointing stay. {} Would not book again.",
        "The listing did not match the photos. {}",
    ],
}
REVIEW_PHRASES = {
    "positive": ["Loved it!", "Amazing views!", "Very clean!", "Great value!"],
    "neutral": ["Check-in was slow.", "Wifi was patchy.", "A bit noisy at night."],
    "negative": [
        "It was dirty on arrival.",
        "The host never replied.",
        "Too loud to sleep.",
    ],
}


def generate_property_review(booking: dict[str, object], now: datetime) -> PropertyReview:
    """Build a review for a COMPLETED booking, written a few days after checkout."""
    rating = random.choices([1, 2, 3, 4, 5], weights=RATING_WEIGHTS)[0]
    sub_ratings = None
    if random.random() < 0.7:
        sub_ratings = {}
        for sub in REVIEW_SUB_RATINGS:
            if random.random() < 0.8:
                sub_ratings[sub] = random.randint(
                    max(1, rating - 1), min(5, rating + 1)
                )

    tone = "positive" if rating >= 4 else "neutral" if rating == 3 else "negative"
    review_text = random.choice(REVIEW_TEMPLATES[tone]).format(
        random.choice(REVIEW_PHRASES[tone])
    )

    checkout = booking["created_at"] + timedelta(days=booking["nights"])
    created_at = min(
        checkout + timedelta(days=random.randint(1, 14), hours=random.randint(0, 23)),
        now,
    )

    return PropertyReview(
        property_id=booking["property_id"],
        guest_id=booking["guest_id"],
        booking_id=booking["id"],
        rating=rating,
        sub_ratings=sub_ratings,
        location_tags=random.sample(LOCATION_TAGS, random.randint(2, 5)),
        review_text=review_text,
        created_at=created_at,
    )


def seed_property_amenities(
    uri: str,
    db_name: str,
    properties: list[tuple[str, str]],
    batch_size: int = 5000,
    clear_existing: bool = True,
) -> int:
    client = MongoClient(uri)
    db = client[db_name]
    collection = db["PropertyAmenities"]

    if clear_existing:
        print(f"Clearing existing PropertyAmenities...")
        collection.delete_many({})

    print(f"Seeding PropertyAmenities for {len(properties):,} properties...")
    print()

    total_inserted = 0
    batch = []

    try:
        for prop_id, title in properties:
            amenities = generate_property_amenities(prop_id, title)
            batch.append(InsertOne(amenities.to_mongo_dict()))

            if len(batch) >= batch_size:
                result = collection.bulk_write(batch, ordered=False)
                total_inserted += result.inserted_count
                batch = []

        if batch:
            result = collection.bulk_write(batch, ordered=False)
            total_inserted += result.inserted_count

    except BulkWriteError as e:
        print(f"Bulk write error: {e.details}")
        total_inserted += e.details.get("nInserted", 0)

    print(f"Completed: {total_inserted:,} PropertyAmenities inserted")
    print(f"Collection count: {collection.count_documents({}):,}")

    client.close()
    return total_inserted


def seed_property_reviews(
    uri: str,
    db_name: str,
    completed_bookings: list[dict[str, object]],
    reviews_per_property: int = 5,
    batch_size: int = 5000,
    clear_existing: bool = True,
) -> int:
    """Insert up to reviews_per_property reviews per property, each for a different COMPLETED booking."""
    client = MongoClient(uri)
    db = client[db_name]
    collection = db["PropertyReviews"]

    if clear_existing:
        print(f"Clearing existing PropertyReviews...")
        collection.delete_many({})

    by_property: dict[str, list[dict[str, object]]] = {}
    for booking in completed_bookings:
        by_property.setdefault(booking["property_id"], []).append(booking)

    print(
        f"Seeding PropertyReviews: up to {reviews_per_property} per property for {len(by_property):,} properties..."
    )
    print()

    now = datetime.now(timezone.utc)
    total_inserted = 0
    batch = []

    try:
        for bookings in by_property.values():
            for booking in random.sample(
                bookings, min(reviews_per_property, len(bookings))
            ):
                batch.append(
                    InsertOne(generate_property_review(booking, now).to_mongo_dict())
                )

                if len(batch) >= batch_size:
                    result = collection.bulk_write(batch, ordered=False)
                    total_inserted += result.inserted_count
                    batch = []

        if batch:
            result = collection.bulk_write(batch, ordered=False)
            total_inserted += result.inserted_count

    except BulkWriteError as e:
        print(f"Bulk write error: {e.details}")
        total_inserted += e.details.get("nInserted", 0)

    print(f"Completed: {total_inserted:,} PropertyReviews inserted")
    print(f"Collection count: {collection.count_documents({}):,}")

    client.close()
    return total_inserted


def live_search_sessions(
    uri: str, db_name: str, user_pool: list[str], rate: float, interval: float = 5.0
):
    """Insert new pins with created_at = now until interrupted, about `rate` pins per second."""
    client = MongoClient(uri)
    collection = client[db_name]["SearchSessions"]
    all_hotspots = HOTSPOTS + OUT_OF_RANGE_HOTSPOTS
    weights = [h.weight for h in all_hotspots]
    per_tick = max(1, round(rate * interval))

    print(
        f"Live mode: inserting {per_tick} pins every {interval:g}s. Press Ctrl+C to stop."
    )
    total = 0
    try:
        while True:
            now = datetime.now(timezone.utc)
            docs = [
                generate_session(
                    user_pool,
                    random.choices(all_hotspots, weights=weights, k=1)[0],
                    now,
                ).to_mongo_dict()
                for _ in range(per_tick)
            ]
            collection.insert_many(docs, ordered=False)
            total += len(docs)
            print(f"  {now:%H:%M:%S} inserted {len(docs)} pins ({total:,} total)")
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\nStopped after {total:,} live pins.")
    finally:
        client.close()


def load_postgres_refs(
    pg_uri: str,
) -> tuple[list[tuple[str, str]], list[str], list[dict[str, object]]]:
    """Return (properties as (id, title), guest ids, COMPLETED bookings) from PostgreSQL."""
    try:
        import psycopg2
    except ImportError:
        print(
            "Error: psycopg2-binary not installed. Run: uv sync (in data_generation/)"
        )
        sys.exit(1)

    conn = psycopg2.connect(pg_uri)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, title FROM properties ORDER BY id")
            properties = cur.fetchall()
            cur.execute("SELECT id::text FROM guests ORDER BY id")
            guest_ids = [row[0] for row in cur.fetchall()]
            cur.execute(
                "SELECT id::text, guest_id::text, property_id::text, nights, created_at "
                "FROM bookings WHERE status = 'COMPLETED' ORDER BY id"
            )
            columns = ["id", "guest_id", "property_id", "nights", "created_at"]
            completed_bookings = [dict(zip(columns, row)) for row in cur.fetchall()]
    finally:
        conn.close()
    return properties, guest_ids, completed_bookings


def main():
    parser = argparse.ArgumentParser(description="StaySpot MongoDB Seeder")
    parser.add_argument(
        "--uri",
        default=os.environ.get("MONGO_URI", "mongodb://localhost:27017"),
        help="MongoDB URI (default: $MONGO_URI)",
    )
    parser.add_argument(
        "--db",
        default=os.environ.get("MONGO_DB", "stayspot"),
        help="Database name (default: $MONGO_DB or stayspot)",
    )
    parser.add_argument(
        "--sessions",
        type=int,
        default=500000,
        help="Number of SearchSessions to generate (0 skips them)",
    )
    parser.add_argument(
        "--reviews-per-property",
        type=int,
        default=5,
        help="Maximum reviews per property",
    )
    parser.add_argument(
        "--batch", type=int, default=5000, help="Batch size for bulk inserts"
    )
    parser.add_argument(
        "--no-clear",
        default=False,
        action="store_true",
        help="Don't clear existing data",
    )
    parser.add_argument(
        "--pg-uri",
        default=os.environ.get("PG_URI"),
        help="PostgreSQL URI (default: $PG_URI). Required for --seed-all",
    )
    parser.add_argument(
        "--seed-all",
        action="store_true",
        help="Also seed PropertyAmenities and PropertyReviews from PostgreSQL data",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="After seeding, keep inserting fresh pins until Ctrl+C",
    )
    parser.add_argument(
        "--live-rate", type=float, default=5.0, help="Pins per second in --live mode"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("StaySpot MongoDB Seeder")
    print("=" * 60)
    print(f"MongoDB: {args.uri} (database {args.db})")
    print()

    properties, guest_ids, completed_bookings = [], [], []
    if args.pg_uri:
        try:
            properties, guest_ids, completed_bookings = load_postgres_refs(args.pg_uri)
            print(
                f"Loaded {len(properties):,} properties, {len(guest_ids):,} guests, {len(completed_bookings):,} completed bookings from PostgreSQL"
            )
            print()
        except Exception as e:
            if args.seed_all:
                print(f"Error connecting to PostgreSQL: {e}")
                sys.exit(1)
            print(
                f"PostgreSQL not reachable ({e}). Using random user ids for SearchSessions."
            )
    elif args.seed_all:
        print("Error: --seed-all needs --pg-uri or $PG_URI. Seed PostgreSQL first.")
        sys.exit(1)

    # Pins come from real guests when PostgreSQL is available.
    user_pool = guest_ids or generate_user_pool(USER_POOL_SIZE)

    if args.sessions > 0:
        print(f"SearchSessions target: {args.sessions:,} geospatial pings")
        print()
        print("-" * 60)
        seed_search_sessions(
            uri=args.uri,
            db_name=args.db,
            target_count=args.sessions,
            user_pool=user_pool,
            batch_size=args.batch,
            clear_existing=not args.no_clear,
        )

    if args.seed_all:
        print()
        print("=" * 60)
        print("Seeding PropertyAmenities & PropertyReviews")
        print("=" * 60)
        print()

        seed_property_amenities(
            uri=args.uri,
            db_name=args.db,
            properties=properties,
            batch_size=args.batch,
            clear_existing=not args.no_clear,
        )

        print()

        seed_property_reviews(
            uri=args.uri,
            db_name=args.db,
            completed_bookings=completed_bookings,
            reviews_per_property=args.reviews_per_property,
            batch_size=args.batch,
            clear_existing=not args.no_clear,
        )

    print()
    print("[SUCCESS] MongoDB seeding completed!")

    if args.live:
        print()
        live_search_sessions(args.uri, args.db, user_pool, args.live_rate)


if __name__ == "__main__":
    main()
