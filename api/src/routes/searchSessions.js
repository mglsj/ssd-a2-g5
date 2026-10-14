import { Hono } from "hono";
import { searchSessions } from "../db/mongo.js";
import { badRequest, errorResponse } from "../utils/errors.js";
import { newSessionId, readJson } from "../utils/validation.js";

const app = new Hono();

app.post("/", async (c) => {
  try {
    const body = await readJson(c);

    if (!body) {
      return badRequest(c, "Invalid JSON body");
    }

    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90
    ) {
      return badRequest(
        c,
        "Invalid latitude"
      );
    }

    if (
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      return badRequest(
        c,
        "Invalid longitude"
      );
    }

    const document = {
      session_id: newSessionId(),
      user_id: body.user_id || "anonymous",
      location: {
        type: "Point",
        coordinates: [lng, lat]
      },
      created_at: new Date()
    };

    const result =
      await searchSessions.insertOne(
        document
      );

    return c.json(
      {
        _id: result.insertedId,
        ...document
      },
      201
    );
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

export default app;