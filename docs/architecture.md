# Architecture

## 1. Overall
```mermaid
flowchart LR
  Browser[Next.js frontend] -->|GraphQL + JWT| GW[API Gateway]
  GW -->|gRPC| Auth & Product & Cart & Order & Inventory & Notification & Analytics
  GW --- Redis[(Redis)]
  Product --- Redis
  Order -->|gRPC| Product & Inventory & Payment
  Cart -->|gRPC| Product
  Auth & Product & Order & Inventory & Payment & Notification -->|publish| Kafka{{Kafka}}
  Kafka -->|consume| Order & Inventory & Payment & Cart & Notification & Analytics
  Auth --- PG[(PostgreSQL: one DB per service)]
  Order --- PG
```

## 2. Microservices
```mermaid
flowchart TB
  subgraph Edge
    FE[frontend :3000] --> GW[api-gateway :4000]
  end
  subgraph Services
    A[auth :50061] ; P[product :50062] ; C[cart :50054] ; O[order :50053]
    I[inventory :50051] ; Pay[payment :50052] ; N[notification :50055] ; An[analytics :50056]
  end
  GW --> A & P & C & O & I & N & An
  subgraph Infra
    PG[(postgres)] ; R[(redis)] ; K{{kafka KRaft}}
  end
  Services --> PG
  P & GW --> R
  Services --> K
```
Each service owns its database (`auth_db`, `product_db`, ...). Nothing reads another service's tables; services share only IDs, gRPC contracts and Kafka events.

## 3. Kafka event flow
```mermaid
flowchart LR
  Order -- order.created --> K{{Kafka}}
  K --> Payment & Notification & Cart & Analytics
  Payment -- payment.completed / payment.failed --> K
  K --> Order & Inventory
  Inventory -- inventory.reserved / released --> K
  Order -- order.cancelled / order.status_updated --> K
  Notification -- notification.created --> K
  K --> Analytics
```

## 4. gRPC (synchronous)
```mermaid
flowchart LR
  GW[Gateway] --> Auth & Product & Cart & Order & Inventory & Notification & Analytics
  Order -->|GetProduct| Product
  Order -->|ReserveStock / ReleaseStock| Inventory
  Order -->|CreatePayment / GetPaymentStatus| Payment
  Cart -->|GetProduct| Product
```

## 5. Order lifecycle
```mermaid
stateDiagram-v2
  [*] --> PENDING: order saved
  PENDING --> REJECTED: insufficient stock / service down (compensated)
  PENDING --> PAID: payment.completed
  PENDING --> PAYMENT_FAILED: payment.failed (stock released)
  PENDING --> CANCELLED: user cancels
  PAID --> CANCELLED: user cancels (restock + simulated refund)
  PAID --> SHIPPED: admin
  SHIPPED --> DELIVERED: admin
```
Every transition is a conditional update (`WHERE status = ...`), so duplicate or out-of-order events are harmless.

## 6. Database relationships
See [database.md](database.md).

## Sync vs async
- **gRPC** when the caller needs an answer *now* (price a product, reserve stock, create a payment record).
- **Kafka** when something *happened* and other services react in their own time (payment finished, notify the user, record analytics).

## Trade-offs
- No transactional outbox: a DB write followed by a Kafka publish is not atomic. Order creation compensates (releases stock, marks `REJECTED`) if publishing fails.
- Payment processing sleeps inside the consumer handler to simulate latency, which blocks that partition. Fine for a demo.
- Gateway fails open if Redis is down (rate limiting and logout revocation pause, requests keep working).
