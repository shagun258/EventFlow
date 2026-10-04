# GraphQL API (`http://localhost:4000/graphql`)

Send the JWT as `Authorization: Bearer <token>`. Admin operations are enforced in the gateway **and** re-checked by the downstream service.

| Error code | Meaning |
|---|---|
| `UNAUTHENTICATED` | missing / invalid / revoked token |
| `FORBIDDEN` | valid token, wrong role |
| `BAD_USER_INPUT` / `BAD_REQUEST` | validation failed |
| `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED` | business rule errors (e.g. insufficient stock) |
| `TOO_MANY_REQUESTS` | rate limit (login/register: 10/min, others 120/min per IP) |
| `SERVICE_UNAVAILABLE` / `INTERNAL_SERVER_ERROR` | generic message, details are never exposed |

## Public
```graphql
query { categories { id name } }
query { products(search: "keyboard", page: 1, pageSize: 12) { total products { id name price categoryName } } }
query { product(id: "00000000-0000-4000-8000-000000000002") { name description price } }
mutation { register(input: { email: "me@example.com", password: "Secret@123", name: "Me" }) { token user { id role } } }
mutation { login(input: { email: "demo@eventflow.dev", password: "Demo@12345" }) { token user { name role } } }
```

## Signed-in user
```graphql
query { me { id email name role } }
query { cart { items { productId productName quantity lineTotal unavailable } total itemCount } }
mutation { addToCart(input: { productId: "00000000-0000-4000-8000-000000000002", quantity: 1 }) { total } }
mutation { updateCart(input: { productId: "00000000-0000-4000-8000-000000000002", quantity: 3 }) { total } }
mutation { removeFromCart(productId: "00000000-0000-4000-8000-000000000002") { itemCount } }
mutation { createOrder { id orderNumber status total } }          # built from your server-side cart
query { orders { total orders { id orderNumber status total } } }
query { order(id: "...") { status paymentStatus failureReason items { productName quantity unitPrice } } }
mutation { cancelOrder(id: "...", reason: "Changed my mind") { status } }
query { notifications(unreadOnly: true) { unreadCount notifications { id type message orderId } } }
mutation { markNotificationRead(id: "...") { read } }
mutation { logout }                                               # token is revoked in Redis
```

## Admin (`admin@eventflow.dev / Admin@12345`)
```graphql
query { adminProducts { total products { id name price } } }
mutation { createProduct(input: { name: "Webcam", description: "1080p", price: 59.9, categoryId: "00000000-0000-4000-a000-000000000001" }) { id } }
mutation { updateProduct(id: "...", input: { name: "Webcam", description: "4K", price: 89, categoryId: "..." }) { price } }
mutation { deleteProduct(id: "...") }
query { inventory { items { productId quantity reserved available } } }
mutation { updateInventory(input: { productId: "...", quantity: 40 }) { available } }
query { adminOrders(status: "PAID") { total orders { id status total } } }
mutation { updateOrderStatus(id: "...", status: "SHIPPED") { status } }   # PAID -> SHIPPED -> DELIVERED
query { analytics { totalEvents ordersCreated paymentsFailed revenue byTopic { topic count } } }
query { events(topic: "order.created", pageSize: 10) { total events { eventId source occurredAt payloadJson } } }
```
