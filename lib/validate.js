// Input checks. Each function returns { ok: true, value } or { ok: false, error } with a message a person can read.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUSES = ["want", "reading", "finished"];
const MAX_TITLE = 200;
const MAX_AUTHOR = 120;
const MAX_NOTES = 1000;
const MIN_PASSWORD = 8;
const MAX_GOAL = 1000;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function checkCredentials(input) {
  const email = text(input && input.email).toLowerCase();
  const password = typeof (input && input.password) === "string" ? input.password : "";
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `The password needs at least ${MIN_PASSWORD} characters.` };
  }
  return { ok: true, value: { email, password } };
}

// `partial` is true for an edit, where any field may be left out.
function checkBook(input, { partial = false } = {}) {
  const body = input || {};
  const value = {};

  if (!partial || "title" in body) {
    const title = text(body.title);
    if (!title) return { ok: false, error: "A book needs a title." };
    if (title.length > MAX_TITLE) return { ok: false, error: `The title is too long (most ${MAX_TITLE} characters).` };
    value.title = title;
  }
  if (!partial || "author" in body) {
    const author = text(body.author);
    if (!author) return { ok: false, error: "A book needs an author." };
    if (author.length > MAX_AUTHOR) return { ok: false, error: `The author is too long (most ${MAX_AUTHOR} characters).` };
    value.author = author;
  }
  if ("notes" in body) {
    const notes = text(body.notes);
    if (notes.length > MAX_NOTES) return { ok: false, error: `The notes are too long (most ${MAX_NOTES} characters).` };
    value.notes = notes;
  }
  if ("status" in body) {
    if (!STATUSES.includes(body.status)) return { ok: false, error: "Status must be want, reading or finished." };
    value.status = body.status;
  }
  if ("rating" in body) {
    if (body.rating !== null && !(Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5)) {
      return { ok: false, error: "A rating is a whole number from 1 to 5." };
    }
    value.rating = body.rating;
  }
  return { ok: true, value };
}

function checkGoal(input) {
  const target = input && input.target;
  if (!Number.isInteger(target) || target < 1 || target > MAX_GOAL) {
    return { ok: false, error: `A reading goal is a whole number from 1 to ${MAX_GOAL}.` };
  }
  return { ok: true, value: { target } };
}

module.exports = { STATUSES, checkCredentials, checkBook, checkGoal };
