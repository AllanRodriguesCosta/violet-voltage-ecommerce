// Armazenamento volátil para desenvolvimento e testes; proibido em produção.
const conflict = (status) => {
  const e = new Error("Conflict");
  e.statusCode = status;
  return e;
};
export class MemoryStorage {
  constructor() {
    this.tables = {
      products: new Map(),
      customers: new Map(),
      orders: new Map(),
      alerts: new Map(),
      notifications: new Map(),
      questions: new Map(),
      assistantLog: new Map(),
      requests: new Map(),
      partners: new Map(),
      carts: new Map(),
      coupons: new Map(),
    };
    this.blobs = new Map();
  }
  async init() {}
  // Uma instância só: a trava entre servidores (etapa 31) é sempre obtida.
  async withLock(_name, work) {
    return { acquired: true, result: await work() };
  }
  async list(table) {
    return structuredClone([...this.tables[table].values()]);
  }
  async get(table, partitionKey, rowKey) {
    return structuredClone(this.tables[table].get(`${partitionKey}|${rowKey}`) || null);
  }
  async getByRowKey(table, rowKey) {
    return structuredClone([...this.tables[table].values()].find((i) => i.rowKey === rowKey) || null);
  }
  async getManyByRowKeys(table, rowKeys) {
    const keys = new Set(rowKeys);
    return structuredClone([...this.tables[table].values()].filter((i) => keys.has(i.rowKey)));
  }
  async listByPartition(table, partitionKey) {
    return structuredClone([...this.tables[table].values()].filter((i) => i.partitionKey === partitionKey));
  }
  async findCustomerById(id) {
    return structuredClone([...this.tables.customers.values()].find((u) => u.id === id) || null);
  }
  async findOrderByRequest(customerId, requestId) {
    return structuredClone(
      [...this.tables.orders.values()].find((o) => o.partitionKey === customerId && o.requestId === requestId) || null,
    );
  }
  async create(table, item) {
    const key = `${item.partitionKey}|${item.rowKey}`;
    if (this.tables[table].has(key)) throw conflict(409);
    this.tables[table].set(key, structuredClone({ ...item, etag: crypto.randomUUID() }));
  }
  async save(table, item, etag) {
    const current = await this.get(table, item.partitionKey, item.rowKey);
    if (etag && current?.etag !== etag) throw conflict(412);
    this.tables[table].set(`${item.partitionKey}|${item.rowKey}`, structuredClone({ ...item, etag: crypto.randomUUID() }));
  }
  async remove(table, partitionKey, rowKey) {
    this.tables[table].delete(`${partitionKey}|${rowKey}`);
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
