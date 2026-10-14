import { Hono } from "hono";
import { query } from "../db/postgres.js";
import { mongo } from "../db/mongo.js";

const app = new Hono();

app.get("/", async (c) => {
  let postgres = "ok";
  let mongoStatus = "ok";

  try {
    await query("SELECT 1");
  } catch {
    postgres = "down";
  }

  try {
    await mongo.command({ ping: 1 });
  } catch {
    mongoStatus = "down";
  }

  if (postgres !== "ok" || mongoStatus !== "ok") {
    return c.json(
      {
        postgres,
        mongo: mongoStatus
      },
      503
    );
  }

  return c.json({
    postgres: "ok",
    mongo: "ok"
  });
});

export default app;