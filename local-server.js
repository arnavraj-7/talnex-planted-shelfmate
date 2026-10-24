// Local entry (not used on Vercel, which serves public/ and api/ itself): serves the web page from public/ and the API under /api. Run with `npm start` (port 3000, or PORT).
const fs = require("fs");
const http = require("http");
const path = require("path");
const { serve } = require("./lib/http");
const { createRouter } = require("./lib/router");
const { createStore } = require("./lib/store");

const PUBLIC_DIR = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function createServer({ store = createStore(), env = process.env } = {}) {
  const router = createRouter({ store, env });

  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname.startsWith("/api/")) return serve(router, req, res);

    const file = path.normalize(path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname));
    if (!file.startsWith(PUBLIC_DIR)) {
      res.statusCode = 403;
      return res.end();
    }
    fs.readFile(file, (error, content) => {
      if (error) {
        res.statusCode = 404;
        return res.end("Not found");
      }
      res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
      res.end(content);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`ShelfMate is running on port ${port}`));
}

module.exports = { createServer };
