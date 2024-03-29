import express from "express";
import Parser from "rss-parser";
import { decode } from "html-entities";

const router = express.Router();
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
    const parsedFeed = parseFeed(feed);

    res.set("Cache-Control", "public, max-age=300");
    res.json({ feed: parsedFeed });
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
    item.title = decode(item.title);
    return item;
  });
  return feed;
}

export {
  router
};
