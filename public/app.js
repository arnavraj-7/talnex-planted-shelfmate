// ShelfMate page: sign in or create an account, then manage the shelf. All data comes from the /api routes.
const STATUS_LABELS = { want: "Want to read", reading: "Reading", finished: "Finished" };
const $ = (id) => document.getElementById(id);

let signingUp = false;
let searchTimer = null;

async function api(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 || !response.headers.get("content-type")?.includes("json") ? null : await response.json();
  return { ok: response.ok, status: response.status, data, response };
}

function say(id, text) {
  $(id).textContent = text || "";
}

// ---- sign in / sign up ----

function showAuthMode() {
  $("auth-title").textContent = signingUp ? "Create an account" : "Sign in";
  $("auth-submit").textContent = signingUp ? "Create account" : "Sign in";
  $("auth-switch-text").textContent = signingUp ? "Already have an account?" : "New here?";
  $("auth-switch").textContent = signingUp ? "Sign in" : "Create an account";
  $("password").autocomplete = signingUp ? "new-password" : "current-password";
  say("auth-message", "");
}

function showSignedIn(email) {
  $("auth-view").hidden = true;
  $("shelf-view").hidden = false;
  $("account").hidden = false;
  $("account-email").textContent = email;
  refreshAll();
}

function showSignedOut() {
  $("auth-view").hidden = false;
  $("shelf-view").hidden = true;
  $("account").hidden = true;
  $("auth-form").reset();
  showAuthMode();
}

$("auth-switch").addEventListener("click", () => {
  signingUp = !signingUp;
  showAuthMode();
});

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  say("auth-message", "");
  const body = { email: $("email").value, password: $("password").value };
  const { ok, data } = await api("POST", signingUp ? "/api/signup" : "/api/login", body);
  if (!ok) return say("auth-message", data?.error || "Could not sign in. Please try again.");
  showSignedIn(data.email);
});

$("sign-out").addEventListener("click", async () => {
  await api("POST", "/api/logout");
  showSignedOut();
});

// ---- the shelf ----

function field(labelText, control) {
  const label = document.createElement("label");
  label.textContent = labelText;
  label.append(control);
  return label;
}

function textInput(value, max) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.maxLength = max;
  return input;
}

function statusSelect(current) {
  const select = document.createElement("select");
  for (const [value, label] of Object.entries(STATUS_LABELS)) {
    select.append(new Option(label, value, false, value === current));
  }
  return select;
}

function ratingSelect(current) {
  const select = document.createElement("select");
  select.append(new Option("Not rated", ""));
  for (let stars = 1; stars <= 5; stars += 1) {
    select.append(new Option(`${stars} of 5`, String(stars), false, stars === current));
  }
  return select;
}

async function patchBook(book, changes, messageBox) {
  const { ok, data } = await api("PATCH", `/api/books/${book.id}`, changes);
  if (!ok) return say(messageBox, data?.error || "Could not save the change.");
  await refreshBooks();
}

function bookItem(book) {
  const item = document.createElement("li");
  item.className = "book";
  item.dataset.id = book.id;

  const title = document.createElement("strong");
  title.className = "book-title";
  title.textContent = book.title;
  const author = document.createElement("span");
  author.className = "book-author";
  author.textContent = ` by ${book.author}`;
  const badge = document.createElement("span");
  badge.className = `badge badge-${book.status}`;
  badge.textContent = STATUS_LABELS[book.status];
  const heading = document.createElement("div");
  heading.className = "book-head";
  heading.append(title, author, badge);
  item.append(heading);

  if (book.notes) {
    const notes = document.createElement("p");
    notes.className = "book-notes";
    notes.textContent = book.notes;
    item.append(notes);
  }

  const message = document.createElement("p");
  message.className = "message";
  message.role = "alert";
  const messageId = `msg-${book.id}`;
  message.id = messageId;

  const status = statusSelect(book.status);
  status.setAttribute("aria-label", `Status of ${book.title}`);
  status.addEventListener("change", () => patchBook(book, { status: status.value }, messageId));
  const controls = document.createElement("div");
  controls.className = "row";
  controls.append(status);

  if (book.status === "finished") {
    const rating = ratingSelect(book.rating);
    rating.setAttribute("aria-label", `Rating of ${book.title}`);
    rating.addEventListener("change", () => patchBook(book, { rating: rating.value ? Number(rating.value) : null }, messageId));
    controls.append(rating);
  }

  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => openEditor(item, book, messageId));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger";
  remove.textContent = "Delete";
  remove.addEventListener("click", async () => {
    const { ok, data } = await api("DELETE", `/api/books/${book.id}`);
    if (!ok) return say(messageId, data?.error || "Could not delete the book.");
    await refreshAll();
  });
  controls.append(edit, remove);
  item.append(controls, message);
  return item;
}

function openEditor(item, book, messageId) {
  if (item.querySelector(".editor")) return;
  const title = textInput(book.title, 200);
  const author = textInput(book.author, 120);
  const notes = textInput(book.notes, 1000);
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Save changes";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "link";
  cancel.textContent = "Cancel";

  const editor = document.createElement("div");
  editor.className = "editor";
  editor.append(field("Title", title), field("Author", author), field("Notes", notes), save, cancel);
  item.append(editor);

  cancel.addEventListener("click", () => editor.remove());
  save.addEventListener("click", () => patchBook(book, { title: title.value, author: author.value, notes: notes.value }, messageId));
}

async function refreshBooks() {
  const query = $("search").value.trim();
  const { ok, status, data } = await api("GET", `/api/books${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  if (status === 401) return showSignedOut();
  if (!ok) return say("list-message", "Could not load your books.");
  say("list-message", "");
  const list = $("book-list");
  list.replaceChildren(...data.books.map(bookItem));
  $("empty").hidden = data.books.length > 0;
  $("empty").textContent = query ? "No books match your search." : "No books yet. Add your first one above.";
  $("average").textContent = data.averageRating === null ? "" : `Average rating of finished books: ${data.averageRating} of 5`;
}

async function refreshGoal() {
  const { ok, data } = await api("GET", "/api/goal");
  if (!ok) return;
  $("goal-summary").textContent = data.target
    ? `${data.finished} of ${data.target} books finished (${data.percent}%)`
    : "No goal set yet.";
  $("goal-bar").value = data.percent;
  if (data.target) $("goal-target").value = data.target;
}

const refreshAll = () => Promise.all([refreshBooks(), refreshGoal()]);

$("add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  say("add-message", "");
  const body = { title: $("add-title").value, author: $("add-author").value, status: $("add-status").value };
  const { ok, data } = await api("POST", "/api/books", body);
  if (!ok) return say("add-message", data?.error || "Could not add the book.");
  $("add-form").reset();
  await refreshAll();
});

$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refreshBooks, 200);
});

$("goal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  say("goal-message", "");
  const { ok, data } = await api("PUT", "/api/goal", { target: Number($("goal-target").value) });
  if (!ok) return say("goal-message", data?.error || "Could not save the goal.");
  await refreshGoal();
});

$("export-button").addEventListener("click", async () => {
  say("list-message", "");
  const { ok, response } = await api("GET", "/api/books/export");
  if (!ok) return say("list-message", "Export failed. Please try again.");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = "shelfmate.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});

// On load: show the shelf if a session cookie is still valid.
(async () => {
  showAuthMode();
  const { ok, data } = await api("GET", "/api/me");
  if (ok) showSignedIn(data.email);
})();
