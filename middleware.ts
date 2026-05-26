import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS middleware for the public API surface.
 *
 * - OPTIONS preflight → 204 with CORS headers
 * - All other methods → forwards to the route and appends CORS headers
 *
 * The x402 challenge (402) and payment receipt header (`X-PAYMENT-RESPONSE`)
 * are exposed so cross-origin clients can read them.
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT, Authorization",
  "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const res = NextResponse.next();
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(name, value);
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*", "/.well-known/x402.json"],
};
