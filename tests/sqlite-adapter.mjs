import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
// Ejecuta las migraciones reales en SQLite; no simula respuestas del servicio.
export function testDatabase() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    sql.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  }
  const prepare = (query) => {
    let params = [];
    const execute = () => {
      const s = sql.prepare(query);
      if (/^\s*(SELECT|WITH)|RETURNING\s+/i.test(query))
        return { results: s.all(...params), success: true };
      const result = s.run(...params);
      return { results: [], success: true, meta: { changes: result.changes } };
    };
    return {
      bind(...p) {
        params = p;
        return this;
      },
      async first() {
        return execute().results[0] ?? null;
      },
      async all() {
        return execute();
      },
      async run() {
        return execute();
      },
      execute,
    };
  };
  return {
    prepare,
    async batch(statements) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((s) => s.execute());
        sql.exec('COMMIT');
        return results;
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
    close() {
      sql.close();
    },
  };
}
