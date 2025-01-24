import express from "express";
import { getMessages } from "../db/messages.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const messages = await getMessages();
    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

export { router };
