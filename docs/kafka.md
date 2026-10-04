# Kafka

KRaft mode (no Zookeeper), single broker. Inside Docker use `kafka:9092`; from your machine use `localhost:29092`.
Topics are created explicitly at startup (3 partitions each) by `ensureTopics` in `packages/kafka-events`. Messages are keyed by `orderId`/`productId`/`userId` so events for one entity stay ordered within a partition.

Envelope (all events): `{ eventId, type, occurredAt, source, payload }`. `eventId` is the idempotency key.

| Topic | Producer | Consumers (group) | Payload |
|---|---|---|---|
| `user.created` | auth | notification, analytics | `{userId, email}` |
| `product.created` / `product.updated` | product | analytics | `{productId, name, price}` |
| `order.created` | order | payment, notification, cart, analytics | `{orderId, userId, items[{productId, quantity, unitPrice}], total}` |
| `order.cancelled` | order | payment, inventory, notification, analytics | `{orderId, userId, reason?}` |
| `order.status_updated` | order | notification, analytics | `{orderId, userId, status}` |
| `payment.created` | payment | analytics | `{paymentId, orderId, amount}` |
| `payment.completed` | payment | order, inventory, analytics | `{paymentId, orderId, userId}` |
| `payment.failed` | payment | order, inventory, notification, analytics | `{paymentId, orderId, userId, reason}` |
| `inventory.reserved` | inventory | analytics | `{orderId, items}` |
| `inventory.released` | inventory | analytics | `{orderId}` |
| `notification.created` | notification | analytics | `{userId, message}` |
| `dead-letter` | any consumer | (inspect manually) | `{topic, group, reason, raw}` |

**Consumer groups:** one per service (`order-service`, `inventory-service`, `payment-service`, `notification-service`, `analytics-service`, `cart-service`), so every service sees every event it subscribes to, and scaling a service out splits partitions between its replicas.

**Reliability**
- Producer is idempotent (`idempotent: true`).
- Consumers retry a failing message 3 times (linear backoff), then park it on `dead-letter` so one bad message cannot block the partition.
- Kafka is at-least-once, so handlers are idempotent: state-guarded conditional updates (order/payment/inventory) or a unique `eventId` column (notification, analytics).

**Example: failed payment**
`payment.failed` -> order becomes `PAYMENT_FAILED`, inventory releases the reservation (`inventory.released`), notification tells the user why.
