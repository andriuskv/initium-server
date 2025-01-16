import { getDb } from "./index.js";
import { createHash } from "node:crypto";

function getRow(hash, db) {
  return db.oneOrNone("SELECT * FROM g_session WHERE hash = $1", hash);
}

function getHash(string) {
  return createHash("sha512").update(string).digest("hex").slice(0, 32);
}

async function setItem(item) {
  const db = await getDb();
  const hash = getHash(item.email);
  const row = await getRow(hash, db);

  if (row) {
    return db.none("UPDATE g_session SET token = $2, accessed = $3 WHERE hash = $1", [hash, item.token, Date.now()]);
  }
  return db.none("INSERT INTO g_session (hash, token, accessed) VALUES($1, $2, $3)", [hash, item.token, Date.now()]);
}

async function getItem(email) {
  const db = await getDb();
  const hash = getHash(email);
  const row = await getRow(hash, db);

  if (!row) {
    return;
  }
  const now = Date.now();
  const gap = 5 * 30 * 24 * 60 * 60 * 1000;

  if (Number(row.accessed) + gap < now) {
    remoevItem(row.id);
    return { message: "Session expired. Log in again." };
  }
  updateAccessDate(row, db);
  return row;
}

async function remoevItem(id) {
  const db = await getDb();

  db.none("DELETE FROM g_session WHERE id = $1", id);
}

async function removeItemWithEmail(email) {
  const db = await getDb();

  const hash = getHash(email);
  db.none("DELETE FROM g_session WHERE hash = $1", hash);
}

function updateAccessDate(item, db) {
  db.none("UPDATE g_session SET accessed = $2 WHERE hash = $1", [item.hash, Date.now()]);
}

export {
  setItem,
  getItem,
  remoevItem,
  removeItemWithEmail
};
