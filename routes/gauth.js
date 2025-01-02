import express from "express";
import { google } from "googleapis";
import { getItem, setItem, remoevItem, removeItemWithEmail } from "../db/g_session.js";

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.G_CLIENT_ID,
  process.env.G_CLIENT_SECRET,
  process.env.G_CLIENT_REDIRECT
);

router.get("/", async (req, res) => {
  try {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar"
      ]
    });

    res.json({ url });
  } catch {
    res.status(500).json({ error: "Failed to generate auth URL." });
  }
});

router.get("/callback", async (req, res) => {
  if (req.query.code) {
    try {
      const { tokens } = await oauth2Client.getToken(req.query.code);

      if (tokens.refresh_token) {
        const json = await fetchUser(tokens.access_token);

        if (json.error) {
          res.redirect(`/api/v1/gauth/callback?error="Failed to fetch user.\n${json.error.message}`);
          return;
        }
        await setItem({
          email: json.emailAddresses[0].value,
          token: tokens.refresh_token
        });
        res.redirect(`/api/v1/gauth/callback?at=${tokens.access_token}&e=${tokens.expiry_date}`);
      }
      else {
        const user = await fetchUser(tokens.access_token);

        if (user.error) {
          await fetch(`${process.env.URL}/api/v1/gauth/revoke?token=${tokens.access_token}`).then(res => res.json());
          res.redirect(`/api/v1/gauth/callback?error=Failed to authenticate. Try again later.`);
          return;
        }
        const email = user.emailAddresses[0].value;
        const json = await fetch(`${process.env.URL}/api/v1/gauth/refresh?email=${email}`).then(res => res.json());

        if (json.error) {
          removeItemWithEmail(email);
          await fetch(`${process.env.URL}/api/v1/gauth/revoke?token=${tokens.access_token}`).then(res => res.json());
          res.redirect(`/api/v1/gauth/callback?error=${json.error}`);
          return;
        }
        res.redirect(`/api/v1/gauth/callback?at=${json.at}&e=${json.e}`);
      }
    } catch (e) {
      console.log(e);
      res.redirect(`/api/v1/gauth/callback?error=Something went wrong. Please try again.`);
    }
  }
  else if (req.query.error) {
    res.send(`
      <body>${req.query.error}</body>
      <script>
        const params = new URLSearchParams(window.location.search);
        window.opener.postMessage({
          error: params.get("error")
        }, "chrome-extension://jmefobebfekofkbpfmjkmhjgaaaojkml");
      </script>
    `);
  }
  else if (req.query.at) {
    res.send(`
      <body>Success! You can close this tab now.</body>
      <script>
        const params = new URLSearchParams(window.location.search);
        window.opener.postMessage({
          at: params.get("at"),
          e: Number.parseInt(params.get("e"), 10)
        }, "chrome-extension://jmefobebfekofkbpfmjkmhjgaaaojkml");
      </script>
    `);
  }
  else {
    res.redirect(`/api/v1/gauth/callback?error=Failed to authenticate.`);
  }
});

router.get("/refresh", async (req, res) => {
  if (!req.query.email) {
    res.status(400).json({ error: "Invalid request." });
    return;
  }
  const item = await getItem(req.query.email);

  if (!item || !item.token) {
    res.status(401).json({ error: "User not found." });
    return;
  }

  if (item.message) {
    res.status(401).json({ error: item.message });
    return;
  }

  const json = await fetch(`https://www.googleapis.com/oauth2/v4/token?refresh_token=${item.token}&client_id=${process.env.G_CLIENT_ID}&client_secret=${process.env.G_CLIENT_SECRET}&grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  }).then(res => res.json());


  if (json.error === "invalid_grant" || !json.access_token) {
    remoevItem(item.id);
    res.status(500).json({ error: "Failed to get new token. Try again." });
    return;
  }

  res.json({
    at: json.access_token,
    e: Date.now() + json.expires_in * 1000
  });
});

router.get("/revoke", async (req, res) => {
  if (!req.query.token) {
    return;
  }
  const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${req.query.token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  if (response.status === 200) {
    res.json({ status: "Token revoked." });
  }
  else {
    res.status(500).json({ error: "Failed to revoke token." });
  }
});

function fetchUser(token) {
  return fetch(`https://people.googleapis.com/v1/people/me?personFields=emailAddresses,names,photos&key=${process.env.CALENDAR_API_KEY}&access_token=${token}`, { referrer: process.env.URL }).then(res => res.json());
}

export { router };
