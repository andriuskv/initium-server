const express = require("express");
const router = express.Router();
const NodeCache = require("node-cache");
const Parser = require("rss-parser");
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
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
    const value = cache.get(url);

    if (value) {
      res.json({ feed: value });
    }
    else {
      const feed = await parser.parseURL(url);
      const parsedFeed = parseFeed(feed);

      cache.set(url, parsedFeed);
      res.json({ feed: parsedFeed });
    }
  } catch (e) {
    console.log(e);
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
