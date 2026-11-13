import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const tables = Object.freeze({
  products: "violet_voltage.products",
  customers: "violet_voltage.customers",
  orders: "violet_voltage.orders",
  alerts: "violet_voltage.alerts",
  notifications: "violet_voltage.notifications",
  questions: "violet_voltage.questions",
  assistantLog: "violet_voltage.assistant_log",
  requests: "violet_voltage.requests",
  partners: "violet_voltage.partners",
  carts: "violet_voltage.carts",
  coupons: "violet_voltage.coupons",
});

export function databaseOptions(config) {
  const url = new URL(config.databaseUrl);
  // A configuração TLS é única: parâmetros da URL não podem desativar a validação.
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: config.databaseSsl
      ? {
          rejectUnauthorized: true,
          ...(config.databaseCa
            ? { ca: config.databaseCa.replace(/\\n/g, "\n") }
            : {}),
        }
      : false,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
  };
}

function tableName(table) {
  if (!Object.hasOwn(tables, table))
    throw new Error("Repositório desconhecido.");
  return tables[table];
}
function document(item) {
  const value = { ...item };
  delete value.etag;
  delete value.timestamp;
  return value;
}
function entity(row) {
  return row ? { ...row.data, etag: row.version } : null;
}
function conflict(status) {
  const error = new Error("Registro alterado ou já existente.");
  error.statusCode = status;
  return error;
}

export class PostgresStorage {
  constructor(config, pool) {
    this.pool = pool || new pg.Pool(databaseOptions(config));
    this.inTransaction = false;
    this.pool.on?.("error", () =>
      console.error(
        "Conexão PostgreSQL interrompida; será reaberta na próxima operação.",
      ),
    );
  }
  async init() {
    const sql = await readFile(
      new URL("../../migrations/001-postgres.sql", import.meta.url),
      "utf8",
    );
    await this.pool.query(sql);
  }
  async close() {
    await this.pool.end();
  }
  async ping() {
    await this.pool.query("SELECT 1");
  }
  async list(table) {
    const result = await this.pool.query(
      `SELECT data, version FROM ${tableName(table)} ORDER BY row_key`,
    );
    return result.rows.map(entity);
  }
  async get(table, partitionKey, rowKey) {
    const result = await this.pool.query(
      `SELECT data, version FROM ${tableName(table)} WHERE partition_key=$1 AND row_key=$2`,
      [partitionKey, rowKey],
    );
    return entity(result.rows[0]);
  }
  // Consultas pontuais usam a chave primária ou os índices únicos da migração.
  async getByRowKey(table, rowKey) {
    const result = await this.pool.query(
      `SELECT data, version FROM ${tableName(table)} WHERE row_key=$1`,
      [rowKey],
    );
    return entity(result.rows[0]);
  }
  async getManyByRowKeys(table, rowKeys) {
    const keys = [...new Set(rowKeys)].slice(0, 100);
    if (!keys.length) return [];
    const result = await this.pool.query(
      `SELECT data, version FROM ${tableName(table)} WHERE row_key IN (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      keys,
    );
    return result.rows.map(entity);
  }
  async listByPartition(table, partitionKey) {
    const result = await this.pool.query(
      `SELECT data, version FROM ${tableName(table)} WHERE partition_key=$1 ORDER BY row_key`,
      [partitionKey],
    );
    return result.rows.map(entity);
  }
  async findCustomerById(id) {
    const result = await this.pool.query(
      "SELECT data, version FROM violet_voltage.customers WHERE data->>'id'=$1",
      [id],
    );
    return entity(result.rows[0]);
  }
  async findOrderByRequest(customerId, requestId) {
    const result = await this.pool.query(
      "SELECT data, version FROM violet_voltage.orders WHERE partition_key=$1 AND data->>'requestId'=$2",
      [customerId, requestId],
    );
    return entity(result.rows[0]);
  }
  async create(table, item) {
    try {
      await this.pool.query(
        `INSERT INTO ${tableName(table)} (partition_key,row_key,data,version) VALUES ($1,$2,$3::jsonb,$4)`,
        [
          item.partitionKey,
          item.rowKey,
          JSON.stringify(document(item)),
          randomUUID(),
        ],
      );
    } catch (error) {
      if (error.code === "23505") throw conflict(409);
      throw error;
    }
  }
  async save(table, item, etag) {
    const result = await this.pool.query(
      `UPDATE ${tableName(table)} SET data=$3::jsonb,version=$4 WHERE partition_key=$1 AND row_key=$2 AND ($5::text IS NULL OR version=$5) RETURNING row_key`,
      [
        item.partitionKey,
        item.rowKey,
        JSON.stringify(document(item)),
        randomUUID(),
        etag || null,
      ],
    );
    if (!result.rows.length) throw conflict(412);
  }
  async remove(table, partitionKey, rowKey) {
    await this.pool.query(
      `DELETE FROM ${tableName(table)} WHERE partition_key=$1 AND row_key=$2`,
      [partitionKey, rowKey],
    );
  }
  async upload(name, buffer, type) {
    await this.pool.query(
      `INSERT INTO violet_voltage.images (name,content,mime_type) VALUES ($1,$2,$3) ON CONFLICT (name) DO UPDATE SET content=EXCLUDED.content,mime_type=EXCLUDED.mime_type`,
      [name, buffer, type],
    );
  }
  async blob(name) {
    const result = await this.pool.query(
      "SELECT content, mime_type FROM violet_voltage.images WHERE name=$1",
      [name],
    );
    return result.rows[0]
      ? {
          buffer: Buffer.from(result.rows[0].content),
          type: result.rows[0].mime_type,
        }
      : null;
  }
  async removeBlob(name) {
    await this.pool.query("DELETE FROM violet_voltage.images WHERE name=$1", [
      name,
    ]);
  }
  // Etapa 31: trava entre instâncias (várias VMs ou App Service com 2+ instâncias). É trava de
  // transação, que também funciona no pooler de transação do Supabase. Se outra instância já está
  // com ela, não espera: devolve { acquired: false }. O trabalho usa as conexões normais do pool.
  async withLock(name, work) {
    const client = await this.pool.connect();
    let broken = false;
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok", [`violet_voltage:${name}`]);
      if (!rows[0]?.ok) {
        await client.query("ROLLBACK");
        return { acquired: false };
      }
      let result;
      try {
        result = await work();
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          broken = true;
        }
        throw error;
      }
      // O trabalho já foi feito; se o banco encerrou a transação ociosa, só descarta a conexão.
      try {
        await client.query("COMMIT");
      } catch {
        broken = true;
      }
      return { acquired: true, result };
    } finally {
      client.release(broken || undefined);
    }
  }
  async transaction(work) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const client = await this.pool.connect();
      let broken = false;
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const scoped = Object.create(PostgresStorage.prototype);
        scoped.pool = client;
        scoped.inTransaction = true;
        const result = await work(scoped);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        // Falha no ROLLBACK não mascara o erro original; a conexão é descartada.
        try {
          await client.query("ROLLBACK");
        } catch {
          broken = true;
        }
        if (error.code === "40001" && attempt < 2) continue;
        if (error.code === "40001") throw conflict(412);
        throw error;
      } finally {
        client.release(broken || undefined);
      }
    }
  }
}
