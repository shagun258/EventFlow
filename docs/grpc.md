# gRPC

Contracts live in `packages/proto/*.proto` and are loaded at runtime with `@grpc/proto-loader` (no code generation step). Ports are internal to the Docker network.
User identity is always the **JWT in gRPC metadata** (`authorization: Bearer <token>`), verified again by each service that needs it. Request fields are never trusted for identity.

| Service (port) | Method | Request -> Response | Called by |
|---|---|---|---|
| Auth (50061) | Register, Login | `{email, password, name?}` -> `{token, user}` | gateway |
| | ValidateToken, GetUser | `{token}` -> `{valid, userId, email, role}` / `{id}` -> `User` | gateway |
| Product (50062) | ListProducts, GetProduct, ListCategories | `{search, categoryId, page, pageSize}` -> `{products, total}` | gateway, order, cart |
| | Create/Update/DeleteProduct | `ProductInput` -> `Product` (**ADMIN JWT**) | gateway |
| Cart (50054) | GetCart, AddToCart, UpdateCartItem, RemoveFromCart | `{productId, quantity}` -> `Cart` | gateway |
| Order (50053) | CreateOrder, GetOrder, ListOrders, CancelOrder | `{items[{productId, quantity}]}` -> `Order` | gateway |
| | UpdateOrderStatus | `{id, status}` -> `Order` (**ADMIN JWT**) | gateway |
| Inventory (50051) | **CheckStock** | `{items}` -> `{available, unavailableProductIds}` | (available; checkout reserves directly) |
| | **ReserveStock** | `{orderId, items}` -> `{success, message}` (atomic, idempotent per order) | order |
| | **ReleaseStock** | `{orderId}` -> `{success}` | order (compensation) |
| | ListInventory, UpdateInventory | **ADMIN JWT** | gateway |
| Payment (50052) | **CreatePayment** | `{orderId, userId, amount}` -> `{paymentId, status, ...}` (idempotent per order) | order |
| | **GetPaymentStatus** | `{orderId}` -> `{status, failureReason}` | order |
| Notification (50055) | ListNotifications, MarkRead | caller's own only | gateway |
| Analytics (50056) | GetAnalytics, ListEvents | **ADMIN JWT** | gateway |

Error handling: business errors use standard status codes (`NOT_FOUND`, `FAILED_PRECONDITION`, `INVALID_ARGUMENT`, `PERMISSION_DENIED`...). Every client call has a 3 s deadline; `UNAVAILABLE` / `DEADLINE_EXCEEDED` become `SERVICE_UNAVAILABLE` at the gateway without leaking internals.

Try it manually with [grpcurl](https://github.com/fullstorydev/grpcurl) (ports are not published to the host for newer services; add a `ports:` entry first):
`grpcurl -plaintext -import-path packages/proto -proto product.proto -d '{"page":1,"page_size":3}' localhost:50062 product.ProductService/ListProducts`
