const express = require("express");
const router = express.Router();
const Parser = require("rss-parser");
const parser = new Parser({
  customFields: {
    feed: [["subtitle", "description"]]
  }
});

router.get("/", async (req, res) => {
  if (!req.query.url) {
    res.sendStatus(400);
    return;
  }
  // Treat everything after "?url=" as a feed url
  const url = req.url.split("?url=")[1];

  try {
    const feed = await parser.parseURL(url);

    res.json({ feed });
  } catch (e) {
    res.json({ message: e.message });
  }
});

module.exports = router;
