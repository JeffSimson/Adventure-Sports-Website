const OWNER = "JeffSimson";
const REPO = "Adventure-Sports-Website";
const BRANCH = "main";
const FILE_PATH = "content/site.json";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  },
  body: JSON.stringify(body),
});

async function verifyNetlifyUser(event) {
  const authorization = event.headers.authorization || event.headers.Authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw Object.assign(new Error("You are not signed in."), { statusCode: 401 });
  }

  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!siteUrl) {
    throw Object.assign(new Error("Netlify site URL is unavailable."), { statusCode: 500 });
  }

  const response = await fetch(`${siteUrl}/.netlify/identity/user`, {
    headers: { Authorization: authorization },
  });

  if (!response.ok) {
    throw Object.assign(new Error("Your login session could not be verified."), { statusCode: 401 });
  }

  return response.json();
}

async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw Object.assign(new Error("GITHUB_TOKEN is missing in Netlify."), { statusCode: 500 });
  }

  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data = {};
  try { data = await response.json(); } catch {}

  if (!response.ok) {
    const message = data.message || `GitHub request failed (${response.status}).`;
    throw Object.assign(new Error(message), { statusCode: response.status });
  }
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const user = await verifyNetlifyUser(event);
    const input = JSON.parse(event.body || "{}");
    const fieldStatus = String(input.fieldStatus || "").trim();
    const announcement = String(input.announcement || "").trim();

    const allowed = ["OPEN", "CLOSED", "DELAYED", "CHECK SCHEDULE"];
    if (!allowed.includes(fieldStatus)) {
      return json(400, { error: "Invalid facility status." });
    }
    if (!announcement || announcement.length > 240) {
      return json(400, { error: "Announcement must be between 1 and 240 characters." });
    }

    const current = await github(`/contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}&t=${Date.now()}`);
    const decoded = Buffer.from(String(current.content || "").replace(/\n/g, ""), "base64").toString("utf8");
    const site = JSON.parse(decoded);

    const updated = {
      ...site,
      fieldStatus,
      announcement,
      __publishedAt: new Date().toISOString(),
      __publishedBy: user.email || "Operations Hub",
    };

    const result = await github(`/contents/${FILE_PATH}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Update facility status from Operations Hub (${user.email || "administrator"})`,
        content: Buffer.from(JSON.stringify(updated, null, 2) + "\n", "utf8").toString("base64"),
        sha: current.sha,
        branch: BRANCH,
      }),
    });

    return json(200, {
      ok: true,
      site: updated,
      commitSha: result.commit && result.commit.sha,
      publishedAt: updated.__publishedAt,
    });
  } catch (error) {
    console.error("publish-content error:", error);
    return json(error.statusCode || 500, { error: error.message || "Publishing failed." });
  }
};
