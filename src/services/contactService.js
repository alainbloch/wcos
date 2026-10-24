import nodemailer from "nodemailer";
import { ValidationError, AppError } from "../middleware/errorHandler.js";

export class ContactService {
  constructor(createTransport = nodemailer.createTransport) {
    this.createTransport = createTransport;
  }
  async send(fields) {
    const name = String(fields.name || "").trim();
    const email = String(fields.email || "").trim();
    const message = String(fields.message || "").trim();
    if (
      !name ||
      name.length > 200 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 200 ||
      !message ||
      message.length > 10000
    ) {
      throw new ValidationError(
        "Please provide your name, a valid email address, and a message (up to 10,000 characters).",
      );
    }
    // Do not claim delivery when this installation has no mail service configured.
    if (!process.env.SMTP_HOST || !process.env.CONTACT_FROM)
      throw new AppError(
        "Email delivery is not configured. Please email westerncouncil@gmail.com directly.",
        503,
      );
    const transport = this.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      ...(process.env.SMTP_USER
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          }
        : {}),
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    try {
      return await transport.sendMail({
        from: process.env.CONTACT_FROM,
        to: process.env.CONTACT_TO || "westerncouncil@gmail.com",
        replyTo: email,
        subject: "Western Circle website inquiry",
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${String(fields.phone || "").slice(0, 200)}\nTraining: ${String(fields.training || "").slice(0, 200)}\n\n${message}`,
      });
    } finally {
      transport.close?.();
    }
  }
}
export const contactService = new ContactService();
