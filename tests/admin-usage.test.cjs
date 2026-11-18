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
  assert.deepEqual(data.firestore, { since: "2026-07-15T07:00:00.000Z", reads: 16, writes: 16, deletes: null });
  assert.deepEqual(data.cloudinary, { credits: 6.5, limit: 25, storage: 2000, bandwidth: null });
  await mod.exports.GET(authorized());
  assert.equal(requests, 3);
  now = "2026-11-18T07:59:00Z";
  assert.equal((await (await mod.exports.GET(authorized())).json()).firestore.since, "2026-11-17T08:00:00.000Z");
  now = "2026-11-18T08:01:00Z";
  assert.equal((await (await mod.exports.GET(authorized())).json()).firestore.since, "2026-11-18T08:00:00.000Z");
  assert.equal(requests, 9);
  assert.equal((await mod.exports.GET(new Request(url))).status, 403);
});
