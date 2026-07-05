import { Injectable } from '@nestjs/common';
import { DaprClient } from '@dapr/dapr';
import { InventoryDto } from './dtos/inventory.dto';

@Injectable()
export class InventoryStateService {
  private readonly client: DaprClient;

  constructor() {
    this.client = new DaprClient({
      daprHost: '127.0.0.1',
      daprPort: '3502',
    });
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
}
