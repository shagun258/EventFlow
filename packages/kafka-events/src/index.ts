import { randomUUID } from 'crypto';

/** Single source of truth for topic names. */
export const Topics = {
  USER_CREATED: 'user.created',
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  NOTIFICATION_CREATED: 'notification.created',
  ORDER_STATUS_UPDATED: 'order.status_updated',
} as const;
export type Topic = (typeof Topics)[keyof typeof Topics];

export interface OrderItemPayload { productId: string; quantity: number; unitPrice: number }

export interface EventPayloads {
  'user.created': { userId: string; email: string };
  'order.created': { orderId: string; userId: string; items: OrderItemPayload[]; total: number };
  'order.cancelled': { orderId: string; userId: string; reason?: string };
  'payment.created': { paymentId: string; orderId: string; amount: number };
  'payment.completed': { paymentId: string; orderId: string; userId: string };
  'payment.failed': { paymentId: string; orderId: string; userId: string; reason: string };
  'inventory.reserved': { orderId: string; items: OrderItemPayload[] };
  'inventory.released': { orderId: string };
  'product.created': { productId: string; name: string; price: number };
  'product.updated': { productId: string; name: string; price: number };
  'notification.created': { userId: string; message: string };
  'order.status_updated': { orderId: string; userId: string; status: string };
}

/** Envelope: eventId enables idempotent consumers (dedupe on eventId). */
export interface EventEnvelope<T extends Topic = Topic> {
  eventId: string;
  type: T;
  occurredAt: string;
  source: string;
  payload: EventPayloads[T];
}

export function createEvent<T extends Topic>(
  type: T, source: string, payload: EventPayloads[T],
): EventEnvelope<T> {
  return { eventId: randomUUID(), type, occurredAt: new Date().toISOString(), source, payload };
}

/** Consumer group per service so each service receives every event. */
export const ConsumerGroups = {
  ORDER: 'order-service', INVENTORY: 'inventory-service', PAYMENT: 'payment-service',
  NOTIFICATION: 'notification-service', ANALYTICS: 'analytics-service',
} as const;
export * from './publisher';
export * from './admin';
export * from './consumer';
