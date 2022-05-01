import express from "express";
import { OAuth } from "oauth";
import { formatTime, getMonth } from "../utils.js";

const router = express.Router();
const oauth = new OAuth(
  "https://api.twitter.com/oauth/request_token",
  "https://api.twitter.com/oauth/access_token",
  process.env.TWITTER_KEY,
  process.env.TWITTER_KEY_SECRET,
  "1.0A",
  "oob",
  "HMAC-SHA1"
);

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

router.get("/user", async (req, res, next) => {
  const header = req.headers["x-authorization"];

  if (!header) {
    next();
    return;
  }
  const { oauth_token, oauth_token_secret } = parseHeader(header);

  try {
    const user = await fetchUser(oauth_token, oauth_token_secret);

    res.json({
      name: user.name,
      homepage: `https://twitter.com/${user.screen_name}`,
      handle: `@${user.screen_name}`,
      profileImage: user.profile_image_url_https,
      profileColor: `#${user.profile_link_color}`
    });
  } catch (e) {
    res.json(e);
  }
});

router.get("/users/:handle", async (req, res, next) => {
  const header = req.headers["x-authorization"];

  if (!header) {
    next();
    return;
  }
  const { oauth_token, oauth_token_secret } = parseHeader(header);

  try {
    const user = await fetchUserByHandle(req.params.handle, oauth_token, oauth_token_secret);

    res.json(parseTweetUser(user));
  } catch (e) {
    if (e.data?.errors?.length) {
      const [error] = e.data.errors;

      if (error.code === 63) {
        res.json({
          name: req.params.handle,
          handle: `@${req.params.handle}`,
          url: `https://twitter.com/${req.params.handle}`,
          description: "Account suspended",
          suspended: true
        });
      }
      else {
        res.json(e);
      }
    }
    else {
      res.json(e);
    }
  }
});

router.get("/timeline", async (req, res, next) => {
  const header = req.headers["x-authorization"];

  if (!header) {
    next();
    return;
  }
  const { oauth_token, oauth_token_secret } = parseHeader(header);

  try {
    const timeline = await fetchTimeline(oauth_token, oauth_token_secret, req.url);
    const tweets = parseTweets(timeline);

    res.json({ tweets });
  } catch (e) {
    console.log(e);
    res.json(e);
  }
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

function fetchTimeline(token, secret, reqUrl) {
  const params = reqUrl.split("?")[1] || "";
  const url = `https://api.twitter.com/1.1/statuses/home_timeline.json${params ? `?${params}` : params}`;

  return makeRequest(url, token, secret);
}

function fetchUser(token, secret) {
  const url = "https://api.twitter.com/1.1/account/verify_credentials.json";

  return makeRequest(url, token, secret);
}

function fetchUserByHandle(handle, token, secret) {
  const url = `https://api.twitter.com/1.1/users/show.json?screen_name=${handle}`;

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

function parseTweets(tweets) {
  return tweets.map(tweet => {
    const retweet = tweet.retweeted_status;

    if (retweet) {
      const newTweet = getTweetContent(retweet);

      newTweet.id = tweet.id_str;
      newTweet.retweetedBy = parseTweetUser(tweet.user);
      return newTweet;
    }
    return getTweetContent(tweet);
  });
}

function parseTweetUser(user) {
  return {
    name: user.name,
    handle: `@${user.screen_name}`,
    url: `https://twitter.com/${user.screen_name}`,
    profileImageUrl: user.profile_image_url_https,
    description: getUserDescription(user),
    verified: user.verified,
    following: user.following,
    followerCount: formatCounter(user.followers_count),
    followingCount: formatCounter(user.friends_count)
  };
}

function getTweetContent(tweet, isQuotedTweet = false) {
  const screenName = tweet.user.screen_name;
  const userUrl = `https://twitter.com/${screenName}`;
  const media = tweet.extended_entities?.media;
  const quotedTweet = getQuotedTweet(tweet);
  const entities = getEntities({ ...tweet.entities, media });

  return {
    user: parseTweetUser(tweet.user),
    id: tweet.id_str,
    quotedTweet,
    tweetUrl: `${userUrl}/status/${tweet.id_str}`,
    text: replaceEntities(tweet.full_text, entities, quotedTweet, isQuotedTweet),
    date: getTweetDate(tweet.created_at),
    media: getMedia(entities.media),
    retweetCount: formatCounter(tweet.retweet_count),
    likeCount: formatCounter(tweet.favorite_count)
  };
}

function getUserDescription(user) {
  const entities = getEntities(user.entities.description);
  const description = replaceEntities(user.description, entities);

  return replaceUserDescriptionMentions(description);
}

function getQuotedTweet(tweet) {
  if (tweet.quoted_status) {
    return {
      ...getTweetContent(tweet.quoted_status, true),
      placeholderUrl: tweet.quoted_status_permalink.url
    };
  }
}

function getEntities(entities) {
  return {
    hashtags: getEntity(entities.hashtags),
    userMentions: getEntity(entities.user_mentions),
    urls: getEntity(entities.urls),
    media: getEntity(entities.media)
  };
}

function getEntity(entity) {
  return entity?.length ? entity : [];
}

function replaceUserDescriptionMentions(description) {
  const regex = /(^|[\s])([@＠]\w+)\b/gi;

  return description.replace(regex, (match, g1, g2) => {
    const href = `https://twitter.com/${g2}`;
    return match.replace(g2, `<a href="${href}" class="tweet-link" target="_blank">${g2}</a>`);
  });
}

function replaceEntities(text, entities, quotedTweet, isQuotedTweet) {
  if (entities.userMentions.length) {
    text = replaceUserMentions(text, entities.userMentions, isQuotedTweet);
  }

  if (entities.hashtags.length) {
    text = replaceHashtags(text, entities.hashtags, isQuotedTweet);
  }

  if (entities.urls.length) {
    text = replaceUrls(text, entities.urls, quotedTweet, isQuotedTweet);
  }

  if (entities.media.length) {
    text = text.replace(entities.media[0].url, "").trim();
  }

  return text;
}

function replaceUserMentions(text, userMentions, isQuotedTweet) {
  userMentions.forEach(user => {
    const screenNameRegex = new RegExp(`[@＠]${user.screen_name}\\b`, "gi");
    const mention = text.match(screenNameRegex)[0];
    const mentionRegex = new RegExp(`${mention}\\b`, "g");
    const href = `https://twitter.com/${user.screen_name}`;
    const replacement = isQuotedTweet ? `<span>${mention}</span>` : `<a href="${href}" class="tweet-link handle" target="_blank">${mention}</a>`;

    text = text.replace(mentionRegex, replacement);
  });
  return text;
}

function replaceHashtags(text, hashtags, isQuotedTweet) {
  hashtags.forEach(({ text: hashtag }) => {
    const regex = new RegExp(`#${hashtag}\\b`, "g");
    const href = `https://twitter.com/hashtag/${hashtag}?src=hash`;
    const replacement = isQuotedTweet ? `<span>#${hashtag}</span>` : `<a href="${href}" class="tweet-link" target="_blank">#${hashtag}</a>`;

    text = text.replace(regex, replacement);
  });
  return text;
}

function replaceUrls(text, urls, quotedTweet, isQuotedTweet) {
  const tweetUrl = quotedTweet ? quotedTweet.placeholderUrl : "";

  urls.filter(({ url }, index) => {
    return index === urls.findIndex(obj => obj.url === url);
  }).forEach(({ url, display_url }) => {
    const regex = new RegExp(url, "g");
    let replacement = "";

    if (isQuotedTweet) {
      replacement = `<span>${display_url}</span>`;
    }
    else if (tweetUrl !== url) {
      replacement = `<a href="${url}" class="tweet-link" target="_blank">${display_url}</a>`;
    }
    text = text.replace(regex, replacement);
  });
  return text.trim();
}

function getTweetDate(createdAt) {
  const currentDate = new Date();
  const creationDate = new Date(createdAt);
  const minuteDiff = Math.round((currentDate - creationDate) / 1000 / 60);
  let at = "";

  if (minuteDiff < 60) {
    at = `${minuteDiff}m`;
  }
  else if (minuteDiff <= 1440) {
    at = `${Math.round(minuteDiff / 60)}h`;
  }
  else if (minuteDiff <= 1500) {
    at = "1d";
  }
  else {
    const month = getMonth(creationDate.getMonth(), true);
    at = `${month} ${creationDate.getDate()}`;
  }
  return {
    createdAt,
    at
  };
}

function getMedia(media) {
  const maxWidth = 500;
  const containerWidth = maxWidth / 2;
  let containerHeight = 284;

  if (media.length > 2) {
    containerHeight /= 2;
  }
  return media.map((item, index) => {
    if (item.type === "animated_gif") {
      return {
        type: "gif",
        thumbUrl: item.media_url_https,
        height: Math.ceil(maxWidth * item.sizes.medium.h / item.sizes.medium.w),
        url: item.video_info.variants[0].url
      };
    }

    if (item.type === "video") {
      const durationInSeconds = Math.round(item.video_info.duration_millis / 1000);
      const duration = formatDuration(durationInSeconds);

      return {
        duration,
        durationInSeconds,
        type: item.type,
        thumbUrl: item.media_url_https,
        height: Math.ceil(maxWidth * item.sizes.medium.h / item.sizes.medium.w),
        sources: getVideoSources(item.video_info.variants)
      };
    }
    const { w, h } = item.sizes.medium;
    let height = containerHeight;
    let smallestDimension = "";

    if (index === 0 && media.length === 3) {
      height = containerHeight * 2;
    }

    if (w * height / containerWidth > h) {
      smallestDimension = "height";
    }
    else {
      smallestDimension = "width";
    }
    return {
      type: item.type,
      url: item.media_url_https,
      smallestDimension
    };
  });
}

function formatDuration(seconds) {
  if (!seconds) {
    return "";
  }
  return formatTime(seconds);
}

function getVideoSources(items) {
  const sortedItems = items.filter(item => item.bitrate).sort((a, b) => b.bitrate - a.bitrate);
  const qualities = ["high", "medium", "low"];
  const sources = {};

  for (let i = 0; i < sortedItems.length; i += 1) {
    if (qualities[i]) {
      sources[qualities[i]] = sortedItems[i].url;
    }
  }

  return sources;
}

function roundTo(number, places) {
  return Number(`${Math.round(number + "e" + places)}e-${places}`);
}

function formatCounter(value) {
  if (value < 1000) {
    return value;
  }
  let divisor = 1e3;
  let symbol = "K";

  if (value >= 1e6) {
    divisor = 1e6;
    symbol = "M";
  }
  const roundedValue = roundTo(value / divisor, 1).toFixed(1);

  return roundedValue + symbol;
}

export {
  router
};
