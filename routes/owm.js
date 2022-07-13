import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/", async (req, res) => {
  if (req.query.q || (req.query.lat && req.query.lon)) {
    try {
      const { type, units, timestamp } = req.query;
      const data = await fetchWeather(req.query);

      if (data.cod === "404") {
        return res.send({ status: 404, type: "target", message: "Location not found." });
      }
      else if (data.cod === "500") {
        return res.send({ status: 500, type: "general", message: "Could not update weather, try again later." });
      }

      if (type === "more") {
        res.send(parseMoreWeather(data, units, timestamp));
      }
      // Deprecated
      else if (type === "hourly") {
        res.send({ hourly: parseHourlyWeather(data, units) });
      }
      else {
        res.send(parseWeather(data, units));
      }
    } catch (e) {
      res.status(500).json(e);
    }
  }
  else {
    res.sendStatus(400);
  }
});

function fetchWeather(params) {
  const url = getUrl(params);
  return fetch(url).then(res => res.json());
}

function getUrl(params) {
  let url = null;

  if (params.type === "more") {
    url = new URL("https://api.openweathermap.org/data/2.5/onecall");
    delete params.type;
    url.searchParams.set("exclude", "current,minutely,alerts");
  }
  else if (params.type === "hourly") {
    url = new URL("https://api.openweathermap.org/data/2.5/onecall");
    delete params.type;
    url.searchParams.set("exclude", "current,minutely,daily");
  }
  else {
    url = new URL("https://api.openweathermap.org/data/2.5/weather");
  }

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", process.env.OWM_API_KEY);
  return url;
}

function parseWeather(data, units) {
  const [weather] = data.weather;

  return {
    city: data.name,
    temperature: units === "C" ?
      Math.round(data.main.temp) :
      convertTemperature(data.main.temp, units),
    humidity: data.main.humidity,
    description: capitalizeString(weather.description),
    coords: data.coord,
    wind: {
      speed:  Math.round(data.wind.speed),
      direction: getWindDirection(data.wind.deg)
    },
    icon: getIconUrl(weather.icon)
  };
}

function parseHourlyWeather(data, units) {
  return data.hourly.map(item => {
    return {
      hour: new Date(item.dt * 1000).getHours(),
      temperature: units === "C" ?
        Math.round(item.temp) :
        convertTemperature(item.temp, units),
      icon: getIconUrl(item.weather[0].icon)
    };
  });
}

function parseMoreWeather(data, units, timestamp = Date.now()) {
  console.log(timestamp, Date.now());
  const currentDateInSeconds = timestamp / 1000;
  const hourly = data.hourly
    .filter(item => item.dt + data.timezone_offset > currentDateInSeconds - 3600)
    .slice(0, 25)
    .map(item => {
      return {
        hour: new Date((item.dt + data.timezone_offset) * 1000).getHours(),
        temperature: units === "C" ?
          Math.round(item.temp) :
          convertTemperature(item.temp, units),
        precipitation: Math.round(item.pop * 100),
        wind: {
          speed: Math.round(item.wind_speed),
          direction: getWindDirection(item.wind_deg)
        }
      };
    });
  const daily = data.daily.map(item => {
    const [weather] = item.weather;
    const weekday = new Intl.DateTimeFormat(["en"], {
      weekday: "short"
    }).format(item.dt * 1000);

    return {
      temperature: {
        min: units === "C" ?
          Math.round(item.temp.min) :
          convertTemperature(item.temp.min, units),
        max:units === "C" ?
          Math.round(item.temp.max) :
          convertTemperature(item.temp.max, units)
      },
      weekday,
      description: capitalizeString(weather.description),
      icon: getIconUrl(weather.icon)
    };
  });

  return { hourly, daily };
}

function convertTemperature(temp, units) {
  if (units === "F") {
    temp = temp * 1.8 + 32;
  }
  else {
    temp = (temp - 32) / 1.8;
  }
  return Math.round(temp);
}

function getIconUrl(icon) {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

function capitalizeString(string) {
  return string[0].toUpperCase() + string.slice(1);
}

function getWindDirection(degrees) {
  let name = "";

  if (degrees > 337.5 || degrees <= 22.5) {
    name = "North";
  }
  else if (degrees > 22.5 && degrees <= 67.5) {
    name = "Northeast";
  }
  else if (degrees > 67.5 && degrees <= 112.5) {
    name = "East";
  }
  else if (degrees > 112.5 && degrees <= 157.5) {
    name = "Southeast";
  }
  else if (degrees > 157.5 && degrees <= 202.5) {
    name = "South";
  }
  else if (degrees > 202.5 && degrees <= 247.5) {
    name = "Southwest";
  }
  else if (degrees > 247.5 && degrees <= 292.5) {
    name = "West";
  }
  else if (degrees > 292.5 && degrees <= 337.5) {
    name = "Northwest";
  }
  return { name, degrees };
}

export {
  router
};
