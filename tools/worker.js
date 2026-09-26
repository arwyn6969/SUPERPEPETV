/* Cloudflare Worker for the hosted set.
   CORS is open. index.html gets tools/yt.js injected — that script is not in the NFT zip.
   Deploy from the repo root after `npm run hosted`:
     npx wrangler deploy --config tools/wrangler.toml
*/

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: CORS });
    }

    const url = new URL(request.url);
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    Object.entries(CORS).forEach(function (pair) {
      headers.set(pair[0], pair[1]);
    });

    const type = asset.headers.get("content-type") || "";
    const isIndex = url.pathname === "/" || url.pathname.endsWith("/index.html");
    if (asset.ok && isIndex && type.includes("text/html")) {
      let html = await asset.text();
      if (!html.includes("yt.js")) {
        html = html.replace("</head>", '<script src="yt.js"></script></head>');
      }
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("cache-control", "no-cache");
      headers.delete("content-length");
      return new Response(html, { status: asset.status, headers: headers });
    }

    return new Response(asset.body, { status: asset.status, headers: headers });
  },
};
