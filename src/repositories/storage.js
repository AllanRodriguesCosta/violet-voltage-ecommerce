import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
import { tableNames, containerName } from "../config/index.js";
// Legado: só testes importam este módulo; a aplicação usa memory.js e postgres.js.
export { MemoryStorage } from "./memory.js";
export class AzureStorage {
  constructor(connection) {
    this.tables = Object.fromEntries(
      Object.entries(tableNames).map(([k, v]) => [
        k,
        TableClient.fromConnectionString(connection, v),
      ]),
    );
    this.container =
      BlobServiceClient.fromConnectionString(connection).getContainerClient(
        containerName,
      );
  }
  async init() {
    await Promise.all([
      ...Object.values(this.tables).map((t) => t.createTable()),
      this.container.createIfNotExists(),
    ]);
  }
  async list(table) {
    const result = [];
    for await (const row of this.tables[table].listEntities()) result.push(row);
    return result;
  }
  async get(table, partitionKey, rowKey) {
    try {
      return await this.tables[table].getEntity(partitionKey, rowKey);
    } catch (e) {
      if (e.statusCode === 404) return null;
      throw e;
    }
  }
  async create(table, item) {
    await this.tables[table].createEntity(item);
  }
  async save(table, item, etag) {
    const entity = { ...item };
    delete entity.etag;
    delete entity.timestamp;
    await this.tables[table].updateEntity(entity, "Replace", {
      etag: etag || "*",
    });
  }
  async upload(name, buffer, type) {
    await this.container
      .getBlockBlobClient(name)
      .uploadData(buffer, { blobHTTPHeaders: { blobContentType: type } });
  }
  async blob(name) {
    try {
      const blob = this.container.getBlockBlobClient(name);
      return {
        buffer: await blob.downloadToBuffer(),
        type: (await blob.getProperties()).contentType,
      };
    } catch (e) {
      if (e.statusCode === 404) return null;
      throw e;
    }
  }
  async removeBlob(name) {
    await this.container.deleteBlob(name, { deleteSnapshots: "include" });
  }
}
