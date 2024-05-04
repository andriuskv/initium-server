import express from "express";

const router = express.Router();

router.get("/", async (req, res) => {
  if (req.query.q || (req.query.lat && req.query.lon)) {
    try {
      const params = parseQueryParams(req.query);
      const data = await fetchWeather(params);

      if (!data) {
        return res.send({ status: 500, type: "general", message: "Could not update weather, try again later." });
      }
      else if (data.code === 404) {
        return res.send({ status: 404, type: "target", message: "Location not found." });
      }
      res.set("Cache-Control", "public, max-age=600");

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

async function fetchWeather(params) {
  const { name, lat, lon, code } = await fetchCoords(params);

  if (code) {
    return { code };
  }
  params.name = name;
  params.lat = round(lat, 4);
  params.lon = round(lon, 4);

  const url = buildUrl(params);
  const json = await fetch(url).then(res => res.json());

  json.location = params.name;
  return json;
}

async function fetchCoords({ q, lat, lon }) {
  let url = null;

  if (q) {
    url = new URL("http://api.openweathermap.org/geo/1.0/direct");

    url.searchParams.set("q", q);
  }
  else {
    url = new URL("http://api.openweathermap.org/geo/1.0/reverse");

    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
  }
  url.searchParams.set("appid", process.env.OWM_API_KEY);

  const json = await fetch(url).then(res => res.json());

  console.log(json);

  if (Array.isArray(json) && json.length) {
    return {
      name: json[0].name,
      lat: json[0].lat,
      lon: json[0].lon
    };
  }
  return { code: 404 };
}

function buildUrl(params) {
  let url = null;

  if (params.type === "more") {
    const { start, end } = getDateRange();
    url = new URL(`${process.env.W_URL}/${params.lat},${params.lon}/${start.string}/${end.string}`);

    url.searchParams.set("include", "days,hours");
    url.searchParams.set("elements", "datetime,datetimeEpoch,resolvedAddress,tempmax,tempmin,temp,precipprob,windspeed,winddir,description,icon");
  }
  else {
    if (params.q) {
      url = new URL(`${process.env.W_URL}/${params.q}`);
    }
    else {
      url = new URL(`${process.env.W_URL}/${params.lat},${params.lon}`);
    }
    url.searchParams.set("include", "current");
    url.searchParams.set("elements", "datetimeEpoch,resolvedAddress,latitude,longitude,temp,humidity,precipprob,windspeed,winddir,conditions,icon");

  }
  url.searchParams.set("unitGroup", "metric");
  url.searchParams.set("key", process.env.W_API_KEY);

  return url;
}

function parseWeather(data, { units }) {
  const { tempUnits, speedUnits } = units;
  const { currentConditions } = data;

  return {
    location: data.location || data.resolvedAddress,
    temperature: tempUnits === "c" ?
      Math.round(currentConditions.temp) :
      convertTemperature(currentConditions.temp, tempUnits),
    humidity: Math.round(currentConditions.humidity),
    precipitation: Math.round(currentConditions.precipprob),
    description: capitalizeString(currentConditions.conditions),
    coords: { lat: data.latitude, lon: data.longitude },
    wind: {
      speed: convertWindSpeed(currentConditions.windspeed, speedUnits),
      direction: getWindDirection(currentConditions.winddir)
    },
    ...getIconUrl(currentConditions.icon, new Date(currentConditions.datetimeEpoch * 1000).getHours())
  };
}

function parseMoreWeather(data, { lang, units }) {
  const { tempUnits, speedUnits } = units;
  const currentDateInSeconds = Date.now() / 1000;
  const tzoffset = data.tzoffset * 3600;

  const hourly = [].concat(data.days[0].hours, data.days[1].hours)
    .filter(item => item.datetimeEpoch > currentDateInSeconds - 3600)
    .slice(0, 25)
    .map(item => {
      return {
        hour: new Date((item.datetimeEpoch + tzoffset) * 1000).getUTCHours(),
        temperature: tempUnits === "c" ?
          Math.round(item.temp) :
          convertTemperature(item.temp, tempUnits),
        precipitation: Math.round(item.precipprob),
        wind: {
          speed: convertWindSpeed(item.windspeed, speedUnits),
          direction: getWindDirection(item.winddir)
        }
      };
    });
  const formatter = new Intl.DateTimeFormat(lang.dateLocale, { weekday: "short" });
  const daily = data.days.map(item => ({
    temperature: {
      min: tempUnits === "c" ?
        Math.round(item.tempmin) :
        convertTemperature(item.tempmin, tempUnits),
      max: tempUnits === "c" ?
        Math.round(item.tempmax) :
        convertTemperature(item.tempmax, tempUnits)
    },
    weekday: formatter.format((item.datetimeEpoch + tzoffset) * 1000),
    description: capitalizeString(item.description),
    ...getIconUrl(item.icon)
  }));

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
  let converted = value * 1000 / 3600;

  if (units === "ft/s") {
    converted = converted / 0.3048;
  }
  return {
    value: Math.round(converted),
    raw: round(converted, 3)
  };
}

function getIconUrl(id, hours = 0) {
  const icons = {
    "clear-day": "01d",
    "clear-night": "01n",
    "partly-cloudy-day": "02d",
    "partly-cloudy-night": "02n",
    "cloudy": Math.random() > 0.5 ? "03d": "04d",
    "showers-day": "09d",
    "showers-night": "09n",
    "rain": hours >= 18 ? "10n" : "10d",
    "thunder-rain": "11d",
    "thunder-showers-day": "11d",
    "thunder-showers-night": "11n",
    "thunder": "11d",
    "snow": "13d",
    "snow-showers-day": "13d",
    "snow-showers-night": "13n",
    "rain-snow": "13d",
    "rain-snow-showers-day": "13d",
    "rain-snow-showers-night": "13n",
    "hail": "13d",
    "fog": "50d"
  };
  const iconId = icons[id] || (hours >= 18 ? "01n" : "01d");

  return {
    icon: `https://openweathermap.org/img/wn/${iconId}@2x.png`,
    iconId
  };
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

function getDateRange() {
  const startDate = new Date();
  const start = {
    year: startDate.getFullYear(),
    month: startDate.getMonth(),
    day: startDate.getDate()
  };
  const endDate = new Date(start.year, start.month, start.day + 7);
  const end = {
    year: endDate.getFullYear(),
    month: endDate.getMonth(),
    day: endDate.getDate()
  };

  return {
    start: {
      ...start,
      string: `${start.year}-${pad(start.month + 1)}-${pad(start.day)}`
    },
    end: {
      ...end,
      string: `${end.year}-${pad(end.month + 1)}-${pad(end.day)}`
    }
  };
}

function round(number, decimals) {
  return Math.round((number + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
}

function pad(value) {
  return value.toString().padStart(2, "0");
}

export {
  router
};
