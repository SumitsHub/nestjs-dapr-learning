import { Injectable } from '@nestjs/common';
import { PaymentCompletedEvent, InventoryStatus } from 'dapr-learning/common';
import { LockService } from '@app/dapr-core';
import { randomUUID } from 'crypto';
import { InventoryDto } from './dtos/inventory.dto';
import { InventoryStateService } from './state.service';

/**
 * Thrown by InventoryService.reserveForPayment when at least one SKU
 * cannot be reserved due to insufficient stock. Domain error \u2014 the
 * HTTP controller maps it to 409, other callers (e.g. workflow
 * activities) decide their own strategy.
 */
export class InsufficientStockError extends Error {
  constructor(
    public readonly sku: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(
      `insufficient stock for ${sku}: requested=${requested}, available=${available}`,
    );
    this.name = 'InsufficientStockError';
  }
}

@Injectable()
export class InventoryServiceService {
  constructor(
    private readonly stateService: InventoryStateService,
    private readonly lockService: LockService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  // ---------- Stock passthroughs (thin) --------------------------------

  setStock(sku: string, quantity: number): Promise<void> {
    return this.stateService.setStock(sku, quantity);
  }

  getStock(sku: string): Promise<number> {
    return this.stateService.getStock(sku);
  }

  // ---------- Reservation (Lesson 18) ----------------------------------

  /**
   * Reserve stock for every item in the payment, then persist a
   * reservation record. Each SKU is decremented under its OWN
   * distributed lock, so different SKUs run in parallel but two
   * reservations for the same SKU serialise.
   *
   * Throws:
   *   - InsufficientStockError  \u2192 caller should map to 409
   *   - LockUnavailableError    \u2192 caller should map to 503
   */
  async reserveForPayment(
    payload: PaymentCompletedEvent,
  ): Promise<InventoryDto> {
    for (const item of payload.items ?? []) {
      await this.lockService.withLock(`stock:${item.sku}`, async () => {
        const current = await this.stateService.getStock(item.sku);
        const next = current - item.quantity;
        if (next < 0) {
          throw new InsufficientStockError(item.sku, item.quantity, current);
        }
        await this.stateService.setStock(item.sku, next);
      });
    }

    const reservation: InventoryDto = {
      reservationId: randomUUID(),
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      items: payload.items,
      status: InventoryStatus.RESERVED,
      reservedAt: new Date(),
    };

    await this.stateService.save(reservation.reservationId, reservation);
    return reservation;
  }
}
