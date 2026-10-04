import { Kafka } from 'kafkajs';
import { Topics } from './index';

export const DEAD_LETTER_TOPIC = 'dead-letter';

/** Explicit topic configuration: 3 partitions each (parallelism per consumer group), plus a dead-letter topic. */
export async function ensureTopics(brokers: string, partitions = 3) {
  const admin = new Kafka({ clientId: 'topic-admin', brokers: brokers.split(',') }).admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [...Object.values(Topics), DEAD_LETTER_TOPIC].map((topic) => ({ topic, numPartitions: partitions, replicationFactor: 1 })),
    });
  } finally { await admin.disconnect(); }
}
