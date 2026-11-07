import { PGlite } from "@electric-sql/pglite";
import { PostgresStorage } from "../../src/repositories/postgres.js";

// Motor PostgreSQL real em WASM, isolado por teste; não exige conta cloud nem Docker.
export async function postgresFixture(t) {
  const database = new PGlite();
  await database.waitReady;
  const query = async (sql, params) => {
    if (params === undefined && sql.includes(";"))
      return (await database.exec(sql)).at(-1);
    return database.query(sql, params);
  };
  let tail = Promise.resolve();
  const pool = {
    query,
    async connect() {
      const previous = tail;
      let release;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      return { query, release };
    },
    end: () => database.close(),
  };
  const storage = new PostgresStorage({}, pool);
  t.after(() => storage.close());
  await storage.init();
  return { storage, database };
}
