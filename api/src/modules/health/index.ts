import { createRouter } from "../../shared/openapi.ts";
import * as handlers from "./health.handlers.ts";
import * as routes from "./health.routes.ts";

export default createRouter().openapi(routes.check, handlers.check);
