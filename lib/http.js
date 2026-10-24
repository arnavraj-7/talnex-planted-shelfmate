// Turns a Node request into the plain { method, path, query, headers, body, secure } the router expects, and writes the
// router's answer back. Shared by server.js and the Vercel function.
const MAX_BODY_BYTES = 100 * 1024;

function readBody(req) {
  if (req.body !== undefined) return Promise.resolve(req.body); // Vercel has already parsed it
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolve(undefined);
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(Object.assign(new Error("bad json"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

async function toRequest(req) {
  const url = new URL(req.url, "http://localhost");
  const forwarded = String(req.headers["x-forwarded-proto"] || "");
  return {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: req.headers,
    body: await readBody(req),
    secure: forwarded === "https",
  };
}

function send(res, answer) {
  for (const [name, value] of Object.entries(answer.headers || {})) res.setHeader(name, value);
  if (answer.body === null) {
    res.statusCode = answer.status;
    return res.end();
  }
  if (!answer.raw) res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = answer.status;
  res.end(answer.raw ? answer.body : JSON.stringify(answer.body));
}

// Runs the router for one Node request and always answers, even for a bad body.
async function serve(router, req, res) {
  try {
    send(res, await router.handle(await toRequest(req)));
  } catch (error) {
    send(res, { status: error.status || 500, body: { error: error.status === 413 ? "That request is too large." : "That request could not be read." } });
  }
}

module.exports = { serve };
