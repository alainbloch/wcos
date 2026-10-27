import {adminSession} from "../helpers/admin-session.js";
import { beforeAll, afterAll, it, expect } from "@jest/globals";
import { buildApp } from "../../src/app.js";
import { authService } from "../../src/services/authService.js";
import { usersRepo, membersRepo } from "../../src/models/database.js";
let app;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
it("updates an existing member with authenticated multipart data without circular objects", async () => {
  const user = await usersRepo.findByEmail("admin@wcos.org");
  const member = await membersRepo.create({
    position: "Before",
    level: "L2",
    merits: [],
  });
  const token = authService.generateToken(user);
  const {cookie, csrf} = await adminSession(app, `wcos_session=${token}`);
  const response = await app.inject({
    method: "POST",
    url: `/admin/members/${member.id}/edit`,
    headers: {
      "content-type": "multipart/form-data; boundary=test",
      cookie,
      "x-csrf-token": csrf,
    },
    payload: Buffer.from(
      '--test\r\nContent-Disposition: form-data; name="circleName"\r\n\r\nGad\r\n' +
        '--test\r\nContent-Disposition: form-data; name="level"\r\n\r\nL2\r\n' +
        '--test\r\nContent-Disposition: form-data; name="merits"\r\n\r\nExpert Swordsman\r\nKaiden\r\n' +
        "--test--\r\n",
    ),
  });
  expect(response.statusCode).toBe(302);
  const stored = await membersRepo.findById(member.id);
  expect(stored.position).toBe("Gad");
  expect(typeof stored.circleName).toBe("string");
  expect(() => JSON.stringify(stored)).not.toThrow();
});
