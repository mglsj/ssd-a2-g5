#!/usr/bin/env python3
import argparse
import os
import random
import sys
import uuid
from collections import defaultdict
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


fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)


GUEST_COUNT = 10000
PROPERTY_COUNT = 1000
BOOKING_COUNT = 50000
AUDIT_LOG_COUNT = 100000
BATCH_SIZE = 5000
HISTORY_DAYS = 365
CENT = Decimal("0.01")


HYDERABAD_LOCALITIES = [
    "Jubilee Hills",
    "Banjara Hills",
    "Madhapur",
    "HITEC City",
    "Gachibowli",
    "Kondapur",
    "Kukatpally",
    "Begumpet",
    "Ameerpet",
    "Somajiguda",
    "Punjagutta",
    "Film Nagar",
    "Manikonda",
    "Raidurg",
    "Tolichowki",
    "Mehdipatnam",
    "Khairatabad",
    "Himayatnagar",
    "Sainikpuri",
    "Kokapet",
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


def generate_properties(count: int) -> list[tuple]:
    properties = []
    for _ in range(count):
        title = f"{random.choice(PROPERTY_TYPES)} in {random.choice(HYDERABAD_LOCALITIES)}"
        properties.append(
            (
                str(uuid.uuid4()),
                title,
                money(1500.0, 15000.0),
                round(random.uniform(17.38, 17.50), 6),
                round(random.uniform(78.33, 78.52), 6),
            )
        )
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
            insert(
                cursor,
                "bookings",
                "id, guest_id, property_id, nights, total_cost, status, created_at",
                bookings,
                args.batch,
            )
            insert(
                cursor,
                "wallet_audit_logs",
                "id, guest_id, amount_changed, action_type, balance_after, timestamp",
                audits,
                args.batch,
            )
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
