import express from "express";
import cors from "cors";

import { router as feedRouter } from "./routes/feed.js";
import { router as twitterRouter } from "./routes/twitter.js";
import { router as owmRouter } from "./routes/owm.js";

const app = express();

app.use(cors({
  origin: process.env.URL,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-authorization"]
}));

app.use(express.json());

app.use("/api/v1/feed", feedRouter);
app.use("/api/v1/twitter", twitterRouter);
app.use("/api/v1/owm", owmRouter);

app.listen(process.env.PORT || 8080, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
});
