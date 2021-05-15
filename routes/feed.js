const express = require("express");
const router = express.Router();
const Parser = require("rss-parser");
const parser = new Parser({
  customFields: {
    feed: [["subtitle", "description"]],
    item: [["media:group", "group"]]
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

    res.json({ feed: parseFeed(feed) });
  } catch (e) {
    res.json({ message: e.message });
  }
});

function parseFeed(feed) {
  feed.items = feed.items.map(item => {
    const group = item.group;

    if (group) {
      delete item.group;
      item.thumbnail = group["media:thumbnail"][0].$.url;
      item.content = group["media:description"][0];
    }
    return item;
  });
  return feed;
}

module.exports = router;
