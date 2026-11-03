// Puts the latest version on GitHub live, once, then locks automatic updates again.
// Usage: npm run release
//
// Why: Netlify's free plan charges 15 credits for every live update (300 a month),
// so automatic updates on every GitHub upload are switched off. Run this only
// when a round of changes is ready.
//
// Uses the Netlify sign-in saved on this computer by `netlify login`.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const siteId = JSON.parse(readFileSync(new URL("../.netlify/state.json", import.meta.url), "utf8")).siteId;
const config = JSON.parse(readFileSync(join(process.env.APPDATA ?? "", "netlify", "Config", "config.json"), "utf8"));
const token = Object.values(config.users ?? {})[0]?.auth?.token;
if (!token) {
  console.error("Not signed in to Netlify on this computer. Run: npx netlify-cli login");
  process.exit(1);
}

async function netlify(method, path, body) {
  const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Netlify ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
const setBuildsStopped = (stopped) => netlify("PATCH", `/sites/${siteId}`, { build_settings: { stop_builds: stopped } });

const commit = execSync("git rev-parse --short=7 HEAD", { encoding: "utf8" }).trim();
if (execSync("git status -sb", { encoding: "utf8" }).split("\n")[0].includes("ahead")) {
  console.error("Upload to GitHub first (git push): the live site is built from GitHub.");
  process.exit(1);
}

console.log(`Putting ${commit} live…`);
await setBuildsStopped(false);
try {
  await netlify("POST", `/sites/${siteId}/builds`);
  let done = false;
  for (let i = 0; i < 60 && !done; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const [latest] = await netlify("GET", `/sites/${siteId}/deploys?per_page=1`);
    if (latest?.commit_ref?.startsWith(commit) && ["ready", "error"].includes(latest.state)) {
      console.log(latest.state === "ready" ? "Live." : `Failed: ${latest.error_message}`);
      process.exitCode = latest.state === "ready" ? 0 : 1;
      done = true;
    }
  }
  if (!done) console.log("Still building after 10 minutes. Check the Netlify dashboard.");
} finally {
  await setBuildsStopped(true);
  console.log("Automatic updates locked again.");
}
