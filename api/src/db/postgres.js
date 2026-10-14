import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.PG_URI
});

export async function query(text, params = []) {
  return pool.query(text, params);
}