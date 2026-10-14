import { createRouter } from "../../shared/openapi.ts";
import * as handlers from "./bookings.handlers.ts";
import * as routes from "./bookings.routes.ts";

export default createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create)
  .openapi(routes.detail, handlers.detail)
  .openapi(routes.updateStatus, handlers.updateStatus);
