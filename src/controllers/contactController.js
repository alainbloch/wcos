import { contactService } from "../services/contactService.js";

export class ContactController {
  constructor(service = contactService) {
    this.service = service;
    this.attempts = new Map();
  }
  async send(request, reply) {
    const now = Date.now();
    // Bounded, expiring process-local throttling. Deployments with multiple
    // instances should also apply their reverse proxy's shared rate limit.
    for (const [ip, entry] of this.attempts)
      if (entry.until < now) this.attempts.delete(ip);
    const entry = this.attempts.get(request.ip) || {
      count: 0,
      until: now + 600000,
    };
    if (entry.count >= 5 || this.attempts.size >= 10000)
      return reply
        .code(429)
        .send({
          error: "Please wait a few minutes before sending another message.",
        });
    entry.count++;
    this.attempts.set(request.ip, entry);
    if (request.body?.website)
      return reply.code(400).send({ error: "Unable to send this submission." });
    try {
      await this.service.send(request.body || {});
      return reply.send({ message: "Your message has been sent. Thank you." });
    } catch (error) {
      if (error.statusCode)
        return reply.code(error.statusCode).send({ error: error.message });
      request.log.error({ err: error }, "Contact email delivery failed");
      return reply
        .code(502)
        .send({
          error:
            "Your message could not be delivered. Please email westerncouncil@gmail.com directly.",
        });
    }
  }
}
export const contactController = new ContactController();
