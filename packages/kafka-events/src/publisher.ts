import { Kafka, Producer } from 'kafkajs';
import { ensureTopics } from './admin';
import { createEvent, EventEnvelope, EventPayloads, Topic } from './index';

/** Thin idempotent Kafka producer that wraps payloads in the shared event envelope. */
export class EventPublisher {
  private readonly producer: Producer;
  connected = false;

  constructor(private readonly brokers: string, private readonly source: string) {
    this.producer = new Kafka({ clientId: source, brokers: brokers.split(','), retry: { retries: 8 } })
      .producer({ idempotent: true });
  }

  async connect() { await ensureTopics(this.brokers); await this.producer.connect(); this.connected = true; }
  async disconnect() { this.connected = false; await this.producer.disconnect(); }

  async publish<T extends Topic>(type: T, key: string, payload: EventPayloads[T]): Promise<EventEnvelope<T>> {
    const event = createEvent(type, this.source, payload);
    await this.producer.send({ topic: type, messages: [{ key, value: JSON.stringify(event) }] });
    return event;
  }
}
