import { it, expect } from "@jest/globals";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import config from "../../src/config/index.js";
import { usersRepo } from "../../src/models/database.js";
import { authService } from "../../src/services/authService.js";

it("retains secure form sessions behind an HTTPS proxy and rejects invalid tokens", async () => {
  const old = { nodeEnv: config.nodeEnv, trustProxy: config.trustProxy };
  config.nodeEnv = "production";
  config.trustProxy = 1;
  let app;
  try {
    app = await buildApp();
    const user = await usersRepo.findByEmail("admin@wcos.org");
    const auth = `wcos_session=${authService.generateToken(user)}`;
    const page = await app.inject({
      url: "/admin/settings/data-transfer",
      headers: { cookie: auth, "x-forwarded-proto": "https" },
    });
    const session = page.cookies.find((c) => c.name === "sessionId");
    expect(session).toBeDefined();
    expect(session.secure).toBe(true);
    const csrf = load(page.payload)('[name="_csrf"]').val();
    const headers = {
      cookie: `${auth}; sessionId=${session.value}`,
      "x-forwarded-proto": "https",
      "content-type": "application/octet-stream",
      "x-transfer-format": "json",
      "x-transfer-mode": "populate",
      "x-transfer-csrf": csrf,
    };
    const upload = await app.inject({
      method: "POST",
      url: "/admin/settings/data-transfer/upload",
      headers,
      payload: Buffer.from("{}"),
    });
    expect(upload.statusCode).toBe(200);
    expect(upload.json().location).toContain("/preview/");
    const invalid = await app.inject({
      method: "POST",
      url: "/admin/settings/data-transfer/upload",
      headers: { ...headers, "x-transfer-csrf": "invalid" },
      payload: Buffer.from("{}"),
    });
    expect(invalid.statusCode).toBe(403);
    expect(invalid.payload).toContain("Invalid form token");
  } finally {
    if (app) await app.close();
    Object.assign(config, old);
  }
});
