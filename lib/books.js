// Rules for one reader's shelf. Every function takes the list of books and returns a new value; nothing here touches
// storage, so each rule can be tested alone.
const crypto = require("crypto");

function addBook(list, fields, now = new Date()) {
  const book = {
    id: crypto.randomUUID(),
    title: fields.title,
    author: fields.author,
    notes: fields.notes || "",
    status: fields.status || "want",
    rating: null,
    addedAt: now.toISOString(),
  };
  if (book.status !== "finished") return { list: [...list, book], book };
  book.rating = fields.rating ?? null;
  return { list: [...list, book], book };
}

// Returns { list, book } or { error } when the book does not exist or the change breaks a rule.
function updateBook(list, id, fields) {
  const current = list.find((b) => b.id === id);
  if (!current) return { error: "Book not found.", notFound: true };

  const next = { ...current, ...fields };
  if (next.rating !== null && next.status !== "finished") {
    if ("rating" in fields && fields.rating !== null) return { error: "Only a finished book can be rated." };
    next.rating = null;
  }
  return { list: list.map((b) => (b.id === id ? next : b)), book: next };
}

function removeBook(list, id) {
  if (!list.some((b) => b.id === id)) return { error: "Book not found.", notFound: true };
  return { list: list.filter((b) => b.id !== id) };
}

// Case-insensitive match on title or author. An empty query keeps every book.
function searchBooks(list, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return list;
  return list.filter((b) => b.title.toLowerCase().includes(needle) || b.author.toLowerCase().includes(needle));
}

function averageRating(list) {
  const rated = list.filter((b) => b.status === "finished" && Number.isInteger(b.rating));
  if (rated.length === 0) return null;
  const total = rated.reduce((sum, b) => sum + b.rating, 0);
  return Math.round((total / rated.length) * 10) / 10;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// One header row, then one row per book.
function toCsv(list) {
  const header = ["title", "author", "status", "rating", "tags", "added"];
  const rows = list.map((b) =>
    [b.title, b.author, b.status, b.rating ?? "", b.tags.join(";"), b.addedAt].map(csvCell).join(","));
  return [header.join(","), ...rows].join("\n") + "\n";
}

// How far a reader is towards their yearly goal.
function goalProgress(list, target) {
  const finished = list.filter((b) => b.status === "done").length;
  const percent = target ? Math.min(100, Math.round((finished / target) * 100)) : 0;
  return { target: target || null, finished, percent };
}

module.exports = { addBook, updateBook, removeBook, searchBooks, averageRating, toCsv, goalProgress };
