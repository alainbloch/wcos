import { it, expect } from "@jest/globals";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";

it("creates the configured admin, resets it case-insensitively, and preserves other data", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcos-reset-admin-"));
  const dbPath = path.join(dir, "db.json");
  const env = {
    ...process.env,
    DB_PATH: dbPath,
    UPLOAD_DIR: path.join(dir, "uploads"),
    ADMIN_EMAIL: "Owner@example.com",
    ADMIN_PASSWORD: "FirstPassword123!",
  };
  const run = () =>
    execFileSync(process.execPath, ["scripts/reset-admin.js"], {
      env,
      encoding: "utf8",
    });
  try {
    const output = run();
    expect(output).toContain("account created");
    expect(output).not.toContain(env.ADMIN_PASSWORD);
    const before = JSON.parse(fs.readFileSync(dbPath));
    const user = before.users[0];
    expect(user.email).toBe("owner@example.com");
    expect(await bcrypt.compare(env.ADMIN_PASSWORD, user.password)).toBe(true);
    user.name = "Existing name";
    before.users.push({
      ...user,
      id: "other-user",
      email: "other@example.com",
    });
    fs.writeFileSync(dbPath, JSON.stringify(before));
    env.ADMIN_EMAIL = "OWNER@example.com";
    env.ADMIN_PASSWORD = "ReplacementPassword456!";
    expect(run()).toContain("password reset");
    const after = JSON.parse(fs.readFileSync(dbPath));
    expect(after.users).toHaveLength(2);
    expect(after.users[0].id).toBe(user.id);
    expect(after.users[0].name).toBe("Existing name");
    expect(after.users[0].authVersion).not.toBe(user.authVersion);
    expect(
      await bcrypt.compare(env.ADMIN_PASSWORD, after.users[0].password),
    ).toBe(true);
    expect(
      await bcrypt.compare("FirstPassword123!", after.users[0].password),
    ).toBe(false);
    expect(after.users[1]).toEqual(before.users[1]);
    expect({ ...after, users: [] }).toEqual({ ...before, users: [] });
    for (const password of ["", "weak"]) {
      const original = fs.readFileSync(dbPath, "utf8");
      const result = spawnSync(process.execPath, ["scripts/reset-admin.js"], {
        env: { ...env, ADMIN_PASSWORD: password },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(fs.readFileSync(dbPath, "utf8")).toBe(original);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, 15000);
