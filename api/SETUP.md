# StaySpot API — Setup Guide

This guide explains how to set up and run the StaySpot API locally and test all API endpoints.

## 1. Prerequisites

Install:

* Node.js 18+
* PostgreSQL
* MongoDB
* Git

Make sure PostgreSQL and MongoDB are running.

Check Node.js:

```bash
node --version
npm --version
```

Check PostgreSQL:

```bash
psql --version
```

Check MongoDB:

```bash
mongosh --version
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/mglsj/ssd-a2-g5.git
cd ssd-a2-g5
```

Checkout the required branch if needed:

```bash
git checkout <branch-name>
```

---

## 3. Set Up the Databases

Create the PostgreSQL database:

```bash
psql -U postgres
```

Inside `psql`:

```sql
CREATE DATABASE stayspot;
```

Exit:

```sql
\q
```

Make sure MongoDB is running.

From the repository root, run the database setup script.

### Git Bash / Linux / macOS

```bash
export PG_URI="postgresql://postgres:<PASSWORD>@localhost:5432/stayspot"
export MONGO_URI="mongodb://localhost:27017/stayspot"

bash scripts/setup_db.sh
```

Replace `<PASSWORD>` with the PostgreSQL password.

For example:

```bash
export PG_URI="postgresql://postgres:1989@localhost:5432/stayspot"
export MONGO_URI="mongodb://localhost:27017/stayspot"

bash scripts/setup_db.sh
```

This sets up the PostgreSQL schema, indexes, triggers, stored procedures, functions, materialized views, and MongoDB collections/indexes required by the API.

---

## 4. Go to the API Directory

```bash
cd api
```

---

## 5. Install Node Modules

Install all dependencies:

```bash
npm install
```

This creates the local `node_modules` directory.

You do **not** need to manually install the individual packages.

---

## 6. Create the `.env` File

Inside the `api` directory, create a file named:

```text
.env
```

The final path should be:

```text
api/.env
```

Add:

```env
PG_URI=postgresql://postgres:<PASSWORD>@localhost:5432/stayspot
MONGO_URI=mongodb://localhost:27017/stayspot
PORT=3000
```

Replace `<PASSWORD>` with your local PostgreSQL password.

For example:

```env
PG_URI=postgresql://postgres:1989@localhost:5432/stayspot
MONGO_URI=mongodb://localhost:27017/stayspot
PORT=3000
```

### Important

The `.env` file contains database credentials and must **not** be committed to GitHub.

---

## 7. Start the API

From the `api` directory:

```bash
npm run dev
```

The API should start at:

```text
http://localhost:3000
```

You should see:

```text
API running on http://localhost:3000
```

Keep this terminal running.

---

## 8. Test the API

Open a second terminal.

For PowerShell:

```powershell
$base = "http://localhost:3000/api"
```

### 1. Health

```powershell
Invoke-RestMethod "$base/health" | ConvertTo-Json -Depth 10
```

### 2. Guests

```powershell
Invoke-RestMethod "$base/guests?limit=5" | ConvertTo-Json -Depth 10
```

Get a current guest ID:

```powershell
$guestId = (Invoke-RestMethod "$base/guests?limit=1").items[0].id
```

### 3. Guest Details

```powershell
Invoke-RestMethod "$base/guests/$guestId" | ConvertTo-Json -Depth 10
```

### 4. Top Up Wallet

```powershell
$body = @{
    amount = 1000
} | ConvertTo-Json

Invoke-RestMethod `
    "$base/guests/$guestId/top-up" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body |
    ConvertTo-Json -Depth 10
```

### 5. Guest Audit

```powershell
Invoke-RestMethod `
    "$base/guests/$guestId/audit" |
    ConvertTo-Json -Depth 10
```

### 6. Properties

```powershell
Invoke-RestMethod "$base/properties?limit=5" | ConvertTo-Json -Depth 10
```

Get a current property ID:

```powershell
$propertyId = (Invoke-RestMethod "$base/properties?limit=1").items[0].id
```

### 7. Property Details

```powershell
Invoke-RestMethod "$base/properties/$propertyId" | ConvertTo-Json -Depth 10
```

### 8. Property Amenities

```powershell
Invoke-RestMethod `
    "$base/properties/$propertyId/amenities" |
    ConvertTo-Json -Depth 10
```

### 9. Bookings

```powershell
Invoke-RestMethod "$base/bookings?limit=5" | ConvertTo-Json -Depth 10
```

### 10. Create Booking

```powershell
$body = @{
    guest_id = $guestId
    property_id = $propertyId
    nights = 1
} | ConvertTo-Json

$booking = Invoke-RestMethod `
    "$base/bookings" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

$booking | ConvertTo-Json -Depth 10
```

Get the booking ID:

```powershell
$bookingId = $booking.booking.id
```

### 11. Booking Details

```powershell
Invoke-RestMethod `
    "$base/bookings/$bookingId" |
    ConvertTo-Json -Depth 10
```

### 12. Update Booking Status

```powershell
$body = @{
    status = "CHECKED_IN"
} | ConvertTo-Json

Invoke-RestMethod `
    "$base/bookings/$bookingId/status" `
    -Method PATCH `
    -ContentType "application/json" `
    -Body $body |
    ConvertTo-Json -Depth 10
```

To complete the booking:

```powershell
$body = @{
    status = "COMPLETED"
} | ConvertTo-Json

Invoke-RestMethod `
    "$base/bookings/$bookingId/status" `
    -Method PATCH `
    -ContentType "application/json" `
    -Body $body |
    ConvertTo-Json -Depth 10
```

### 13. Moving Average

```powershell
Invoke-RestMethod `
    "$base/analytics/moving-average?property_id=$propertyId" |
    ConvertTo-Json -Depth 10
```

Specific date range:

```powershell
Invoke-RestMethod `
    "$base/analytics/moving-average?property_id=$propertyId&from=2026-07-01&to=2026-10-08" |
    ConvertTo-Json -Depth 10
```

### 14. Revenue Rank

```powershell
Invoke-RestMethod `
    "$base/analytics/rank" |
    ConvertTo-Json -Depth 10
```

Top 5:

```powershell
Invoke-RestMethod `
    "$base/analytics/rank?limit=5" |
    ConvertTo-Json -Depth 10
```

### 15. Analytics Summary

```powershell
Invoke-RestMethod `
    "$base/analytics/summary" |
    ConvertTo-Json -Depth 10
```

### 16. Refresh Analytics Summary

```powershell
Invoke-RestMethod `
    "$base/analytics/summary/refresh" `
    -Method POST |
    ConvertTo-Json -Depth 10
```

### 17. Hotspots

```powershell
Invoke-RestMethod `
    "$base/hotspots" |
    ConvertTo-Json -Depth 10
```

With radius:

```powershell
Invoke-RestMethod `
    "$base/hotspots?radius=5000" |
    ConvertTo-Json -Depth 10
```

### 18. Hotspot Density

```powershell
Invoke-RestMethod `
    "$base/hotspots/density" |
    ConvertTo-Json -Depth 10
```

### 19. Search Session

```powershell
$body = @{
    lat = 17.4455
    lng = 78.3489
} | ConvertTo-Json

Invoke-RestMethod `
    "$base/search-sessions" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body |
    ConvertTo-Json -Depth 10
```

### 20. Review Analytics

```powershell
Invoke-RestMethod `
    "$base/reviews/analytics" |
    ConvertTo-Json -Depth 10
```

For a specific property:

```powershell
Invoke-RestMethod `
    "$base/reviews/analytics?property_id=$propertyId" |
    ConvertTo-Json -Depth 10
```

### 21. Reviews

```powershell
Invoke-RestMethod `
    "$base/reviews" |
    ConvertTo-Json -Depth 10
```

With pagination:

```powershell
Invoke-RestMethod `
    "$base/reviews?page=1&limit=5" |
    ConvertTo-Json -Depth 10
```

With property:

```powershell
Invoke-RestMethod `
    "$base/reviews?property_id=$propertyId" |
    ConvertTo-Json -Depth 10
```

With rating:

```powershell
Invoke-RestMethod `
    "$base/reviews?rating=5" |
    ConvertTo-Json -Depth 10
```

---

## Troubleshooting

### Port 3000 already in use

Change the port in `.env`:

```env
PORT=3001
```

Then restart the API.

### PostgreSQL connection error

Check that:

* PostgreSQL is running.
* Database `stayspot` exists.
* PostgreSQL username is correct.
* PostgreSQL password is correct.
* `PG_URI` in `.env` is correct.

### MongoDB connection error

Check that MongoDB is running and that `.env` contains:

```env
MONGO_URI=mongodb://localhost:27017/stayspot
```

### `npm install` problems

Delete `node_modules` and reinstall.

PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### IDs do not match

If the database is regenerated, UUIDs may change.

Always get fresh IDs:

```powershell
$guestId = (Invoke-RestMethod "$base/guests?limit=1").items[0].id
$propertyId = (Invoke-RestMethod "$base/properties?limit=1").items[0].id
```

Do not reuse IDs from an older database generation.

---

## Files That Should Not Be Committed

Do not commit:

```text
api/.env
api/node_modules/
```

The `.env` file contains local database credentials, and `node_modules` can be recreated using:

```bash
npm install
```
