import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
import { tableNames, containerName } from "../config/index.js";
export class MemoryStorage {
  constructor() {
    this.tables = Object.fromEntries(
      Object.keys(tableNames).map((k) => [k, new Map()]),
    );
    this.blobs = new Map();
  }
  async init() {}
  async list(table) {
    return structuredClone([...this.tables[table].values()]);
  }
  async get(table, partitionKey, rowKey) {
    return structuredClone(
      this.tables[table].get(`${partitionKey}|${rowKey}`) || null,
    );
  }
  async create(table, item) {
    const key = `${item.partitionKey}|${item.rowKey}`;
    if (this.tables[table].has(key)) {
      const e = new Error("Conflict");
      e.statusCode = 409;
      throw e;
    }
    this.tables[table].set(
      key,
      structuredClone({ ...item, etag: crypto.randomUUID() }),
    );
  }
  async save(table, item, etag) {
    const current = await this.get(table, item.partitionKey, item.rowKey);
    if (etag && current?.etag !== etag) {
      const e = new Error("Conflict");
      e.statusCode = 412;
      throw e;
    }
    this.tables[table].set(
      `${item.partitionKey}|${item.rowKey}`,
      structuredClone({ ...item, etag: crypto.randomUUID() }),
    );
  }
  async upload(name, buffer, type) {
    this.blobs.set(name, { buffer, type });
  }
  async blob(name) {
    return this.blobs.get(name) || null;
  }
  async removeBlob(name) {
    this.blobs.delete(name);
  }
}
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
