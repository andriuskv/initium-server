const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const { OAuth } = require("oauth");

const oauth = new OAuth(
  "https://api.twitter.com/oauth/request_token",
  "https://api.twitter.com/oauth/access_token",
  process.env.TWITTER_KEY,
  process.env.TWITTER_KEY_SECRET,
  "1.0A",
  "oob",
  "HMAC-SHA1"
);

router.use(bodyParser.json());

router.get("/request_token", (req, res) => {
  getRequestToken().then(response => {
    res.json(response);
  }).catch(error => {
    res.json(error);
  });
});

router.post("/access_token", (req, res) => {
  getAccessToken(req.body).then(response => {
    res.json(response);
  }).catch(error => {
    res.json(error);
  });
});

router.get("/user", (req, res, next) => {
  const header = req.headers["x-authorization"];

  if (!header) {
    next();
    return;
  }
  const { oauth_token, oauth_token_secret } = parseHeader(header);

  getUser(oauth_token, oauth_token_secret).then(user => {
    res.json({ user });
  }).catch(error => {
    res.json(error);
  });
});

router.get("/timeline", (req, res, next) => {
  const header = req.headers["x-authorization"];

  if (!header) {
    next();
    return;
  }
  const { oauth_token, oauth_token_secret } = parseHeader(header);

  getTimeline(oauth_token, oauth_token_secret, getParamString(req.url)).then(tweets => {
    res.json({ tweets });
  }).catch(error => {
    res.json(error);
  });
});

function getRequestToken() {
  return new Promise((resolve, reject) => {
    oauth.getOAuthRequestToken((error, token, tokenSecret) => {
      if (error) {
        reject(error);
      }
      else {
        resolve({
          token,
          tokenSecret,
          url: `https://api.twitter.com/oauth/authenticate?oauth_token=${token}`
        });
      }
    });
  });
}

function getAccessToken({ token, tokenSecret, pinCode }) {
  return new Promise((resolve, reject) => {
    oauth.getOAuthAccessToken(token, tokenSecret, pinCode, (error, token, tokenSecret) => {
      if (error) {
        reject(error);
      }
      else {
        resolve({
          token,
          tokenSecret
        });
      }
    });
  });
}

function parseHeader(header) {
  return header.split(" ").slice(1).reduce((obj, str) => {
    const [key, value] = str.split("=");
    obj[key] = value;
    return obj;
  }, {});
}

function getParamString(url) {
  return url.split("?")[1] || "";
}

function getTimeline(token, secret, str) {
  const url = `https://api.twitter.com/1.1/statuses/home_timeline.json${str ? `?${str}` : str}`;

  return makeRequest(url, token, secret);
}

function getUser(token, secret) {
  const url = "https://api.twitter.com/1.1/account/verify_credentials.json";

  return makeRequest(url, token, secret);
}

function makeRequest(url, token, secret) {
  return new Promise((resolve, reject) => {
    oauth.get(url, token, secret, (error, body) => {
      if (error) {
        error.data = JSON.parse(error.data);
        reject(error);
      }
      else {
        resolve(JSON.parse(body));
      }
    });
  });
}

module.exports = router;
