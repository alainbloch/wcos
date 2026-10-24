import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { ContactService } from "../../src/services/contactService.js";
import { ContactController } from "../../src/controllers/contactController.js";
const originalEnv = { ...process.env };
afterEach(() => {
  for (const key of [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "CONTACT_FROM",
    "CONTACT_TO",
  ]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});
const valid = {
  name: "Test visitor",
  email: "visitor@example.test",
  message: "Please tell me about classes.",
};
describe("Contact delivery", () => {
  it("validates before contacting an SMTP server", async () => {
    const create = jest.fn();
    const service = new ContactService(create);
    await expect(service.send({})).rejects.toMatchObject({ statusCode: 400 });
    expect(create).not.toHaveBeenCalled();
  });
  it("reports missing delivery configuration honestly", async () => {
    delete process.env.SMTP_HOST;
    await expect(new ContactService().send(valid)).rejects.toMatchObject({
      statusCode: 503,
    });
  });
  it("uses a fixed recipient and reply-to, without exposing mail credentials", async () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.CONTACT_FROM = "site@example.test";
    const sendMail = jest.fn().mockResolvedValue({ messageId: "test" });
    const close = jest.fn();
    const service = new ContactService(() => ({ sendMail, close }));
    await service.send({ ...valid, to: "untrusted@example.test" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "westerncouncil@gmail.com",
        replyTo: valid.email,
        text: expect.stringContaining(valid.message),
      }),
    );
    expect(close).toHaveBeenCalled();
  });
  it("rejects excessive message size", async () =>
    await expect(
      new ContactService().send({ ...valid, message: "x".repeat(10001) }),
    ).rejects.toMatchObject({ statusCode: 400 }));
  it("rate-limits submissions and never reports an SMTP failure as success", async () => {
    const service = {
      send: jest.fn().mockRejectedValue(new Error("SMTP failed")),
    };
    const controller = new ContactController(service);
    const reply = {
      status: 200,
      code(status) {
        this.status = status;
        return this;
      },
      send: jest.fn(),
    };
    const request = { ip: "127.0.0.1", body: valid, log: { error: jest.fn() } };
    await controller.send(request, reply);
    expect(reply.status).toBe(502);
    for (let i = 0; i < 5; i++) await controller.send(request, reply);
    expect(reply.status).toBe(429);
    expect(service.send).toHaveBeenCalledTimes(5);
  });
  it("returns confirmation only after successful delivery", async () => {
    const controller = new ContactController({
      send: jest.fn().mockResolvedValue({}),
    });
    const reply = {
      send: jest.fn(),
      code() {
        return this;
      },
    };
    await controller.send({ ip: "127.0.0.2", body: valid }, reply);
    expect(reply.send).toHaveBeenCalledWith({
      message: "Your message has been sent. Thank you.",
    });
  });
});
