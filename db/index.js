import pgPromise from "pg-promise";

const pgp = pgPromise();

const db = pgp({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  idle_in_transaction_session_timeout: 60000,
  maxLifetime: 600000,
  allowExitOnIdle: true
});

try {
  await db.none(`
    CREATE TABLE IF NOT EXISTS g_session(
      id serial PRIMARY KEY,
      hash VARCHAR UNIQUE NOT NULL,
      token VARCHAR NOT NULL,
      accessed VARCHAR NOT NULL
    );
  `);
} catch (e) {
  console.log(e);
}

export {
  db
};
