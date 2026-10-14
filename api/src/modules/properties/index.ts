import { createRouter } from "../../shared/openapi.ts";
import * as handlers from "./properties.handlers.ts";
import * as routes from "./properties.routes.ts";

export default createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.detail, handlers.detail)
  .openapi(routes.amenities, handlers.amenities);
