# ShelfMate

A small reading tracker. Keep a shelf of the books you want to read, are reading and have finished. It has a web page and a JSON API, and every reader sees only their own shelf.

Run it locally with `npm install` then `npm start` (it listens on port 3000), and open http://localhost:3000.

## Features

1. **Create an account with an email and a password.** The password needs at least 8 characters, and an email that is already used is turned away.
2. **Sign in and sign out.** A wrong email or password shows a clear message and stays on the sign-in page.
3. **Add a book with a title and an author.** A book with no title or no author is rejected with a message.
4. **See your books and search them.** Type in the search box and the list narrows to books whose title or author matches.
5. **Edit or delete a book.** Change the title, author or notes, or remove the book from the shelf.
6. **Set a reading status.** Mark a book as Want to read, Reading or Finished, and the badge on the book changes.
7. **Rate finished books from 1 to 5.** The list shows the average rating of the finished books.
8. **Export your shelf as a CSV file.** The Export CSV button downloads every book with its title, author, status and rating.
9. **Set a yearly reading goal.** Pick how many books to finish this year and a progress bar shows how many you have finished.

## API

All routes except sign-up and sign-in need a signed-in session (a cookie, or `Authorization: Bearer <token>`).

| Method and path | What it does |
|---|---|
| `POST /api/signup`, `POST /api/login`, `POST /api/logout` | Account and session |
| `GET /api/me` | Who is signed in |
| `GET /api/books?q=` | List and search books |
| `POST /api/books` | Add a book |
| `PATCH /api/books/:id`, `DELETE /api/books/:id` | Edit, rate, change status, or delete |
| `GET /api/books/export` | CSV download |
| `GET /api/goal`, `PUT /api/goal` | Reading goal and progress |

## Code layout

- `local-server.js` runs the page and API locally; `api/index.js` is the same API as a Vercel function.
- `lib/router.js` holds every route, `lib/books.js` the shelf rules, `lib/auth.js` passwords and sessions, `lib/validate.js` the input checks, `lib/store.js` where data is kept.

## Tests

`npm test`
