import { createRouter } from "../../shared/openapi.ts";
import * as handlers from "./map.handlers.ts";
import * as routes from "./map.routes.ts";

export default createRouter()
  .openapi(routes.hotspots, handlers.hotspots)
  .openapi(routes.density, handlers.density)
  .openapi(routes.heat, handlers.heat)
  .openapi(routes.pins, handlers.pins)
  .openapi(routes.dropPin, handlers.dropPin)
  .openapi(routes.properties, handlers.properties)
  .openapi(routes.area, handlers.area);
