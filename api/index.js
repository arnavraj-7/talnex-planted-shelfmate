// Vercel entry: every /api/* call lands here. Data goes to the Blob store because a function keeps nothing between calls.
const { serve } = require("../lib/http");
const { createRouter } = require("../lib/router");
const { createStore } = require("../lib/store");

const router = createRouter({ store: createStore() });

module.exports = (req, res) => serve(router, req, res);
