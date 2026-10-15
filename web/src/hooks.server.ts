import { API_URL } from "$app/env/private";
import type { Handle } from "@sveltejs/kit/hooks";

// Hop-by-hop headers belong to one connection, so they are not forwarded.
// accept-encoding is dropped too: fetch decompresses the body but keeps the
// content-encoding header, and the browser would then fail to decode it.
const dropped = [
	"host",
	"connection",
	"keep-alive",
	"transfer-encoding",
	"upgrade",
	"accept-encoding",
];

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;
	if (!pathname.startsWith("/api/")) return resolve(event);

	const target = new URL(pathname + search, API_URL);
	const headers = new Headers(event.request.headers);
	for (const name of dropped) headers.delete(name);

	const hasBody = !["GET", "HEAD"].includes(event.request.method);
	try {
		return await fetch(target, {
			method: event.request.method,
			headers,
			body: hasBody ? event.request.body : undefined,
			redirect: "manual",
			// Node's fetch needs this to stream a request body.
			...(hasBody && { duplex: "half" }),
		} as RequestInit);
	} catch {
		return Response.json(
			{
				error: {
					code: "DB_UNAVAILABLE",
					message: "StaySpot is not responding. Try again in a moment.",
					detail: { service: "api" },
				},
			},
			{ status: 503 },
		);
	}
};
