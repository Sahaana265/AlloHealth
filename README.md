Allo Health Inventory Reservation System
This project is a concurrency-safe inventory reservation system built for the Allo Health take-home assignment. The goal of the system is to prevent overselling during checkout while still allowing temporary reservation of inventory for users completing payment flows.
The original implementation was built using MongoDB, but after reviewing the requirements and the transactional nature of inventory systems, I migrated the backend to PostgreSQL with Prisma to achieve stronger consistency guarantees and simpler concurrency control.


Features

Temporary inventory reservations during checkout
Reservation confirmation and release flow
Automatic reservation expiry handling
Race-condition-safe inventory updates
Idempotent API handling using Redis
Live reservation countdown timer
Real-time frontend state refresh using React Query
Warehouse-level stock visibility
Concurrency testing script included


Tech Stack

Frontend
Next.js 15
TypeScript
Tailwind CSS
shadcn/ui
React Query

Backend
Next.js Route Handlers
Prisma ORM
PostgreSQL
Redis (Upstash)



Why PostgreSQL Instead of MongoDB?
Although the original implementation used MongoDB, I decided to migrate the project to PostgreSQL because inventory reservation systems are highly transactional and require strong concurrency guarantees.


Architecture:

Client (Next.js Frontend)
        ↓
API Layer (Next.js Route Handlers)
        ↓
Service Layer
        ↓
Prisma Transaction Layer
        ↓
PostgreSQL
        ↓
      Redis



Concurrency Strategy:

The most important part of this project is preventing overselling under concurrent requests.

Problem
If two users try reserving the last available unit at the same time, both requests may read the same inventory value before either updates it. Without proper locking, both reservations could succeed, resulting in overselling.

Solution
The reservation flow is executed inside a PostgreSQL transaction using pessimistic row-level locking.
When a reservation request is received:
A Prisma interactive transaction is started.
The inventory row is locked using:

SELECT * FROM "Inventory"
WHERE "productId" = $1
FOR UPDATE

PostgreSQL locks that inventory row.
Other concurrent transactions attempting to reserve the same inventory are blocked until the first transaction completes.
The system validates whether enough stock is still available.
If stock exists:
reservedStock is incremented
reservation record is created
The transaction commits atomically.
If another request arrives for the same inventory:
it waits for the lock
re-reads updated inventory values
fails with 409 Conflict if stock is no longer available
This ensures that only one reservation succeeds for the final available unit.



Setup Instructions
1. Create Environment Variables
Create a .env file in the project root:
DATABASE_URL=""
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

CRON_SECRET=""
2. Install Dependencies
npm install
3. Run Prisma Schema
npx prisma db push
Or use migrations:
npx prisma migrate dev
4. Start Development Server
npm run dev
5. Seed Database
curl -X POST http://localhost:3000/api/seed
