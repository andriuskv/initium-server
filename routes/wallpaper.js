import express from "express";

const router = express.Router();

router.get("/", async (req, res) => {
  const provider = req.query.p ?? "unsplash";

  try {
    res.set("Access-Control-Allow-Origin", req.headers.origin);
    res.set("Vary", "Origin");

    if (provider === "bing") {
      res.set("Cache-Control", "public, max-age=300");
      res.send(await fetchBingInfo());
    }
    else {
      res.set("Cache-Control", "private, max-age=300");
      res.send(await fetchUnsplashInfo());
    }
  } catch (e) {
    res.status(500).json(e);
  }
});

async function fetchUnsplashInfo() {
  try {
    const apiUrl = "https://api.unsplash.com/photos/random";
    const key = process.env.UNSPLASH_KEY;
    const json = await fetch(`${apiUrl}?collections=825407&client_id=${key}`).then(res => res.json());

    return {
      url: json.urls.raw,
      name: json.user.name,
      username: json.user.username
    };
  } catch (e) {
    console.log(e);
  }
}

async function fetchBingInfo() {
  try {
    const json = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1").then(res => res.json());
    const [image] = json.images;

    return {
      url: `https://www.bing.com${image.url}`,
      endDate: getBingImageEndDate(image.enddate),
      copyright: image.copyright,
      copyrightLink: image.copyrightlink
    };
  } catch (e) {
    console.log(e);
  }
}

function getBingImageEndDate(dateString) {
  const year = dateString.slice(0, 4);
  const month = dateString.slice(4, 6);
  const day = dateString.slice(6, 8);

  return new Date(`${year}-${month}-${day}`).getTime();
}

export {
  router
};
