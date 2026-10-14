import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
	API_URL: {
		description: "Base URL the /api proxy forwards to.",
		schema: (value) => value || "http://localhost:3000",
	},
});
