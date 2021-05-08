const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({
  origin: process.env.URL,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-authorization"]
}));

app.use("/api/v1/feed", require("./routes/feed.js"));
app.use("/api/v1/twitter", require("./routes/twitter.js"));
app.use("/api/v1/owm", require("./routes/owm.js"));

app.use("/api/feed", require("./routes/feed.js"));
app.use("/api/twitter", require("./routes/twitter-deprecated.js"));
app.use("/api/owm", require("./routes/owm-deprecated.js"));

app.listen(process.env.PORT || 8080, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
});
