import express from "express";
import cors from "cors";

import { router as feedRouter } from "./routes/feed.js";
import { router as twitterRouter } from "./routes/twitter.js";
import { router as owmRouter } from "./routes/owm.js";
import { router as weatherRouter } from "./routes/weather.js";
import { router as wallpaperRouter } from "./routes/wallpaper.js";

const app = express();

app.disable("x-powered-by");
app.use(cors({
  origin: process.env.URL.split(","),
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-authorization"]
}));

app.use(express.json());

app.use("/api/v1/feed", feedRouter);
app.use("/api/v1/twitter", twitterRouter);
app.use("/api/v1/owm", owmRouter);
app.use("/api/v1/weather", weatherRouter);
app.use("/api/v1/wallpaper", wallpaperRouter);

app.listen(process.env.PORT || 8080, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
});
