// The whole API as one function: handle(request) -> { status, headers, body }. The local server and the Vercel function
// both call it, so the two behave the same.
const crypto = require("crypto");
const auth = require("./auth");
const books = require("./books");
const { checkCredentials, checkBook, checkGoal } = require("./validate");

const json = (status, body, headers = {}) => ({ status, headers, body });
const fail = (status, error) => json(status, { error });

const emailKey = (email) => `user:${email}`;
const idKey = (userId) => `id:${userId}`;
const shelfKey = (userId) => `shelf:${userId}`;
const goalKey = (userId) => `goal:${userId}`;

function createRouter({ store, env = process.env }) {
  async function loadShelf(userId) {
    return (await store.get(shelfKey(userId))) || [];
  }

  async function startSession(user, secure) {
    return json(200, { email: user.email }, { "Set-Cookie": auth.sessionCookie(auth.makeToken(user.id, env), { secure }) });
  }

  async function signup(req) {
    const checked = checkCredentials(req.body);
    if (!checked.ok) return fail(400, checked.error);
    const { email, password } = checked.value;
    if (await store.get(emailKey(email))) return fail(409, "That email already has an account. Sign in instead.");
    const user = { id: crypto.randomUUID(), email, ...auth.hashPassword(password) };
    await store.set(emailKey(email), user);
    await store.set(idKey(user.id), user);
    const session = await startSession(user, req.secure);
    return { ...session, status: 201 };
  }

  async function login(req) {
    const checked = checkCredentials(req.body);
    // The same message for a wrong password and an unknown email, so the page never tells which emails exist.
    const wrong = fail(401, "Email or password is wrong.");
    if (!checked.ok) return wrong;
    const user = await store.get(emailKey(checked.value.email));
    if (!user || !auth.passwordMatches(checked.value.password, user)) return wrong;
    return startSession(user, req.secure);
  }

  const logout = async (req) => json(200, { ok: true }, { "Set-Cookie": auth.clearCookie({ secure: req.secure }) });

  async function listBooks(req, { userId }) {
    const all = await loadShelf(userId);
    const shown = books.searchBooks(all, req.query.q);
    return json(200, { books: shown, total: all.length, averageRating: books.averageRating(all) });
  }

  async function createBook(req, { userId }) {
    const checked = checkBook(req.body);
    if (!checked.ok) return fail(400, checked.error);
    if (checked.value.rating != null && checked.value.status !== "finished") {
      return fail(400, "Only a finished book can be rated.");
    }
    const { list, book } = books.addBook(await loadShelf(userId), checked.value);
    await store.set(shelfKey(userId), list);
    return json(201, { book });
  }

  async function editBook(req, { userId, param: id }) {
    const checked = checkBook(req.body, { partial: true });
    if (!checked.ok) return fail(400, checked.error);
    const result = books.updateBook(await loadShelf(userId), id, checked.value);
    if (result.error) return fail(result.notFound ? 404 : 400, result.error);
    await store.set(shelfKey(userId), result.list);
    return json(200, { book: result.book });
  }

  async function deleteBook(req, { userId, param: id }) {
    const result = books.removeBook(await loadShelf(userId), id);
    if (result.error) return fail(404, result.error);
    await store.set(shelfKey(userId), result.list);
    return json(204, null);
  }

  async function exportBooks(req, { userId }) {
    const csv = books.toCsv(await loadShelf(userId));
    return { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="shelfmate.csv"' }, body: csv, raw: true };
  }

  async function getGoal(req, { userId }) {
    const goal = await store.get(goalKey(userId));
    return json(200, books.goalProgress(await loadShelf(userId), goal && goal.target));
  }

  async function setGoal(req, { userId }) {
    const checked = checkGoal(req.body);
    if (!checked.ok) return fail(400, checked.error);
    await store.set(goalKey(userId), checked.value);
    return json(200, books.goalProgress(await loadShelf(userId), checked.value.target));
  }

  // [method, path pattern, needs sign-in, handler]
  const routes = [
    ["POST", /^\/api\/signup$/, false, signup],
    ["POST", /^\/api\/login$/, false, login],
    ["POST", /^\/api\/logout$/, false, logout],
    ["GET", /^\/api\/me$/, true, async (req, { user }) => json(200, { email: user.email })],
    ["GET", /^\/api\/books$/, true, listBooks],
    ["POST", /^\/api\/books$/, true, createBook],
    ["GET", /^\/api\/books\/export$/, true, exportBooks],
    ["PATCH", /^\/api\/books\/([\w-]+)$/, true, editBook],
    ["DELETE", /^\/api\/books\/([\w-]+)$/, true, deleteBook],
    ["GET", /^\/api\/goal$/, true, getGoal],
    ["PUT", /^\/api\/goal$/, true, setGoal],
  ];

  async function handle(req) {
    const path = req.path.replace(/\/+$/, "") || "/";
    let pathMatched = false;
    try {
      for (const [method, pattern, needsLogin, handler] of routes) {
        const match = pattern.exec(path);
        if (!match) continue;
        pathMatched = true;
        if (method !== req.method) continue;
        if (!needsLogin) return await handler(req);
        const userId = auth.userIdFrom(req.headers, env);
        if (!userId) return fail(401, "Please sign in first.");
        const user = await store.get(idKey(userId));
        if (!user) return fail(401, "Please sign in first.");
        return await handler(req, { userId, user, param: match[1] });
      }
    } catch (error) {
      console.error(error);
      return fail(500, "Something went wrong on our side.");
    }
    return pathMatched ? fail(405, "That method is not allowed here.") : fail(404, "Not found.");
  }

  return { handle };
}

module.exports = { createRouter };
