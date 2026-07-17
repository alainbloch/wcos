/**
 * Auth Service
 * Handles authentication and authorization
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { usersRepo } from '../models/database.js';
import config from '../config/index.js';

export class AuthService {
  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  async createUser(data) {
    const existing = await usersRepo.findByEmail(data.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await this.hashPassword(data.password);
    return usersRepo.create({
      ...data,
      password: hashedPassword,
      role: data.role || 'editor',
    });
  }

  async authenticate(email, password) {
    const user = await usersRepo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const valid = await this.verifyPassword(password, user.password);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  async getUserById(id) {
    const user = await usersRepo.findById(id);
    return user ? this.sanitizeUser(user) : null;
  }

  async updateUser(id, data) {
    if (data.password) {
      data.password = await this.hashPassword(data.password);
    }
    return usersRepo.update(id, data);
  }

  sanitizeUser(user) {
    const { password, ...sanitized } = user;
    return sanitized;
  }

  async initializeAdmin() {
    const admin = await usersRepo.findByEmail(config.adminEmail);
    if (!admin) {
      const hashedPassword = await this.hashPassword('admin123'); // Default, should be changed
      await usersRepo.create({
        email: config.adminEmail,
        password: hashedPassword,
        role: 'admin',
        name: 'Administrator',
      });
      console.log('Admin user created. Default password: admin123');
    }
  }
}

export const authService = new AuthService();