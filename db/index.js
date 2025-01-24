import pgPromise from "pg-promise";
import { initSession } from "./g_session.js";
import { initMessages } from "./messages.js";

const pgp = pgPromise();

let db = null;

async function getDb() {
  if (db) {
    return db;
  }

  try {
    db = await pgp({
      connectionString: process.env.DATABASE_URL,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      idle_in_transaction_session_timeout: 60000,
      maxLifetime: 600000,
      allowExitOnIdle: true
    });

    initSession(db);
    initMessages(db);
  } catch (e) {
    console.log(e);
  }
  return db;
}

export {
  db,
  getDb
};
