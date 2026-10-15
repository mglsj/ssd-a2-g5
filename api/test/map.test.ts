import { describe, expect, test } from "bun:test";
import { call, type Json } from "./helpers.ts";

const IIIT = "lat=17.4455&lng=78.3489";

const expectFeatureCollection = (result: { type: string | null; body: Json }) => {
  expect(result.type).toStartWith("application/geo+json");
  expect(result.body.type).toBe("FeatureCollection");
  for (const feature of result.body.features) {
    expect(feature.type).toBe("Feature");
    expect(feature.geometry.type).toBe("Point");
    expect(feature.geometry.coordinates).toHaveLength(2);
  }
};

const isSorted = (values: number[]) => values.every((value, i) => i === 0 || values[i - 1]! <= value);

describe("map (Workflow 3) as GeoJSON", () => {
  test("heat cells cover the window and their counts add up", async () => {
    await call("POST", "/map/pins", { lat: 17.4456, lng: 78.349 });
    const heat = await call("GET", `/map/heat?${IIIT}&cell=200`);
    expectFeatureCollection(heat);
    expect(heat.body.features.length).toBeGreaterThan(0);
    const counts: number[] = heat.body.features.map((f: Json) => f.properties.count);
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(heat.body.total);
    expect(Math.max(...counts)).toBe(heat.body.max_count);
    expect(new Set(heat.body.features.map((f: Json) => f.id)).size).toBe(counts.length);

    const bad = await call("GET", `/map/heat?${IIIT}&cell=5`);
    expect(bad.status).toBe(400);
  });

  test("a dropped pin is a feature, shows up in the pins layer and in a hotspot", async () => {
    const pin = await call("POST", "/map/pins", { lat: 17.4456, lng: 78.349 });
    expect(pin.status).toBe(201);
    expect(pin.type).toStartWith("application/geo+json");
    expect(pin.body).toMatchObject({ type: "Feature", geometry: { type: "Point", coordinates: [78.349, 17.4456] } });
    expect(pin.body.properties.user_id).toBe("anonymous");

    const pins = await call("GET", `/map/pins?${IIIT}`);
    expectFeatureCollection(pins);
    expect(pins.body.features.map((f: Json) => f.id)).toContain(pin.body.id);
    expect(isSorted(pins.body.features.map((f: Json) => f.properties.distance_meters))).toBe(true);

    const hotspots = await call("GET", `/map/hotspots?${IIIT}`);
    expectFeatureCollection(hotspots);
    expect(hotspots.body.center).toEqual({ lat: 17.4455, lng: 78.3489 });
    expect(hotspots.body.features[0]).toMatchObject({ id: 1, properties: { rank: 1 } });
  });

  test("polling with the cursor returns only newer pins", async () => {
    const first = await call("GET", `/map/pins?${IIIT}`);
    const cursor = first.body.cursor;
    expect(cursor).not.toBeNull();

    const quiet = await call("GET", `/map/pins?${IIIT}&after=${encodeURIComponent(cursor)}`);
    expect(quiet.body.features).toHaveLength(0);
    expect(quiet.body.cursor).toBe(new Date(cursor).toISOString());

    await Bun.sleep(5);
    const pin = await call("POST", "/map/pins", { lat: 17.446, lng: 78.35 });
    const next = await call("GET", `/map/pins?${IIIT}&after=${encodeURIComponent(cursor)}`);
    expect(next.body.features.map((f: Json) => f.id)).toEqual([pin.body.id]);
    expect(next.body.cursor).toBe(pin.body.properties.created_at);
  });

  test("the property layer filters by distance, nearest first", async () => {
    const layer = await call("GET", `/map/properties?${IIIT}&radius=2000`);
    expectFeatureCollection(layer);
    const distances = layer.body.features.map((f: Json) => f.properties.distance_meters);
    expect(distances.length).toBeGreaterThan(0);
    expect(distances.every((d: number) => d <= 2000)).toBe(true);
    expect(isSorted(distances)).toBe(true);

    const everything = await call("GET", "/map/properties");
    expect(everything.body.features.length).toBeGreaterThan(distances.length);
  });

  test("the search area is a closed polygon", async () => {
    const { type, body } = await call("GET", `/map/area?${IIIT}`);
    expect(type).toStartWith("application/geo+json");
    const [ring] = body.geometry.coordinates;
    expect(body.geometry.type).toBe("Polygon");
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring[64]);
  });

  test("density rings stay plain chart data", async () => {
    const { type, body } = await call("GET", `/map/density?${IIIT}`);
    expect(type).toStartWith("application/json");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

describe("reviews (Workflow 4)", () => {
  test("review analytics always has five rating buckets", async () => {
    const { body } = await call("GET", "/reviews/analytics");
    expect(body.rating_distributions.map((d: Json) => d.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(body.overall_summary.total_reviews).toBeGreaterThan(0);
  });

  test("a top tag filters the review list", async () => {
    const { body: facets } = await call("GET", "/reviews/analytics");
    const { tag, frequency } = facets.most_frequent_tags[0];
    const { body } = await call("GET", `/reviews?tag=${tag}&limit=5`);
    expect(body.total).toBe(frequency);
    expect(body.items.every((r: Json) => r.location_tags.includes(tag))).toBe(true);
  });
});
