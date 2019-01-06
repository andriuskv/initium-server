const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({
  origin: process.env.URL,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-authorization"]
}));

app.use("/feed", require("./feed.js"));
app.use("/twitter", require("./twitter.js"));
app.use("/owm", require("./owm.js"));

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
