import { createRouter } from "../../shared/openapi.ts";
import * as handlers from "./wallet.handlers.ts";
import * as routes from "./wallet.routes.ts";

// Mounted under /api/guests next to the guests router.
export default createRouter()
  .openapi(routes.topUp, handlers.topUp)
  .openapi(routes.auditTrail, handlers.auditTrail);
