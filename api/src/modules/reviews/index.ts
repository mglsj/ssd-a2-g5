import { createRouter } from "../../shared/openapi.ts";
import * as handlers from "./reviews.handlers.ts";
import * as routes from "./reviews.routes.ts";

export default createRouter()
  .openapi(routes.analytics, handlers.analytics)
  .openapi(routes.eligibility, handlers.eligibility)
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create);
