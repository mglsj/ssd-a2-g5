#!/usr/bin/env python3
import argparse
import os
import random
import sys
import time
import uuid
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone

try:
    from pymongo import MongoClient
    from pymongo.collection import Collection
except ImportError:
    print("Error: pymongo not installed. Run: uv sync (in data_generation/)")
    sys.exit(1)

try:
    from faker import Faker
except ImportError:
    print("Error: faker not installed. Run: uv sync (in data_generation/)")
    sys.exit(1)

from postgres_seeder import LOCALITIES, TRIVAGO_LISTINGS, point_near


fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)


USER_POOL_SIZE = 50000
PIN_RADIUS_KM = 0.8
LOCALITY_WEIGHTS = [locality[3] for locality in LOCALITIES]
PLATFORMS = ["iOS", "Android", "Web"]
APP_VERSIONS = ["3.4.1", "3.4.0", "3.3.2", "3.3.1"]
DEVICE_MODELS = [
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

# trivago amenity keys mapped to the catalog's amenity names.
TRIVAGO_AMENITIES = {
    "wifi": "High-Speed WiFi",
    "pool": "Pool",
    "spa": "Spa",
    "parking": "Free Parking",
    "pets": "Pet Friendly",
    "ac": "Air Conditioning",
    "restaurant": "Restaurant",
    "bar": "Bar",
    "gym": "Gym",
    "kitchen": "Kitchen",
    "washer": "Washing Machine",
    "tv": "Smart TV",
    "balcony": "Balcony",
}

# Real trivago listings by title, for their amenities and ratings.
LISTINGS_BY_TITLE = {listing[0]: listing for listing in TRIVAGO_LISTINGS}

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


def insert_in_batches(collection: Collection, docs: Iterable[dict], batch_size: int, label: str) -> int:
    """Insert docs in unordered batches and return how many were written."""
    total, batch = 0, []
    for doc in docs:
        batch.append(doc)
        if len(batch) >= batch_size:
            total += len(collection.insert_many(batch, ordered=False).inserted_ids)
            batch = []
            if total % 100000 == 0:
                print(f"  Inserted {total:,} {label}")
    if batch:
        total += len(collection.insert_many(batch, ordered=False).inserted_ids)
    print(f"Completed: {total:,} {label} inserted")
    return total


def search_session(user_pool: list[str], created_at: datetime) -> dict:
    """One map pin near a weighted Hyderabad locality."""
    _, lat, lon, _ = random.choices(LOCALITIES, weights=LOCALITY_WEIGHTS)[0]
    lat, lon = point_near(lat, lon, PIN_RADIUS_KM)
    min_price = random.choice(MIN_PRICES)
    max_price = random.choice(MAX_PRICES)
    return {
        "session_id": f"sess-{uuid.uuid4().hex[:12]}",
        "user_id": random.choice(user_pool),
        "location": {"type": "Point", "coordinates": [lon, lat]},
        "search_radius_meters": random.choice(SEARCH_RADII),
        "filters": {
            "min_price": min_price,
            "max_price": max(max_price, min_price + 1000),
            "min_rating": random.choice(MIN_RATINGS),
            "required_amenities": random.sample(ALL_AMENITIES, random.randint(1, 5)),
            "check_in_date": (created_at + timedelta(days=random.randint(1, 60))).strftime("%Y-%m-%d"),
            "guests": random.randint(1, 6),
            "instant_book": random.choice([True, False]),
        },
        "device_info": {
            "platform": random.choice(PLATFORMS),
            "app_version": random.choice(APP_VERSIONS),
            "device_model": random.choice(DEVICE_MODELS),
        },
        "created_at": created_at,
    }


def property_amenities(property_id: str, title: str) -> dict:
    """Amenities document for one property. Real listings keep their trivago amenities."""
    listing = LISTINGS_BY_TITLE.get(title)
    if listing:
        _, _, _, star_rating, _, guest_rating, keys = listing
        amenities = [TRIVAGO_AMENITIES[key] for key in keys.split()]
        extras = [a for a in ALL_AMENITIES if a not in amenities]
        amenities += random.sample(extras, random.randint(2, 5))
    else:
        star_rating = guest_rating = None
        amenities = random.sample(ALL_AMENITIES, random.randint(5, 15))

    doc = {
        "property_id": property_id,
        "property_title": title,
        "amenities": amenities,
        "house_rules": random.sample(HOUSE_RULES, random.randint(2, 6))
        + [r.copy() for r in random.sample(HOUSE_RULES_OBJECTS, random.randint(0, 2))],
        "accessibility_features": random.sample(ACCESSIBILITY_FEATURES, random.randint(1, 4))
        + [f.copy() for f in random.sample(ACCESSIBILITY_FEATURES_OBJECTS, random.randint(0, 2))],
        "updated_at": datetime.now(timezone.utc),
    }
    if random.random() < 0.6:
        doc["safety_features"] = random.sample(SAFETY_FEATURES, random.randint(2, 4))
    if random.random() < 0.4:
        doc["host_guidelines"] = {
            "keyless_entry": f"Code: {random.randint(1000, 9999)}",
            "parking": random.choice(
                ["Free parking in the society", "Paid parking - ₹100/day", "No parking available"]
            ),
            "wifi": f"Network: StaySpot-Guest Password: {fake.word()}{random.randint(10, 99)}",
            "host_contact": fake.email(),
            "host_phone": fake.phone_number(),
        }
    if star_rating:
        doc["star_rating"] = star_rating
    if guest_rating:
        doc["guest_rating"] = guest_rating
    return doc


def property_review(booking: dict, now: datetime) -> dict:
    """Review for a COMPLETED booking, written a few days after checkout."""
    rating = random.choices([1, 2, 3, 4, 5], weights=RATING_WEIGHTS)[0]
    tone = "positive" if rating >= 4 else "neutral" if rating == 3 else "negative"
    checkout = booking["created_at"] + timedelta(days=booking["nights"])

    doc = {
        "property_id": booking["property_id"],
        "guest_id": booking["guest_id"],
        "booking_id": booking["id"],
        "rating": rating,
        "location_tags": random.sample(LOCATION_TAGS, random.randint(2, 5)),
        "review_text": random.choice(REVIEW_TEMPLATES[tone]).format(random.choice(REVIEW_PHRASES[tone])),
        "created_at": min(checkout + timedelta(days=random.randint(1, 14), hours=random.randint(0, 23)), now),
    }
    if random.random() < 0.7:
        doc["sub_ratings"] = {
            sub: random.randint(max(1, rating - 1), min(5, rating + 1))
            for sub in REVIEW_SUB_RATINGS
            if random.random() < 0.8
        }
    return doc


def seed_search_sessions(db, count: int, user_pool: list[str], batch_size: int, clear: bool) -> int:
    """Pins spread over the last 115 minutes. The 2-hour TTL index removes them later."""
    collection = db["SearchSessions"]
    if clear:
        collection.delete_many({})
    now = datetime.now(timezone.utc)
    docs = (search_session(user_pool, now - timedelta(minutes=random.randint(1, 115))) for _ in range(count))
    return insert_in_batches(collection, docs, batch_size, "SearchSessions")


def seed_property_amenities(db, properties: list[tuple[str, str]], batch_size: int, clear: bool) -> int:
    collection = db["PropertyAmenities"]
    if clear:
        collection.delete_many({})
    docs = (property_amenities(prop_id, title) for prop_id, title in properties)
    return insert_in_batches(collection, docs, batch_size, "PropertyAmenities")


def seed_property_reviews(db, completed_bookings: list[dict], per_property: int, batch_size: int, clear: bool) -> int:
    """Up to per_property reviews per property, each for a different COMPLETED booking."""
    collection = db["PropertyReviews"]
    if clear:
        collection.delete_many({})
    by_property: dict[str, list[dict]] = {}
    for booking in completed_bookings:
        by_property.setdefault(booking["property_id"], []).append(booking)
    now = datetime.now(timezone.utc)
    docs = (
        property_review(booking, now)
        for bookings in by_property.values()
        for booking in random.sample(bookings, min(per_property, len(bookings)))
    )
    return insert_in_batches(collection, docs, batch_size, "PropertyReviews")


def live_search_sessions(db, user_pool: list[str], rate: float, interval: float = 5.0):
    """Insert new pins with created_at = now until interrupted, about `rate` pins per second."""
    collection = db["SearchSessions"]
    per_tick = max(1, round(rate * interval))
    print(f"Live mode: inserting {per_tick} pins every {interval:g}s. Press Ctrl+C to stop.")
    total = 0
    try:
        while True:
            now = datetime.now(timezone.utc)
            collection.insert_many([search_session(user_pool, now) for _ in range(per_tick)], ordered=False)
            total += per_tick
            print(f"  {now:%H:%M:%S} inserted {per_tick} pins ({total:,} total)")
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\nStopped after {total:,} live pins.")


def load_postgres_refs(pg_uri: str) -> tuple[list[tuple[str, str]], list[str], list[dict]]:
    """Return (properties as (id, title), guest ids, COMPLETED bookings) from PostgreSQL."""
    import psycopg2

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
        return properties, guest_ids, completed_bookings
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="StaySpot MongoDB Seeder")
    parser.add_argument("--uri", default=os.environ.get("MONGO_URI", "mongodb://localhost:27017"), help="MongoDB URI (default: $MONGO_URI)")
    parser.add_argument("--db", default=os.environ.get("MONGO_DB", "stayspot"), help="Database name (default: $MONGO_DB or stayspot)")
    parser.add_argument("--sessions", type=int, default=500000, help="Number of SearchSessions to generate (0 skips them)")
    parser.add_argument("--reviews-per-property", type=int, default=5, help="Maximum reviews per property")
    parser.add_argument("--batch", type=int, default=5000, help="Batch size for bulk inserts")
    parser.add_argument("--no-clear", action="store_true", help="Don't clear existing data")
    parser.add_argument("--pg-uri", default=os.environ.get("PG_URI"), help="PostgreSQL URI (default: $PG_URI). Required for --seed-all")
    parser.add_argument("--seed-all", action="store_true", help="Also seed PropertyAmenities and PropertyReviews from PostgreSQL data")
    parser.add_argument("--live", action="store_true", help="After seeding, keep inserting fresh pins until Ctrl+C")
    parser.add_argument("--live-rate", type=float, default=5.0, help="Pins per second in --live mode")
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
            print(f"Loaded {len(properties):,} properties, {len(guest_ids):,} guests, {len(completed_bookings):,} completed bookings from PostgreSQL")
        except Exception as e:
            if args.seed_all:
                print(f"Error connecting to PostgreSQL: {e}")
                sys.exit(1)
            print(f"PostgreSQL not reachable ({e}). Using random user ids for SearchSessions.")
    elif args.seed_all:
        print("Error: --seed-all needs --pg-uri or $PG_URI. Seed PostgreSQL first.")
        sys.exit(1)

    # Pins come from real guests when PostgreSQL is available.
    user_pool = guest_ids or [str(uuid.uuid4()) for _ in range(USER_POOL_SIZE)]
    clear = not args.no_clear

    with MongoClient(args.uri) as client:
        db = client[args.db]
        if args.sessions > 0:
            seed_search_sessions(db, args.sessions, user_pool, args.batch, clear)
        if args.seed_all:
            seed_property_amenities(db, properties, args.batch, clear)
            seed_property_reviews(db, completed_bookings, args.reviews_per_property, args.batch, clear)
        print("\n[SUCCESS] MongoDB seeding completed!")

        if args.live:
            print()
            live_search_sessions(db, user_pool, args.live_rate)


if __name__ == "__main__":
    main()
