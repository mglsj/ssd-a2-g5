import { SQL } from "bun";
import { config } from "../config.ts";

export const sql = new SQL({ url: config.PG_URI, max: 10, idleTimeout: 30, connectionTimeout: 5 });

// Bun decodes a zero NUMERIC from a parameterised query as "0" instead of "0.00".
// Queries cast money columns to text, and procedure OUT values go through this.
export const money = (value: string) => (/^-?0$/.test(value) ? "0.00" : value);
