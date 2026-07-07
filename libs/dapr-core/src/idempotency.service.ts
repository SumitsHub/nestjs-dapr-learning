import { Injectable, Logger } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';
import { createDaprClient } from './dapr-client.factory';

/**
 * Consumer-side idempotency guard.
 *
 * Backed by the `dedupstore` Dapr component (Redis with 7-day TTL).
 * The dedupe key is the CloudEvent `id` — every event Dapr publishes
 * carries a stable id that stays the same across redeliveries.
 *
 * Usage in a subscription handler:
 *
 *   @Post('/whatever')
 *   async handle(@Body() event: CloudEvent<T>) {
 *     if (await this.idempotency.wasProcessed(event.id)) {
 *       return { success: true }; // ACK and skip
 *     }
 *     await this.doTheWork(event.data);
 *     await this.idempotency.markProcessed(event.id);
 *     return { success: true };
 *   }
 *
 * IMPORTANT — this is "at-least-once processing" with a small race
 * window:
 *   - Check happens before the business write.
 *   - Mark happens AFTER the business write.
 *   - If the process crashes AFTER the business write but BEFORE the
 *     mark, the next redelivery will re-process (duplicate).
 *
 * For strict exactly-once processing you need to include the mark in
 * the same transaction as the business write (both against a
 * transactional state store). We keep it simple here because most
 * business operations tolerate an occasional duplicate as long as the
 * dedup catches the common case (broker redelivery within seconds).
 */
@Injectable()
export class IdempotencyService {
  private readonly client: DaprClient;
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly storeName = 'dedupstore';

  constructor() {
    this.client = createDaprClient();
  }

  private toKey(eventId: string): string {
    return `dedup:${eventId}`;
  }

  async wasProcessed(eventId: string): Promise<boolean> {
    if (!eventId) return false;
    const value = await this.client.state.get(this.storeName, this.toKey(eventId));
    return value !== null && value !== undefined && value !== '';
  }

  async markProcessed(eventId: string, ttlSeconds?: number): Promise<void> {
    if (!eventId) return;
    const options = ttlSeconds
      ? { metadata: { ttlInSeconds: String(ttlSeconds) } }
      : undefined;
    await this.client.state.save(this.storeName, [
      {
        key: this.toKey(eventId),
        value: { at: new Date().toISOString() },
        ...(options ?? {}),
      },
    ]);
    this.logger.debug(`marked processed: ${eventId}`);
  }
}
