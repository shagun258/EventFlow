# Database

One PostgreSQL server, **one database per service** (created by `infrastructure/docker/init-databases.sql`). Schemas are Prisma models in `services/<name>/prisma/schema.prisma`, applied on container start with `prisma db push`; seed scripts are idempotent upserts. Cross-service references (userId, productId, orderId) are plain string IDs, deliberately **without** foreign keys across databases.

```mermaid
erDiagram
  USER { uuid id PK  string email UK  string passwordHash  enum role }
  CATEGORY ||--o{ PRODUCT : has
  CATEGORY { uuid id PK  string name UK  string slug UK }
  PRODUCT { uuid id PK  string name  decimal price  uuid categoryId FK }
  CART ||--o{ CART_ITEM : contains
  CART { uuid id PK  string userId UK }
  CART_ITEM { uuid id PK  uuid cartId FK  string productId  int quantity }
  ORDER ||--o{ ORDER_ITEM : contains
  ORDER { uuid id PK  string orderNumber UK  string userId  enum status  decimal total }
  ORDER_ITEM { uuid id PK  uuid orderId FK  string productId  string productName  decimal unitPrice  int quantity }
  PAYMENT { uuid id PK  string orderId UK  string userId  decimal amount  enum status }
  INVENTORY { string productId PK  int quantity  int reserved }
  RESERVATION ||--o{ RESERVATION_ITEM : holds
  RESERVATION { uuid id PK  string orderId UK  enum status }
  RESERVATION_ITEM { uuid id PK  uuid reservationId FK  string productId  int quantity }
  NOTIFICATION { uuid id PK  string eventId UK  string userId  string type  bool read }
  EVENT_LOG { uuid id PK  string eventId UK  string topic  json payload }
```

| Service DB | Tables | Notable constraints / indexes |
|---|---|---|
| auth_db | User | unique email, index role |
| product_db | Category, Product | unique name/slug, FK Product->Category, indexes on categoryId, name |
| cart_db | Cart, CartItem | unique userId, unique (cartId, productId) |
| order_db | Order, OrderItem | unique orderNumber, index (userId, createdAt), index status, cascade delete items |
| inventory_db | Inventory, Reservation, ReservationItem | unique orderId (idempotent reserve), atomic conditional `UPDATE ... WHERE quantity - reserved >= n` |
| payment_db | Payment | unique orderId (one payment per order) |
| notification_db | Notification | unique eventId (dedupe), indexes (userId, createdAt) and (userId, read) |
| analytics_db | EventLog | unique eventId (dedupe), indexes (topic, occurredAt) and entityId |

The spec's `Role` entity is modelled as the `Role` enum (`USER`, `ADMIN`) on `User`. Money is `DECIMAL(10,2)`.

**Seed data:** 2 accounts (`demo@eventflow.dev / Demo@12345`, `admin@eventflow.dev / Admin@12345`), 4 categories, 12 products and stock for each. Product IDs are fixed UUIDs so the inventory seed lines up with the catalogue. No sample orders are seeded: place one in the UI to generate real events.
