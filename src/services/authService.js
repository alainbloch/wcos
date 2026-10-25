/**
 * Auth Service
 * Handles authentication and authorization
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { usersRepo } from "../models/database.js";
import config from "../config/index.js";

export class AuthService {
  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: "admin",
        authVersion: user.authVersion || 0,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  validatePassword(password) {
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9\s]/.test(password)
    ) {
      throw new Error(
        "Password must be at least 8 characters, include uppercase, lowercase, a number and a symbol, and fit within 72 UTF-8 bytes.",
      );
    }
  }

  async validateIdentity(data, id) {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email =
      typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!name || name.length > 200)
      throw new Error("Name is required (maximum 200 characters).");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Enter a valid email address.");
    if (
      (await usersRepo.findAll()).some(
        (user) => user.id !== id && user.email.toLowerCase() === email,
      )
    )
      throw new Error("Email already registered");
    return { name, email, role: "admin" };
  }

  async createUser(data) {
    const identity = await this.validateIdentity(data);
    this.validatePassword(data.password);
    const password = await this.hashPassword(data.password);
    // Check again after hashing: concurrent requests must not create duplicate logins.
    await this.validateIdentity(data);
    return this.sanitizeUser(await usersRepo.create({ ...identity, password }));
  }

  async authenticate(email, password) {
    const user = (await usersRepo.findAll()).find(
      (user) =>
        user.email.toLowerCase() ===
        String(email || "")
          .trim()
          .toLowerCase(),
    );
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const valid = await this.verifyPassword(password, user.password);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  async getUserById(id) {
    const user = await usersRepo.findById(id);
    return user ? this.sanitizeUser(user) : null;
  }

  async updateUser(id, data) {
    if (!(await usersRepo.findById(id))) throw new Error("User not found");
    const identity = await this.validateIdentity(data, id);
    if (data.password !== undefined && data.password !== "") {
      this.validatePassword(data.password);
      identity.password = await this.hashPassword(data.password);
      // Password resets revoke existing sessions, including the user's own session.
      identity.authVersion = randomUUID();
    }
    await this.validateIdentity(data, id);
    return this.sanitizeUser(await usersRepo.update(id, identity));
  }

  async deleteUser(id, actorId) {
    if (id === actorId) throw new Error("You cannot delete your own account.");
    if ((await usersRepo.findAll()).length <= 1)
      throw new Error("The last administrator cannot be deleted.");
    return usersRepo.delete(id);
  }

  sanitizeUser(user) {
    const { id, name, email, createdAt, updatedAt, authVersion } = user;
    return {
      id,
      name,
      email,
      createdAt,
      updatedAt,
      authVersion,
      role: "admin",
    };
  }

  async initializeAdmin() {
    // Only bootstrap an empty database; never recreate a deleted account on restart.
    if ((await usersRepo.findAll()).length) return;
    if (!process.env.ADMIN_PASSWORD)
      throw new Error(
        "Set ADMIN_PASSWORD to create the initial administrator.",
      );
    await this.createUser({
      name: "Administrator",
      email: config.adminEmail,
      password: process.env.ADMIN_PASSWORD,
    });
  }
}

export const authService = new AuthService();
