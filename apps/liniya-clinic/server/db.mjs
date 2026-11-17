import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
let connection;
export async function database() {
  if (connection) return connection;
  const initializing = (async () => {
    let db;
    if (process.env.DATABASE_URL) {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 3,
        connectionTimeoutMillis: 10000,
      });
      db = {
        kind: "postgres",
        async query(sql, args = []) {
          const r = await pool.query(sql, args);
          return r.rows;
        },
        async initialize(statements) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            await client.query("SELECT pg_advisory_xact_lock(1882785712)");
            for (const sql of statements) await client.query(sql);
            await client.query("COMMIT");
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          } finally {
            client.release();
          }
        },
        async close() {
          await pool.end();
        },
      };
    } else {
      if (process.env.VERCEL) {
        const e = new Error("Онлайн-запись пока недоступна. Попробуйте позже.");
        e.status = 503;
        e.code = "DATABASE_NOT_CONFIGURED";
        throw e;
      }
      const { DatabaseSync } = await import("node:sqlite");
      const filename = process.env.SQLITE_PATH || resolve("data/clinic.sqlite");
      await mkdir(dirname(filename), { recursive: true });
      const sqlite = new DatabaseSync(filename);
      sqlite.exec(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
      );
      db = {
        kind: "sqlite",
        async query(sql, args = []) {
          const bound = [];
          const normalized = sql.replace(/\$(\d+)/g, (_, n) => {
            bound.push(args[Number(n) - 1]);
            return "?";
          });
          return sqlite.prepare(normalized).all(...bound);
        },
        async close() {
          sqlite.close();
        },
      };
    }
    const statements = [
      `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'patient',created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS appointments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),doctor_id TEXT NOT NULL,service_id TEXT NOT NULL,starts_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'confirmed',created_at TEXT NOT NULL)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS active_doctor_slot ON appointments(doctor_id,starts_at) WHERE status='confirmed'`,
      `CREATE INDEX IF NOT EXISTS patient_appointments ON appointments(user_id,starts_at)`,
      `CREATE TABLE IF NOT EXISTS auth_attempts(id TEXT PRIMARY KEY,ip_hash TEXT NOT NULL,created_at TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS auth_attempt_window ON auth_attempts(ip_hash,created_at)`,
      `CREATE TABLE IF NOT EXISTS callbacks(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL)`,
    ];
    try {
      if (db.initialize) await db.initialize(statements);
      else for (const sql of statements) await db.query(sql);
    } catch (e) {
      await db.close();
      throw e;
    }
    return db;
  })();
  connection = initializing;
  try {
    return await initializing;
  } catch (e) {
    connection = undefined;
    throw e;
  }
}
export async function closeDatabase() {
  if (connection) {
    const db = await connection;
    await db.close();
    connection = undefined;
  }
}
