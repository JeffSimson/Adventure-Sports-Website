import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const ALLOWED = new Set(["site", "rentals", "clubhouse", "safety"]);
const store = getStore("adventure-sports-live-content");

function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
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

  if (request.method === "GET") {
    const file = new URL(request.url).searchParams.get("file") || "";
    if (!ALLOWED.has(file)) return reply({ message: "Unknown content file." }, 400);
    const value = await store.get(file, { type: "json" });
    if (!value) return reply({ message: "No live value published yet." }, 404);
    return reply(value);
  }

  if (request.method === "PUT") {
    verifyRequestOrigin(request);
    const user = await getUser();
    if (!user) return reply({ message: "You must be signed in to publish." }, 401);

    let body: { file?: string; data?: unknown };
    try { body = await request.json(); }
    catch { return reply({ message: "Invalid JSON request." }, 400); }

    const file = body.file || "";
    if (!ALLOWED.has(file)) return reply({ message: "This file cannot be changed here." }, 400);
    if (!body.data || typeof body.data !== "object") return reply({ message: "Content data is required." }, 400);

    await store.setJSON(file, body.data);
    return reply({ ok: true, file, publishedAt: new Date().toISOString(), publishedBy: user.email });
  }

  return reply({ message: "Method not allowed." }, 405);
}

export const config: Config = { path: "/.netlify/functions/live-content" };
