const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { createRequire } = require("node:module");
const path = require("node:path");

test("service usage is admin-only, starts at Pacific midnight, and keeps partial provider results", async () => {
  const filename = path.resolve("app/api/admin/usage/route.ts");
  const req = createRequire(filename);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let now = "2026-07-15T13:00:00Z";
  let requests = 0;
  let apiDisabled = false;
  class Clock extends Date {
    constructor(value = now) { super(value); }
  }
  const auth = {
    requireAdmin: async request => { if (!request.headers.has("x-admin")) throw new Error("deny"); },
    authErrorResponse: () => ({ status: 403, message: "Nemáš oprávnění správce." }),
  };
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, URL, Date: Clock, AbortSignal,
    fetch: async url => {
      requests++;
      const filter = url.searchParams.get("filter");
      if (apiDisabled) return Response.json({ error: { details: [{ reason: "SERVICE_DISABLED" }] } }, { status: 403 });
      if (filter.includes("delete_ops_count")) return new Response(null, { status: 403 });
      return Response.json({ timeSeries: [{ points: [{ value: { int64Value: "7" } }, { value: { int64Value: "9" } }] }] });
    },
    require(dep) {
      if (dep.endsWith("/apiAuth")) return auth;
      if (dep.endsWith("/cloudinaryAdmin")) return {
        getCloudinaryUsage: async () => ({ credits: { usage: 6.5, limit: 25 }, storage: { usage: 2000 } }),
      };
      if (dep === "firebase-admin/app") return {
        getApps: () => [{ options: { projectId: "test", credential: { getAccessToken: async () => ({ access_token: "fake" }) } } }],
      };
      if (dep.endsWith("/serviceUsage")) return req(dep + ".ts");
      return req(dep);
    },
  });
  const url = "https://example.test/api/admin/usage";
  const authorized = () => new Request(url, { headers: { "x-admin": "yes" } });
  assert.equal((await mod.exports.GET(new Request(url))).status, 403);
  assert.equal(requests, 0);
  const response = await mod.exports.GET(authorized());
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const data = await response.json();
  assert.equal(data.firestoreIssue, "permissions");
  assert.deepEqual(data.firestore, { since: "2026-07-15T07:00:00.000Z", reads: 16, writes: 16, deletes: null });
  assert.deepEqual(data.cloudinary, { credits: 6.5, limit: 25, storage: 2000, bandwidth: null });
  await mod.exports.GET(authorized());
  assert.equal(requests, 3);
  now = "2026-11-18T07:59:00Z";
  assert.equal((await (await mod.exports.GET(authorized())).json()).firestore.since, "2026-11-17T08:00:00.000Z");
  now = "2026-11-18T08:01:00Z";
  assert.equal((await (await mod.exports.GET(authorized())).json()).firestore.since, "2026-11-18T08:00:00.000Z");
  assert.equal(requests, 9);
  apiDisabled = true;
  now = "2026-11-18T08:30:00Z";
  const disabled = await (await mod.exports.GET(authorized())).json();
  assert.equal(disabled.firestoreIssue, "api_disabled");
  assert.equal(disabled.firestore, null);
  assert.equal(disabled.cloudinary.credits, 6.5);
  assert.equal((await mod.exports.GET(new Request(url))).status, 403);
});

// Opt-in deployment smoke check. Output contains only HTTP status and fixed diagnostic categories.
if (process.env.DLH_PROBE_MONITORING === "1") {
  test("production Cloud Monitoring connectivity", { timeout: 20_000 }, async t => {
    try {
      const { cert } = require("firebase-admin/app");
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
      if (!projectId || !clientEmail || !privateKey) {
        t.diagnostic("MONITORING_PROBE NO_BUILD_CREDENTIALS");
        return;
      }
      const expected = process.env.DLH_EXPECTED_MONITORING_EMAIL;
      const identity = expected === clientEmail ? "MATCHES_IAM_ACCOUNT" : "DIFFERENT_ACCOUNT";
      const { access_token } = await cert({ projectId, clientEmail, privateKey }).getAccessToken();
      const now = new Date();
      const url = new URL(`https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries`);
      url.searchParams.set("filter", 'metric.type="firestore.googleapis.com/document/read_ops_count" AND resource.type="firestore.googleapis.com/Database" AND resource.labels.database_id="(default)"');
      url.searchParams.set("interval.startTime", new Date(now.getTime() - 3600_000).toISOString());
      url.searchParams.set("interval.endTime", now.toISOString());
      url.searchParams.set("view", "HEADERS");
      const result = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(9000) });
      const data = await result.json().catch(() => null);
      const known = ["SERVICE_DISABLED", "IAM_PERMISSION_DENIED", "ACCESS_TOKEN_SCOPE_INSUFFICIENT", "BILLING_DISABLED", "USER_PROJECT_DENIED", "CONSUMER_INVALID"];
      const reason = data?.error?.details?.map(detail => detail.reason).find(reason => known.includes(reason));
      t.diagnostic(`MONITORING_PROBE ${identity} ${result.status} ${reason ?? "NO_REASON"}`);
    } catch {
      t.diagnostic("MONITORING_PROBE TOKEN_OR_NETWORK_ERROR");
    }
  });
}
