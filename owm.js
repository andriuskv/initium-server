const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

router.get("/", (req, res) => {
  if (req.query.q || (req.query.lat && req.query.lon)) {
    fetchWeather(req.query).then(data => {
      res.send(data);
    }).catch(error => {
      res.json(error);
    });
  }
  else {
    res.sendStatus(400);
  }
});

function fetchWeather(params) {
  const url = new URL("http://api.openweathermap.org/data/2.5/weather");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", process.env.OWM_API_KEY);

  return fetch(url).then(response => response.json());
}

module.exports = router;
