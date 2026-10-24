// Where data lives. The app only needs get / set / del of one JSON value per key, so it runs on memory (local runs and
// tests) or on a Vercel Blob store (a deployed copy, where functions keep nothing between calls).
function memoryStore() {
  const data = new Map();
  return {
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : null;
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async del(key) {
      data.delete(key);
    },
  };
}

function blobStore(env) {
  const crypto = require("crypto");
  const { put, get, del } = require("@vercel/blob");
  const token = env.BLOB_READ_WRITE_TOKEN;
  // Keys hold characters such as ":" and "@", which a blob path does not keep, so the path is a hash of the key.
  const pathFor = (key) => `shelfmate/${crypto.createHash("sha256").update(key).digest("hex")}.json`;

  return {
    async get(key) {
      const result = await get(pathFor(key), { access: "private", token, useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return JSON.parse(await new Response(result.stream).text());
    },
    async set(key, value) {
      await put(pathFor(key), JSON.stringify(value), {
        access: "private", token, contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
      });
    },
    async del(key) {
      await del(pathFor(key), { token });
    },
  };
}

function createStore(env = process.env) {
  return env.BLOB_READ_WRITE_TOKEN ? blobStore(env) : memoryStore();
}

module.exports = { createStore, memoryStore };
