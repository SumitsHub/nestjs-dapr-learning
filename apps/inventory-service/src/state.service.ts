import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';
import { createDaprClient } from '@app/dapr-core';
import { InventoryDto } from './dtos/inventory.dto';

interface StockRow {
  sku: string;
  quantity: number;
}

@Injectable()
export class InventoryStateService {
  private readonly client: DaprClient;

  constructor() {
    this.client = createDaprClient();
  }

  async save(key: string, inventory: InventoryDto): Promise<void> {
    await this.client.state.save('inventorystore', [
      {
        key,
        value: inventory,
      },
    ]);
  }

  async get(key: string): Promise<InventoryDto | null> {
    return this.client.state.get(
      'inventorystore',
      key,
    ) as Promise<InventoryDto | null>;
  }

  async delete(key: string): Promise<void> {
    await this.client.state.delete('inventorystore', key);
  }

  // ---------- Stock (Lesson 18) ---------------------------------------
  // Per-SKU stock counters. Stored in the same MongoDB-backed
  // `inventorystore` under a `stock:<sku>` key to keep infra simple.
  //
  // This layer is intentionally dumb: read and write only. Concurrency
  // safety and the "cannot go negative" rule live in InventoryService,
  // which serialises callers via LockService.

  private stockKey(sku: string): string {
    return `stock:${sku}`;
  }

  async setStock(sku: string, quantity: number): Promise<void> {
    const row: StockRow = { sku, quantity };
    await this.client.state.save('inventorystore', [
      { key: this.stockKey(sku), value: row },
    ]);
  }

  async getStock(sku: string): Promise<number> {
    const row = (await this.client.state.get(
      'inventorystore',
      this.stockKey(sku),
    )) as StockRow | null;
    return row?.quantity ?? 0;
  }
}
