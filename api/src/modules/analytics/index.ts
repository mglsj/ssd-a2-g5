import { createRouter } from "../../shared/openapi.ts";
import * as handlers from "./analytics.handlers.ts";
import * as routes from "./analytics.routes.ts";

export default createRouter()
  .openapi(routes.movingAverage, handlers.movingAverage)
  .openapi(routes.rank, handlers.rank)
  .openapi(routes.summary, handlers.summary)
  .openapi(routes.refresh, handlers.refresh);
