// Cube Core configuration. Cube loads this file (`cube.js`) automatically from
// the project root. The data model lives in ./model (cubes/ + views/).
//
// The database connection is supplied by environment variables, not hard-coded
// here — see .env.example. The standard Postgres set is:
//   CUBEJS_DB_TYPE=postgres
//   CUBEJS_DB_HOST / CUBEJS_DB_PORT / CUBEJS_DB_NAME / CUBEJS_DB_USER / CUBEJS_DB_PASS
// pointed at a database holding @control-ai/db's schema (`runs`, `run_months`,
// `decisions`, `flow_line_items`, `balance_snapshots`).
//
// NOTE on PGlite: @control-ai/db's zero-install local/test database
// (@electric-sql/pglite) is an in-process engine and does NOT expose a
// Postgres wire port for a separate `cube` server to connect to. To run this
// data model locally you need a real Postgres instance (e.g. Docker) seeded
// with the same schema — apply `packages/db/drizzle` migrations against it,
// then run a completed @control-ai/worker run so the fact tables have data.

/** @type {import('@cubejs-backend/server-core').CreateOptions} */
module.exports = {
  // Explicit for clarity; ./model is also Cube's default model directory.
  schemaPath: "model",
};
