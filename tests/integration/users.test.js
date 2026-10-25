import { beforeAll, afterAll, expect, it } from "@jest/globals";
import { load } from "cheerio";
import { buildApp } from "../../src/app.js";
import { usersRepo } from "../../src/models/usersRepository.js";
import { authService } from "../../src/services/authService.js";
let app, cookie, csrf, admin;
beforeAll(async () => {
  app = await buildApp();
  admin = await usersRepo.findByEmail("admin@wcos.org");
  cookie = `wcos_session=${authService.generateToken(admin)}`;
  const response = await app.inject({
    url: "/admin/users/new",
    headers: { cookie },
  });
  csrf = load(response.payload)('input[name="_csrf"]').val();
  cookie += `; sessionId=${response.cookies.find((c) => c.name === "sessionId").value}`;
});
afterAll(async () => app.close());
const post = (url, payload) =>
  app.inject({
    method: "POST",
    url,
    headers: { cookie },
    payload: { _csrf: csrf, ...payload },
  });
const values = {
  name: "User Admin Test",
  email: "USER@example.com",
  password: "StrongPass1!",
  confirmPassword: "StrongPass1!",
};
it("protects user pages and rejects missing CSRF tokens", async () => {
  expect((await app.inject("/admin/users")).statusCode).toBe(401);
  expect(
    (await post("/admin/users", { ...values, _csrf: "" })).statusCode,
  ).toBe(403);
});
it("validates passwords and never reflects submitted secrets", async () => {
  for (const password of [
    "short",
    "abcdefgh",
    "ABCDEFG1!",
    "Abcdefgh!",
    "Abcdefg12",
    "Abc1!" + "é".repeat(35),
  ]) {
    const response = await post("/admin/users", {
      ...values,
      password,
      confirmPassword: password,
    });
    expect(response.statusCode).toBe(400);
    const $ = load(response.payload);
    expect(response.payload).toContain('id="password"');
    expect($("#password").attr("value")).toBeUndefined();
    expect($("#confirmPassword").attr("value")).toBeUndefined();
    expect($("#name").val()).toBe(values.name);
    expect(response.payload).not.toContain(password);
  }
});
it("creates, edits, resets, and deletes accounts without exposing hashes", async () => {
  expect((await post("/admin/users", values)).statusCode).toBe(302);
  let user = await usersRepo.findByEmail("user@example.com");
  expect(user.role).toBe("admin");
  expect(await authService.verifyPassword(values.password, user.password)).toBe(
    true,
  );
  const hash = user.password;
  expect((await post("/admin/users", values)).statusCode).toBe(400);
  const page = await app.inject({
    url: `/admin/users/${user.id}/edit`,
    headers: { cookie },
  });
  expect(page.payload).not.toContain(hash);
  expect(page.payload).not.toContain(values.password);
  const url = `/admin/users/${user.id}/edit`;
  expect(
    (await post(url, { ...values, password: "", confirmPassword: "" }))
      .statusCode,
  ).toBe(302);
  expect((await usersRepo.findById(user.id)).password).toBe(hash);
  const oldToken = authService.generateToken(user);
  expect(
    (
      await post(url, {
        ...values,
        password: "ChangedPass2!",
        confirmPassword: "ChangedPass2!",
      })
    ).statusCode,
  ).toBe(302);
  expect(
    (
      await app.inject({
        url: "/admin",
        headers: { cookie: `wcos_session=${oldToken}` },
      })
    ).statusCode,
  ).toBe(401);
  user = await usersRepo.findById(user.id);
  const newToken = authService.generateToken(user);
  expect(
    (
      await app.inject({
        url: "/admin/settings",
        headers: { cookie: `wcos_session=${newToken}` },
      })
    ).statusCode,
  ).toBe(200);
  expect((await post(`/admin/users/${user.id}/delete`, {})).statusCode).toBe(
    302,
  );
  expect(
    (
      await app.inject({
        url: "/admin",
        headers: { cookie: `wcos_session=${newToken}` },
      })
    ).statusCode,
  ).toBe(401);
});
it("prevents self deletion and handles missing users", async () => {
  expect((await post(`/admin/users/${admin.id}/delete`, {})).statusCode).toBe(
    400,
  );
  expect((await post("/admin/users/missing/edit", values)).statusCode).toBe(
    404,
  );
});
