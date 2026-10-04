import { createEvent, Topics } from './index';

describe('createEvent', () => {
  it('builds an envelope with unique ids and correct metadata', () => {
    const payload = { orderId: 'o1', userId: 'u1', items: [], total: 0 };
    const a = createEvent(Topics.ORDER_CREATED, 'order-service', payload);
    const b = createEvent(Topics.ORDER_CREATED, 'order-service', payload);
    expect(a.type).toBe('order.created');
    expect(a.source).toBe('order-service');
    expect(a.eventId).not.toBe(b.eventId);
    expect(new Date(a.occurredAt).toString()).not.toBe('Invalid Date');
  });
});
