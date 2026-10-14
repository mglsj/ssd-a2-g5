// Typed client for the front end. Import it from web/ as a type-safe fetch wrapper:
//   import { createClient } from "../api/src/client.ts";
//   const api = createClient("/");
//   const res = await api.api.guests.$get({ query: { q: "ria" } });
import { hc } from "hono/client";
import type { AppType } from "./app.ts";

export type { AppType };

export const createClient = (baseUrl: string, options?: Parameters<typeof hc>[1]) => hc<AppType>(baseUrl, options);

export type Client = ReturnType<typeof createClient>;
