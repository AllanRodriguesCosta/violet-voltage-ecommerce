import { MemoryStorage } from "./storage.js";
import { PostgresStorage } from "./postgres.js";
export function createStorage(config) {
  return config.memory ? new MemoryStorage() : new PostgresStorage(config);
}
