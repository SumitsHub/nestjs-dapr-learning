import { Injectable, Logger } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';
import { randomUUID } from 'crypto';
import { createDaprClient } from './dapr-client.factory';

/**
 * Thrown by LockService.withLock when the resource is already held.
 * Callers translate this to an appropriate HTTP status (typically 503).
 * Keeping it as a domain error \u2014 not an HttpException \u2014 lets
 * non-HTTP callers (workflow activities, cron jobs) decide how to react.
 */
export class LockUnavailableError extends Error {
  constructor(public readonly resourceId: string) {
    super(`resource busy: ${resourceId}`);
    this.name = 'LockUnavailableError';
  }
}

/**
 * Thin wrapper around Dapr's Distributed Lock building block.
 *
 * Design notes:
 *   - `client.lock.lock()` is NON-BLOCKING. If the lock is held it
 *     returns success:false immediately. That is useless UX under
 *     concurrent load, so `withLock` retries with exponential
 *     backoff + jitter before throwing.
 *   - One `owner` per process (random UUID at boot). Prevents one
 *     replica from releasing another replica's lock.
 *   - `withLock()` is the canonical pattern: acquire \u2192 run \u2192 always
 *     release (best-effort; TTL is the safety net).
 *   - `ttlSeconds` MUST comfortably exceed the P99 duration of `fn`.
 *     If `fn` outlives the lease, the lock silently expires and a
 *     second holder may acquire it (the classic "stale lock" hazard).
 */
@Injectable()
export class LockService {
  private readonly client: DaprClient;
  private readonly logger = new Logger(LockService.name);
  private readonly owner = `owner-${randomUUID()}`;
  private readonly defaultStore = 'lockstore';
  private readonly defaultTtlSeconds = 15;
  private readonly defaultMaxAttempts = 6; // ~20+40+80+160+320+640 ms
  private readonly defaultBaseDelayMs = 20;

  constructor() {
    this.client = createDaprClient();
  }

  async withLock<T>(
    resourceId: string,
    fn: () => Promise<T>,
    opts: {
      storeName?: string;
      ttlSeconds?: number;
      /**
       * Total acquire attempts before giving up.
       * 1 = fail-fast, no retry.
       * Default 6 (~1.3s worst case with default backoff).
       */
      maxAttempts?: number;
      /**
       * Base backoff in ms; each retry waits 2^(n-1) * base * (0.5..1.5).
       */
      baseDelayMs?: number;
    } = {},
  ): Promise<T> {
    const storeName = opts.storeName ?? this.defaultStore;
    const ttlSeconds = opts.ttlSeconds ?? this.defaultTtlSeconds;
    const maxAttempts = opts.maxAttempts ?? this.defaultMaxAttempts;
    const baseDelayMs = opts.baseDelayMs ?? this.defaultBaseDelayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const acquired = await this.client.lock.lock(
        storeName,
        resourceId,
        this.owner,
        ttlSeconds,
      );

      if (acquired.success) {
        try {
          return await fn();
        } finally {
          // Best-effort release. If this throws (network blip, etc.) the
          // TTL will free the lock eventually \u2014 no infinite hold.
          await this.client.lock
            .unlock(storeName, resourceId, this.owner)
            .catch((err) => {
              this.logger.warn(
                `unlock failed for ${resourceId}: ${(err as Error).message}`,
              );
            });
        }
      }

      if (attempt === maxAttempts) break;

      // Exponential backoff with 50% jitter.
      const delayMs =
        baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random());
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new LockUnavailableError(resourceId);
  }
}
