import { DaprClient } from '@dapr/dapr';

const client = new DaprClient({
  daprHost: '127.0.0.1',
  daprPort: '3500',
});

console.log(Object.keys(client));

console.log('STATE METHODS');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client.state)));
