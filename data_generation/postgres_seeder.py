#!/usr/bin/env python3
import argparse
import math
import os
import random
import sys
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from decimal import Decimal

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Error: psycopg2-binary not installed. Run: uv sync (in data_generation/)")
    sys.exit(1)

try:
    from faker import Faker
except ImportError:
    print("Error: faker not installed. Run: uv sync (in data_generation/)")
    sys.exit(1)

from data import TRIVAGO_LISTINGS

fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)


GUEST_COUNT = 10000
PROPERTY_COUNT = 1000
BOOKING_COUNT = 50000
AUDIT_LOG_COUNT = 100000
BATCH_SIZE = 5000
WORKERS = 4
HISTORY_DAYS = 365
CENT = Decimal("0.01")

LOCALITIES = [
    ("Gachibowli", 17.4455, 78.3489, 0.14),
    ("DLF Cyber City", 17.4495, 78.3570, 0.08),
    ("Financial District", 17.4146, 78.3434, 0.08),
    ("Wipro Circle", 17.4250, 78.3470, 0.05),
    ("Kondapur", 17.4696, 78.3578, 0.08),
    ("Botanical Garden", 17.4590, 78.3560, 0.04),
    ("HITEC City", 17.4435, 78.3772, 0.09),
    ("Madhapur", 17.4483, 78.3915, 0.07),
    ("Raidurg", 17.4265, 78.3830, 0.05),
    ("Manikonda", 17.4050, 78.3860, 0.04),
    ("Kokapet", 17.3960, 78.3280, 0.04),
    ("Narsingi", 17.3880, 78.3560, 0.03),
    ("Tellapur", 17.4620, 78.2940, 0.02),
    ("Hafeezpet", 17.4840, 78.3620, 0.03),
    ("Miyapur", 17.4960, 78.3570, 0.03),
    ("Kukatpally", 17.4948, 78.3996, 0.03),
    ("Jubilee Hills", 17.4326, 78.4071, 0.04),
    ("Banjara Hills", 17.4156, 78.4347, 0.03),
    ("Film Nagar", 17.4150, 78.4100, 0.02),
    ("Ameerpet", 17.4375, 78.4482, 0.06),
    ("Begumpet", 17.4447, 78.4664, 0.06),
    ("Secunderabad", 17.4399, 78.4983, 0.07),
    ("Somajiguda", 17.4239, 78.4577, 0.04),
    ("Abids", 17.3930, 78.4760, 0.04),
    ("Charminar", 17.3616, 78.4747, 0.06),
    ("Mehdipatnam", 17.3960, 78.4380, 0.04),
    ("Tolichowki", 17.3990, 78.4150, 0.04),
    ("Dilsukhnagar", 17.3688, 78.5247, 0.05),
    ("LB Nagar", 17.3457, 78.5522, 0.03),
    ("Uppal", 17.4058, 78.5591, 0.04),
    ("Kompally", 17.5385, 78.4867, 0.03),
    ("Shamshabad", 17.2403, 78.4294, 0.04),
]

PROPERTY_TYPES = [
    "Luxury Villa",
    "Modern Apartment",
    "Heritage Home",
    "Boutique Suite",
    "Lakeview Flat",
    "Cozy Studio",
    "Serviced Apartment",
    "Family Home",
    "Penthouse",
    "Garden Cottage",
    "Tech Park Condo",
    "Rooftop Studio",
]


def money(low: float, high: float) -> Decimal:
    return Decimal(str(random.uniform(low, high))).quantize(CENT)


def point_near(lat: float, lon: float, radius_km: float) -> tuple[float, float]:
    """Random point within radius_km of (lat, lon), uniform over the disc."""
    angle = random.uniform(0, 2 * math.pi)
    r = radius_km * math.sqrt(random.random())
    dlat = r * math.cos(angle) / 111.32
    dlon = r * math.sin(angle) / (111.32 * math.cos(math.radians(lat)))
    return round(lat + dlat, 6), round(lon + dlon, 6)


def generate_properties(count: int) -> list[tuple]:
    """Every trivago listing, then synthetic homes near weighted localities up to count."""
    properties = [
        (str(uuid.uuid4()), name, Decimal(price).quantize(CENT), lat, lon)
        for name, lat, lon, _, price, _, _ in TRIVAGO_LISTINGS
    ]
    real_prices = [listing[4] for listing in TRIVAGO_LISTINGS]
    weights = [locality[3] for locality in LOCALITIES]
    for _ in range(count - len(properties)):
        locality, lat, lon, _ = random.choices(LOCALITIES, weights=weights)[0]
        lat, lon = point_near(lat, lon, 1.2)
        # Price a synthetic home like a random real listing, give or take 20%.
        price = Decimal(str(random.choice(real_prices) * random.uniform(0.8, 1.2))).quantize(CENT)
        title = f"{random.choice(PROPERTY_TYPES)} in {locality}"
        properties.append((str(uuid.uuid4()), title, price, lat, lon))
    return properties


def generate_bookings(
    guest_ids: list[str], properties: list[tuple], count: int, now: datetime
) -> dict[str, list[dict]]:
    """Return bookings grouped by guest, oldest first, with statuses assigned."""
    by_guest = defaultdict(list)
    for _ in range(count):
        prop_id, _, base_price, _, _ = random.choice(properties)
        nights = random.randint(1, 14)
        by_guest[random.choice(guest_ids)].append(
            {
                "id": str(uuid.uuid4()),
                "property_id": prop_id,
                "nights": nights,
                "total_cost": base_price * nights,
                "created_at": now
                - timedelta(seconds=random.randint(0, HISTORY_DAYS * 86400)),
            }
        )

    for bookings in by_guest.values():
        bookings.sort(key=lambda b: b["created_at"])
        for booking in bookings[:-1]:
            booking["status"] = random.choices(
                ["COMPLETED", "CONFIRMED"], weights=[0.9, 0.1]
            )[0]
        # Only the latest booking can be CHECKED_IN.
        bookings[-1]["status"] = random.choices(
            ["CHECKED_IN", "CONFIRMED", "COMPLETED"], weights=[0.4, 0.3, 0.3]
        )[0]
    return by_guest


def build_ledger(
    guest_id: str, bookings: list[dict], now: datetime
) -> tuple[list[tuple], Decimal]:
    """Return (audit rows, final balance) for one guest's bookings."""
    rows = []
    balance = Decimal("0.00")

    def add(action: str, amount: Decimal, at: datetime):
        nonlocal balance
        balance += amount if action == "CREDIT" else -amount
        rows.append((str(uuid.uuid4()), guest_id, amount, action, balance, at))

    first = bookings[0]["created_at"] if bookings else now
    last_time = first - timedelta(days=random.randint(1, 30))
    add("CREDIT", money(15000.0, 250000.0), last_time)

    for booking in bookings:
        cost, booked_at = booking["total_cost"], booking["created_at"]
        if balance < cost:
            gap = max((booked_at - last_time).total_seconds(), 2)
            top_up_at = booked_at - timedelta(
                seconds=random.uniform(1, min(gap - 1, 3 * 86400))
            )
            add("CREDIT", (cost - balance) + money(5000.0, 100000.0), top_up_at)
        add("DEBIT", cost, booked_at)
        last_time = booked_at
    return rows, balance


def add_extra_credits(
    ledgers: dict[str, list[tuple]],
    balances: dict[str, Decimal],
    needed: int,
    now: datetime,
):
    """Append top-ups after each chosen guest's last row, so earlier balance_after values stay correct."""
    guest_ids = list(ledgers)
    for _ in range(needed):
        guest_id = random.choice(guest_ids)
        last_time = ledgers[guest_id][-1][5]
        at = last_time + (now - last_time) * random.random()
        amount = money(1000.0, 40000.0)
        balances[guest_id] += amount
        ledgers[guest_id].append(
            (str(uuid.uuid4()), guest_id, amount, "CREDIT", balances[guest_id], at)
        )


def insert(cursor, table: str, columns: str, rows: list[tuple], batch_size: int):
    execute_values(
        cursor, f"INSERT INTO {table} ({columns}) VALUES %s", rows, page_size=batch_size
    )
    print(f"  -> Inserted {len(rows):,} {table}")


def insert_chunk(uri: str, table: str, columns: str, rows: list[tuple], batch_size: int) -> int:
    """Insert one chunk on its own connection so chunks can load in parallel."""
    conn = psycopg2.connect(uri)
    try:
        with conn, conn.cursor() as cursor:
            execute_values(
                cursor, f"INSERT INTO {table} ({columns}) VALUES %s", rows, page_size=batch_size
            )
    finally:
        conn.close()
    return len(rows)


def insert_parallel(
    uri: str, jobs: list[tuple[str, str, list[tuple]]], batch_size: int, workers: int
):
    """Load several tables at once, each split into chunks of batch_size * 4 rows."""
    chunk_size = batch_size * 4
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {}
        for table, columns, rows in jobs:
            for start in range(0, len(rows), chunk_size):
                chunk = rows[start : start + chunk_size]
                future = pool.submit(insert_chunk, uri, table, columns, chunk, batch_size)
                futures[future] = table
        totals = defaultdict(int)
        for future in as_completed(futures):
            totals[futures[future]] += future.result()
    for table, _, _ in jobs:
        print(f"  -> Inserted {totals[table]:,} {table}")


def main():
    parser = argparse.ArgumentParser(description="StaySpot PostgreSQL Seeder")
    parser.add_argument(
        "--uri",
        default=os.environ.get(
            "PG_URI", "postgresql://postgres:postgres@localhost:5432/stayspot"
        ),
        help="PostgreSQL URI (default: $PG_URI)",
    )
    parser.add_argument(
        "--guests", type=int, default=GUEST_COUNT, help="Number of guests"
    )
    parser.add_argument(
        "--properties", type=int, default=PROPERTY_COUNT, help="Number of properties"
    )
    parser.add_argument(
        "--bookings", type=int, default=BOOKING_COUNT, help="Number of bookings"
    )
    parser.add_argument(
        "--audits",
        type=int,
        default=AUDIT_LOG_COUNT,
        help="Minimum number of audit log entries",
    )
    parser.add_argument("--batch", type=int, default=BATCH_SIZE, help="Batch size")
    parser.add_argument(
        "--workers", type=int, default=WORKERS, help="Parallel insert connections"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("StaySpot PostgreSQL Seeder")
    print("=" * 60)
    print(f"PostgreSQL: {args.uri}")
    print(
        f"Guests: {args.guests:,}  Properties: {args.properties:,}  Bookings: {args.bookings:,}  Audit logs: >= {args.audits:,}"
    )
    print()

    now = datetime.now(timezone.utc)
    guest_ids = [str(uuid.uuid4()) for _ in range(args.guests)]
    properties = generate_properties(args.properties)
    bookings_by_guest = generate_bookings(guest_ids, properties, args.bookings, now)

    ledgers, balances = {}, {}
    for guest_id in guest_ids:
        ledgers[guest_id], balances[guest_id] = build_ledger(
            guest_id, bookings_by_guest.get(guest_id, []), now
        )
    shortfall = args.audits - sum(len(rows) for rows in ledgers.values())
    if shortfall > 0:
        add_extra_credits(ledgers, balances, shortfall, now)

    guests = [(gid, fake.name(), balances[gid]) for gid in guest_ids]
    bookings = [
        (
            b["id"],
            gid,
            b["property_id"],
            b["nights"],
            b["total_cost"],
            b["status"],
            b["created_at"],
        )
        for gid, rows in bookings_by_guest.items()
        for b in rows
    ]
    audits = [row for rows in ledgers.values() for row in rows]

    conn = psycopg2.connect(args.uri)
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "TRUNCATE TABLE wallet_audit_logs, bookings, properties, guests CASCADE"
            )
            insert(cursor, "guests", "id, name, wallet_balance", guests, args.batch)
            insert(
                cursor,
                "properties",
                "id, title, base_price, latitude, longitude",
                properties,
                args.batch,
            )
        # Parents must be committed before the child tables load on other connections.
        conn.commit()

        # Only UPDATE fires the wallet triggers, so the two child tables load independently.
        insert_parallel(
            args.uri,
            [
                (
                    "bookings",
                    "id, guest_id, property_id, nights, total_cost, status, created_at",
                    bookings,
                ),
                (
                    "wallet_audit_logs",
                    "id, guest_id, amount_changed, action_type, balance_after, timestamp",
                    audits,
                ),
            ],
            args.batch,
            args.workers,
        )
        with conn.cursor() as cursor:
            cursor.execute("SELECT refresh_mv_property_summary()")
            print("  -> Refreshed mv_property_summary")
        conn.commit()

        # VACUUM cannot run inside a transaction. It sets the visibility map so
        # the planner can use index-only scans on the new rows.
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute("VACUUM ANALYZE")
        print("  -> VACUUM ANALYZE done")
        print("\nPostgreSQL seeding completed successfully.")
    except Exception as e:
        print(f"\nError: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
