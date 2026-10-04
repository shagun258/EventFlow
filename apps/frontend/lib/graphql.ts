import { gql } from '@apollo/client';

const P = 'id name description price imageUrl categoryId categoryName';
const O = 'id orderNumber status total failureReason paymentStatus createdAt updatedAt items { productId productName unitPrice quantity }';
const C = 'items { productId productName unitPrice quantity lineTotal unavailable } total itemCount';

export const CATEGORIES = gql`query Categories { categories { id name slug } }`;
export const PRODUCTS = gql`query Products($search: String, $categoryId: String, $page: Int, $pageSize: Int) { products(search: $search, categoryId: $categoryId, page: $page, pageSize: $pageSize) { total products { ${P} } } }`;
export const PRODUCT = gql`query Product($id: ID!) { product(id: $id) { ${P} } }`;
export const LOGIN = gql`mutation Login($input: LoginInput!) { login(input: $input) { token user { id email name role } } }`;
export const REGISTER = gql`mutation Register($input: RegisterInput!) { register(input: $input) { token user { id email name role } } }`;
export const LOGOUT = gql`mutation Logout { logout }`;
export const ME = gql`query Me { me { id email name role createdAt } }`;
export const CART = gql`query Cart { cart { ${C} } }`;
export const ADD_TO_CART = gql`mutation AddToCart($input: CartItemInput!) { addToCart(input: $input) { ${C} } }`;
export const UPDATE_CART = gql`mutation UpdateCart($input: CartItemInput!) { updateCart(input: $input) { ${C} } }`;
export const REMOVE_FROM_CART = gql`mutation RemoveFromCart($productId: String!) { removeFromCart(productId: $productId) { ${C} } }`;
export const CREATE_ORDER = gql`mutation CreateOrder { createOrder { ${O} } }`;
export const ORDERS = gql`query Orders($status: String, $page: Int, $pageSize: Int) { orders(status: $status, page: $page, pageSize: $pageSize) { total orders { ${O} } } }`;
export const ORDER = gql`query Order($id: ID!) { order(id: $id) { ${O} } }`;
export const CANCEL_ORDER = gql`mutation CancelOrder($id: ID!, $reason: String) { cancelOrder(id: $id, reason: $reason) { ${O} } }`;
export const NOTIFICATIONS = gql`query Notifications { notifications(pageSize: 20) { total unreadCount notifications { id type message orderId read createdAt } } }`;
export const MARK_READ = gql`mutation MarkRead($id: ID!) { markNotificationRead(id: $id) { id read } }`;

// ---- admin ----
export const ADMIN_PRODUCTS = gql`query AdminProducts($page: Int, $pageSize: Int) { adminProducts(page: $page, pageSize: $pageSize) { total products { ${P} } } }`;
export const CREATE_PRODUCT = gql`mutation CreateProduct($input: ProductInput!) { createProduct(input: $input) { ${P} } }`;
export const UPDATE_PRODUCT = gql`mutation UpdateProduct($id: ID!, $input: ProductInput!) { updateProduct(id: $id, input: $input) { ${P} } }`;
export const DELETE_PRODUCT = gql`mutation DeleteProduct($id: ID!) { deleteProduct(id: $id) }`;
export const INVENTORY = gql`query Inventory { inventory(pageSize: 100) { total items { productId quantity reserved available } } }`;
export const UPDATE_INVENTORY = gql`mutation UpdateInventory($input: UpdateInventoryInput!) { updateInventory(input: $input) { productId quantity reserved available } }`;
export const ADMIN_ORDERS = gql`query AdminOrders($status: String, $page: Int, $pageSize: Int) { adminOrders(status: $status, page: $page, pageSize: $pageSize) { total orders { ${O} } } }`;
export const UPDATE_ORDER_STATUS = gql`mutation UpdateOrderStatus($id: ID!, $status: String!) { updateOrderStatus(id: $id, status: $status) { ${O} } }`;
export const ANALYTICS = gql`query Analytics { analytics { totalEvents ordersCreated ordersCancelled paymentsCompleted paymentsFailed revenue byTopic { topic count } } }`;
export const EVENTS = gql`query Events($topic: String, $page: Int, $pageSize: Int) { events(topic: $topic, page: $page, pageSize: $pageSize) { total events { eventId topic source entityId payloadJson occurredAt } } }`;
