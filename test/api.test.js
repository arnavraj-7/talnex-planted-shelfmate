const assert = require("node:assert/strict");
const { after, before, describe, test } = require("node:test");
const { createServer } = require("../local-server");
const { memoryStore } = require("../lib/store");

let server;
let base;

before(async () => {
  server = createServer({ store: memoryStore(), env: { SESSION_SECRET: "test-secret" } });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

// A tiny client that keeps the session cookie between calls.
function client() {
  let cookie = "";
  return async (method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const type = response.headers.get("content-type") || "";
    return { status: response.status, data: type.includes("json") ? await response.json() : await response.text() };
  };
}

async function signedIn(email = `reader${Math.random().toString(16).slice(2)}@example.com`) {
  const call = client();
  const res = await call("POST", "/api/signup", { email, password: "correct horse" });
  assert.equal(res.status, 201);
  return call;
}

describe("accounts", () => {
  test("sign up, then sign in again with the same password", async () => {
    const email = "again@example.com";
    await signedIn(email);
    const res = await client()("POST", "/api/login", { email, password: "correct horse" });
    assert.equal(res.status, 200);
    assert.equal(res.data.email, email);
  });

  test("a short password and a bad email are turned away", async () => {
    const call = client();
    assert.equal((await call("POST", "/api/signup", { email: "a@example.com", password: "short" })).status, 400);
    assert.equal((await call("POST", "/api/signup", { email: "nope", password: "long enough pw" })).status, 400);
  });

  test("the same email cannot sign up twice", async () => {
    await signedIn("twice@example.com");
    const res = await client()("POST", "/api/signup", { email: "twice@example.com", password: "another good one" });
    assert.equal(res.status, 409);
  });

  test("a wrong password gives the same answer as an unknown email", async () => {
    await signedIn("known@example.com");
    const wrong = await client()("POST", "/api/login", { email: "known@example.com", password: "not the password" });
    const unknown = await client()("POST", "/api/login", { email: "ghost@example.com", password: "not the password" });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.data, unknown.data);
  });

  test("routes that need a session answer 401 without one", async () => {
    assert.equal((await client()("GET", "/api/books")).status, 401);
  });
});

describe("books", () => {
  test("add, list and search", async () => {
    const call = await signedIn();
    await call("POST", "/api/books", { title: "Dune", author: "Frank Herbert" });
    await call("POST", "/api/books", { title: "Emma", author: "Jane Austen" });
    assert.equal((await call("GET", "/api/books")).data.books.length, 2);
    const found = (await call("GET", "/api/books?q=austen")).data.books;
    assert.deepEqual(found.map((b) => b.title), ["Emma"]);
  });

  test("a book needs a title and an author", async () => {
    const call = await signedIn();
    assert.equal((await call("POST", "/api/books", { title: "", author: "Someone" })).status, 400);
    assert.equal((await call("POST", "/api/books", { title: "Something", author: " " })).status, 400);
  });

  test("edit and delete", async () => {
    const call = await signedIn();
    const { book } = (await call("POST", "/api/books", { title: "Old title", author: "Me" })).data;
    const edited = await call("PATCH", `/api/books/${book.id}`, { title: "New title", notes: "great" });
    assert.equal(edited.data.book.title, "New title");
    assert.equal((await call("DELETE", `/api/books/${book.id}`)).status, 204);
    assert.equal((await call("DELETE", `/api/books/${book.id}`)).status, 404);
  });

  test("status changes and only finished books can be rated", async () => {
    const call = await signedIn();
    const { book } = (await call("POST", "/api/books", { title: "Ulysses", author: "James Joyce" })).data;
    assert.equal((await call("PATCH", `/api/books/${book.id}`, { rating: 4 })).status, 400);
    await call("PATCH", `/api/books/${book.id}`, { status: "finished" });
    assert.equal((await call("PATCH", `/api/books/${book.id}`, { rating: 4 })).status, 200);
    assert.equal((await call("PATCH", `/api/books/${book.id}`, { rating: 9 })).status, 400);
    assert.equal((await call("GET", "/api/books")).data.averageRating, 4);
  });

  test("a reader never sees another reader's books", async () => {
    const first = await signedIn();
    const second = await signedIn();
    await first("POST", "/api/books", { title: "Private", author: "Me" });
    assert.equal((await second("GET", "/api/books")).data.books.length, 0);
  });
});

describe("goal", () => {
  test("a goal can be saved and read back", async () => {
    const call = await signedIn();
    assert.equal((await call("PUT", "/api/goal", { target: 12 })).status, 200);
    assert.equal((await call("GET", "/api/goal")).data.target, 12);
    assert.equal((await call("PUT", "/api/goal", { target: 0 })).status, 400);
  });
});
