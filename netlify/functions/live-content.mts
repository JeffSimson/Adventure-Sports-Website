import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const ALLOWED = new Set(["site", "rentals", "clubhouse", "safety"]);

function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Netlify-CDN-Cache-Control": "no-store",
      "Pragma": "no-cache",
      "Expires": "0",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
    }
  });
}

export default async function handler(request: Request, context: Context) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
    }});
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.get("health") === "1") {
    return reply({ ok: true, service: "adventure-sports-live-content", time: new Date().toISOString() });
  }

  const store = getStore({ name: "adventure-sports-live-content", consistency: "strong" });

  if (request.method === "GET") {
    const file = url.searchParams.get("file") || "";
    if (!ALLOWED.has(file)) return reply({ message: "Unknown content file." }, 400);
    const value = await store.get(file, { type: "json", consistency: "strong" });
    if (!value) return reply({ message: "No live value published yet." }, 404);
    return reply(value);
  }

  if (request.method === "PUT") {
    verifyRequestOrigin(request);
    const user = await getUser();
    if (!user) return reply({ message: "You must be signed in to publish." }, 401);

    let body: { file?: string; data?: Record<string, unknown> };
    try { body = await request.json(); }
    catch { return reply({ message: "Invalid JSON request." }, 400); }

    const file = body.file || "";
    if (!ALLOWED.has(file)) return reply({ message: "This file cannot be changed here." }, 400);
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return reply({ message: "Content data is required." }, 400);
    }

    const revision = crypto.randomUUID();
    const publishedAt = new Date().toISOString();
    const saved = {
      ...body.data,
      __revision: revision,
      __publishedAt: publishedAt,
      __publishedBy: user.email
    };

    await store.setJSON(file, saved);
    const verified = await store.get(file, { type: "json", consistency: "strong" }) as Record<string, unknown> | null;
    if (!verified || verified.__revision !== revision) {
      return reply({ message: "The live data write could not be verified." }, 500);
    }

    return reply({ ok: true, file, revision, publishedAt, publishedBy: user.email });
  }

  return reply({ message: "Method not allowed." }, 405);
}

export const config: Config = { path: "/.netlify/functions/live-content" };
