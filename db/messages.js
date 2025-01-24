import { getRandomString } from "../utils.js";
import { getDb } from "./index.js";

async function initMessages(db) {
  await db.none(`
    CREATE TABLE IF NOT EXISTS messages(
      id VARCHAR PRIMARY KEY,
      type VARCHAR,
      title VARCHAR,
      content VARCHAR NOT NULL,
      expires BIGINT NOT NULL,
      duration INT
    );
  `);
  await removeExpiredItems(db);
}

async function getMessages() {
  const db = await getDb();
  const messages = await db.manyOrNone("SELECT * FROM messages");

  if (messages) {
    return messages.map(message => {
      if (message.duration) {
        message.duration = Number(message.duration);
      }
      message.expires = Number(message.expires);
      return message;
    });
  }
  return [];
}

async function addMessage({ content, type, title = "System", expires = Date.now() + (7 * 24 * 60 * 60 * 1000), duration }) {
  const db = await getDb();
  const id = getRandomString();
  return db.none("INSERT INTO messages (id, type, title, content, expires, duration) VALUES($1, $2, $3, $4, $5, $6)", [id, type, title, content, expires, duration]);
}

function removeExpiredItems(db) {
  const now = Date.now();
  return db.none("DELETE FROM messages WHERE expires < $1", now);
}

export {
  initMessages,
  getMessages,
  addMessage
};
