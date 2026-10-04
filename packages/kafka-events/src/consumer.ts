import { Consumer, Kafka, Producer } from 'kafkajs';
import { DEAD_LETTER_TOPIC, ensureTopics } from './admin';
import { EventEnvelope, Topic } from './index';

/** Runs fn up to `attempts` times with linear backoff. Never throws. */
export async function processWithRetry(fn: () => Promise<void>, attempts = 3, baseDelayMs = 500) {
  let error: Error | undefined;
  for (let i = 1; i <= attempts; i++) {
    try { await fn(); return { ok: true, attempts: i } as const; }
    catch (e) { error = e as Error; if (i < attempts) await new Promise((r) => setTimeout(r, baseDelayMs * i)); }
  }
  return { ok: false, attempts, error } as const;
}

/**
 * One consumer group per service. Failed messages are retried, then parked on the
 * `dead-letter` topic so one poison message cannot block the partition forever.
 * Handlers must be idempotent (Kafka delivers at-least-once).
 */
export class EventConsumer {
  private readonly handlers = new Map<string, (e: any) => Promise<void>>();
  private readonly consumer: Consumer;
  private readonly dlq: Producer;
  connected = false;

  constructor(private readonly brokers: string, private readonly groupId: string, private readonly log: (m: string) => void = console.log) {
    const kafka = new Kafka({ clientId: groupId, brokers: brokers.split(','), retry: { retries: 8 } });
    this.consumer = kafka.consumer({ groupId });
    this.dlq = kafka.producer();
  }

  on<T extends Topic>(topic: T, handler: (e: EventEnvelope<T>) => Promise<void>) { this.handlers.set(topic, handler); return this; }

  async start() {
    await ensureTopics(this.brokers);
    await this.consumer.connect(); await this.dlq.connect();
    for (const topic of this.handlers.keys()) await this.consumer.subscribe({ topic, fromBeginning: true });
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const raw = message.value?.toString() ?? '';
        let event: EventEnvelope;
        try { event = JSON.parse(raw); } catch { return this.deadLetter(topic, raw, 'Invalid JSON'); }
        const res = await processWithRetry(() => this.handlers.get(topic)!(event));
        if (!res.ok) return this.deadLetter(topic, raw, res.error?.message ?? 'unknown', event.eventId);
      },
    });
    this.connected = true;
    this.log(`Consuming [${[...this.handlers.keys()].join(', ')}] as group "${this.groupId}"`);
  }

  async stop() { this.connected = false; await this.consumer.disconnect(); await this.dlq.disconnect(); }

  private async deadLetter(topic: string, raw: string, reason: string, eventId?: string) {
    this.log(`ERROR event ${eventId ?? '?'} on ${topic} moved to ${DEAD_LETTER_TOPIC}: ${reason}`);
    await this.dlq.send({ topic: DEAD_LETTER_TOPIC, messages: [{ key: eventId, value: JSON.stringify({ topic, group: this.groupId, reason, raw }) }] });
  }
}
