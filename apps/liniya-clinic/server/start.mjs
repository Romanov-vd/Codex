import "dotenv/config";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import api from "./api.mjs";
const root = resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) return api(req, res);
  try {
    const requested = resolve(root, "." + decodeURIComponent(url.pathname));
    if (!requested.startsWith(root + sep) && requested !== root) {
      res.writeHead(403).end();
      return;
    }
    let file = requested;
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    } catch {
      file = resolve(root, "index.html");
    }
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(data);
  } catch {
    res
      .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      .end("Сначала выполните npm run build.");
  }
});
server.listen(Number(process.env.PORT || 3101), "0.0.0.0", () =>
  console.log(`Клиника: http://localhost:${process.env.PORT || 3101}`),
);
