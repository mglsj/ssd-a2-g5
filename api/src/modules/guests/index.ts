import { createRouter } from "../../shared/openapi.ts";
import * as handlers from "./guests.handlers.ts";
import * as routes from "./guests.routes.ts";

export default createRouter().openapi(routes.list, handlers.list).openapi(routes.detail, handlers.detail);
