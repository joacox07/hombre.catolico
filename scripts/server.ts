/** Servidor estático mínimo (sin dependencias). Sirve el repo entero para que el panel y
 *  el render resuelvan rutas absolutas (/templates, /assets, /data) por igual. */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, normalize, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

export type RunningServer = { server: http.Server; port: number; url: string };

export function startServer(port = 0, root = ROOT): Promise<RunningServer> {
  const server = http.createServer(async (req, res) => {
    try {
      const reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
      // Evita traversal: normaliza y confirma que quede dentro de root.
      let filePath = normalize(join(root, reqPath));
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      let info = await stat(filePath).catch(() => null);
      if (info && info.isDirectory()) {
        filePath = join(filePath, "index.html");
        info = await stat(filePath).catch(() => null);
      }
      if (!info) {
        res.writeHead(404).end("Not found");
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });

  return new Promise((resolvePromise) => {
    server.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolvePromise({ server, port: actualPort, url: `http://localhost:${actualPort}` });
    });
  });
}
