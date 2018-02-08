const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { OAuth } = require("oauth");

let oauth = null;

app.use(bodyParser.json());

app.use((req, res, next) => {
    res.append("Access-Control-Allow-Origin", process.env.URL);
    res.append("Access-Control-Allow-Headers", "Content-Type, x-authorization");
    res.append("Content-Type", "application/json");

    if (req.method === "OPTIONS") {
        res.sendStatus(200);
    }
    else {
        next();
    }
});

app.get("/twitter/request_token", (req, res) => {
    getRequestToken().then(response => {
        res.json({
            statusCode: 200,
            data: response
        });
    }).catch(error => {
        res.json(error);
    });
});

app.post("/twitter/access_token", (req, res) => {
    getAccessToken(req.body).then(response => {
        res.json({
            statusCode: 200,
            data: response
        });
    }).catch(error => {
        res.json(error);
    });
});

app.get("/twitter/user", (req, res, next) => {
    if (!req.headers["x-authorization"]) {
        next();
        return;
    }
    const { oauth_token, oauth_token_secret } = parseHeader(req.headers["x-authorization"]);

    getUser(oauth_token, oauth_token_secret).then(user => {
        res.json({
            statusCode: 200,
            user
        });
    }).catch(error => {
        res.json(error);
    });
});

app.get("/twitter/timeline", (req, res, next) => {
    if (!req.headers["x-authorization"]) {
        next();
        return;
    }
    const { oauth_token, oauth_token_secret } = parseHeader(req.headers["x-authorization"]);

    getTimeline(oauth_token, oauth_token_secret, getParamString(req.url)).then(tweets => {
        res.json({
            statusCode: 200,
            tweets
        });
    }).catch(error => {
        res.json(error);
    });
});

app.listen(process.env.PORT, () => {
    oauth = new OAuth(
        "https://api.twitter.com/oauth/request_token",
        "https://api.twitter.com/oauth/access_token",
        process.env.TWITTER_KEY,
        process.env.TWITTER_KEY_SECRET,
        "1.0A",
        "oob",
        "HMAC-SHA1"
    );
    console.log(`Server running on port ${process.env.PORT}`);
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
        oauth.getOAuthAccessToken(token, tokenSecret, pinCode, (error, token, tokenSecret, results) => {
            if (error) {
                reject(error);
            }
            else {
                resolve({
                    token,
                    tokenSecret,
                    userId: results.user_id,
                    screenName: results.screen_name
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
    const url = `https://api.twitter.com/1.1/statuses/home_timeline.json${str ? `?${str}`: str}`;

    return makeRequest(url, token, secret);
}

function getUser(token, secret) {
    const url = " https://api.twitter.com/1.1/account/verify_credentials.json";

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
