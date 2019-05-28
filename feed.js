const express = require("express");
const router = express.Router();
const Parser = require("rss-parser");
const parser = new Parser({
  customFields: {
    feed: [["subtitle", "description"]]
  }
});

router.get("/", (req, res) => {
  if (!req.query.url) {
    res.sendStatus(400);
    return;
  }

  // Treat everything after "?url=" as feed url
  const url = req.url.split("?url=")[1];

  parser.parseURL(url).then(feed => {
    res.json({ feed });
  }).catch(error => {
    res.json({ message: error.message });
  });
});

module.exports = router;
