import express from "express";

const router = express.Router();

router.get("/", async (req, res) => {
  if (req.query.q || (req.query.lat && req.query.lon)) {
    try {
      const params = parseQueryParams(req.query);
      const data = await fetchWeather(params);

      if (data.cod === "404") {
        return res.send({ status: 404, type: "target", message: "Location not found." });
      }
      else if (data.cod === "500") {
        return res.send({ status: 500, type: "general", message: "Could not update weather, try again later." });
      }
      res.set("Cache-Control", "public, max-age=300");

      if (req.query.type === "more") {
        res.send(parseMoreWeather(data, params));
      }
      else {
        res.send(parseWeather(data, params));
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
    url.searchParams.set("lat", params.lat);
    url.searchParams.set("lon", params.lon);
    url.searchParams.set("exclude", "current,minutely,alerts");
  }
  else {
    url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("q", params.q);
  }

  url.searchParams.set("lang", params.lang.locale);
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", process.env.OWM_API_KEY);

  return url;
}

function parseWeather(data, { units }) {
  const { tempUnits, speedUnits } = units;
  const [weather] = data.weather;

  return {
    city: data.name,
    temperature: tempUnits === "c" ?
      Math.round(data.main.temp) :
      convertTemperature(data.main.temp, tempUnits),
    humidity: data.main.humidity,
    description: capitalizeString(weather.description),
    coords: data.coord,
    wind: {
      speed: speedUnits === "m/s" ?
        Math.round(data.wind.speed) :
        convertWindSpeed(data.wind.speed, speedUnits),
      direction: getWindDirection(data.wind.deg)
    },
    iconId: weather.icon,
    icon: getIconUrl(weather.icon)
  };
}

function parseMoreWeather(data, { lang, units }) {
  const { tempUnits, speedUnits } = units;
  const currentDateInSeconds = Date.now() / 1000;
  const hourly = data.hourly
    .filter(item => item.dt + data.timezone_offset > currentDateInSeconds - 3600)
    .slice(0, 25)
    .map(item => {
      return {
        hour: new Date((item.dt + data.timezone_offset) * 1000).getUTCHours(),
        temperature: tempUnits === "c" ?
          Math.round(item.temp) :
          convertTemperature(item.temp, tempUnits),
        precipitation: Math.round(item.pop * 100),
        wind: {
          speed: speedUnits === "m/s" ?
            Math.round(item.wind_speed) :
            convertWindSpeed(item.wind_speed, speedUnits),
          direction: getWindDirection(item.wind_deg)
        }
      };
    });
  const formatter = new Intl.DateTimeFormat(lang.dateLocale, { weekday: "short" });
  const daily = data.daily.map(item => {
    const [weather] = item.weather;

    return {
      temperature: {
        min: tempUnits === "c" ?
          Math.round(item.temp.min) :
          convertTemperature(item.temp.min, tempUnits),
        max: tempUnits === "c" ?
          Math.round(item.temp.max) :
          convertTemperature(item.temp.max, tempUnits)
      },
      weekday: formatter.format(item.dt * 1000),
      description: capitalizeString(weather.description),
      iconId: weather.icon,
      icon: getIconUrl(weather.icon)
    };
  });

  return { hourly, daily };
}

function parseQueryParams(params) {
  const [tempUnits = "c", speedUnits = "m/s"] = params.units ? params.units.split(",") : ["c", "m/s"];
  const [locale = "en", dateLocale = "en"] = params.lang ? params.lang.split(",") : ["en", "en"];

  return {
    ...params,
    units: {
      tempUnits: tempUnits.toLowerCase(),
      speedUnits: speedUnits.toLowerCase()
    },
    lang: {
      locale: locale.toLowerCase(),
      dateLocale: dateLocale.toLowerCase()
    }
  };
}

function convertTemperature(value, units) {
  if (units === "f") {
    value = value * 1.8 + 32;
  }
  else {
    value = (value - 32) / 1.8;
  }
  return Math.round(value);
}

function convertWindSpeed(value, units) {
  if (units === "m/s") {
    value = value * 0.3048;
  }
  else {
    value = value / 0.3048;
  }
  return Math.round(value);
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
