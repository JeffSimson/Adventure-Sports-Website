const OWNER = "JeffSimson";
const REPO = "Adventure-Sports-Website";
const BRANCH = "main";

const FILES = {
  site: "content/site.json",
  rentals: "content/rentals.json",
  clubhouse: "content/clubhouse.json",
  safety: "content/safety.json",
};

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Netlify-CDN-Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    const key = event.queryStringParameters && event.queryStringParameters.file;
    const path = FILES[key];
    if (!path) return response(400, { error: "Unknown content file." });

    const token = process.env.GITHUB_TOKEN;
    if (!token) return response(500, { error: "GITHUB_TOKEN is missing." });

    const githubResponse = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    const result = await githubResponse.json();
    if (!githubResponse.ok) {
      return response(githubResponse.status, { error: result.message || "Unable to load live content." });
    }

    const decoded = Buffer.from(String(result.content || "").replace(/\n/g, ""), "base64").toString("utf8");
    return response(200, JSON.parse(decoded));
  } catch (error) {
    console.error("live-content error:", error);
    return response(500, { error: error.message || "Unable to load live content." });
  }
};
