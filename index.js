const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({
  origin: process.env.URL,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-authorization"]
}));

app.use("/api/feed", require("./feed.js"));
app.use("/api/twitter", require("./twitter.js"));
app.use("/api/owm", require("./owm.js"));

app.get("/feed", redirect);
app.get("/twitter", redirect);
app.get("/owm", redirect);

function redirect(req, res) {
  res.redirect(301, `/api${req.originalUrl}`);
}

app.listen(process.env.PORT || 8080, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
});
