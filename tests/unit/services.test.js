/**
 * Unit Tests - Services
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { initDatabase, getDatabase } from '../../src/models/database.js';
import { BaseRepository } from '../../src/models/database.js';

describe('BaseRepository', () => {
  let repo;
  let db;

  beforeEach(async () => {
    await initDatabase();
    db = getDatabase();
    db.data.members = [];
    await db.write();
    repo = new BaseRepository('members');
  });

  it('should create an item with id and timestamps', async () => {
    const item = await repo.create({ name: 'Test', level: 'L1' });
    
    expect(item).toHaveProperty('id');
    expect(item.id).toMatch(/^members_\d+_[a-z0-9]+$/);
    expect(item).toHaveProperty('createdAt');
    expect(item).toHaveProperty('updatedAt');
    expect(item.name).toBe('Test');
    expect(item.level).toBe('L1');
  });

  it('should find item by id', async () => {
    const created = await repo.create({ name: 'Find Me' });
    const found = await repo.findById(created.id);
    
    expect(found).toEqual(created);
  });

  it('should return null for non-existent id', async () => {
    const found = await repo.findById('non-existent');
    expect(found).toBeNull();
  });

  it('should find all items', async () => {
    await repo.create({ name: 'Item 1' });
    await repo.create({ name: 'Item 2' });
    
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it('should update an item', async () => {
    const created = await repo.create({ name: 'Original', value: 1 });
    await new Promise(resolve => setTimeout(resolve, 10));
    const updated = await repo.update(created.id, { name: 'Updated', value: 2 });
    
    expect(updated.name).toBe('Updated');
    expect(updated.value).toBe(2);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  it('should return null when updating non-existent item', async () => {
    const updated = await repo.update('non-existent', { name: 'Test' });
    expect(updated).toBeNull();
  });

  it('should delete an item', async () => {
    const created = await repo.create({ name: 'To Delete' });
    const result = await repo.delete(created.id);
    
    expect(result).toBe(true);
    const found = await repo.findById(created.id);
    expect(found).toBeNull();
  });

  it('should return false when deleting non-existent item', async () => {
    const result = await repo.delete('non-existent');
    expect(result).toBe(false);
  });

  it('should find one by query', async () => {
    await repo.create({ name: 'Unique', type: 'special' });
    await repo.create({ name: 'Other', type: 'normal' });
    
    const found = await repo.findOne({ type: 'special' });
    expect(found.name).toBe('Unique');
  });

  it('should find many by query', async () => {
    await repo.create({ name: 'Item 1', category: 'A' });
    await repo.create({ name: 'Item 2', category: 'A' });
    await repo.create({ name: 'Item 3', category: 'B' });
    
    const found = await repo.findMany({ category: 'A' });
    expect(found).toHaveLength(2);
  });
});

describe('MembersRepository', () => {
  let membersRepo;
  let db;

  beforeEach(async () => {
    await initDatabase();
    db = getDatabase();
    db.data.members = [];
    await db.write();
    const { membersRepo: MR } = await import('../../src/models/database.js');
    membersRepo = MR;
  });

  it('should find members by level', async () => {
    await membersRepo.create({ name: 'Member 1', level: 'L7' });
    await membersRepo.create({ name: 'Member 2', level: 'L5' });
    await membersRepo.create({ name: 'Member 3', level: 'L7' });
    
    const l7Members = await membersRepo.findByLevel('L7');
    expect(l7Members).toHaveLength(2);
    expect(l7Members.every(m => m.level === 'L7')).toBe(true);
  });

  it('should find active members', async () => {
    await membersRepo.create({ name: 'Active 1', active: true });
    await membersRepo.create({ name: 'Inactive 1', active: false });
    await membersRepo.create({ name: 'Active 2', active: true });
    
    const active = await membersRepo.findActive();
    expect(active).toHaveLength(2);
    expect(active.every(m => m.active === true)).toBe(true);
  });

  it('should find members by region', async () => {
    await membersRepo.create({ name: 'CA Member', region: 'CA' });
    await membersRepo.create({ name: 'WA Member', region: 'WA' });
    await membersRepo.create({ name: 'CA Member 2', region: 'CA' });
    
    const caMembers = await membersRepo.findByRegion('CA');
    expect(caMembers).toHaveLength(2);
  });
});

describe('AuthService', () => {
  let authService;
  let db;

  beforeEach(async () => {
    await initDatabase();
    db = getDatabase();
    db.data.users = [];
    await db.write();
    const { authService: AS } = await import('../../src/services/authService.js');
    authService = AS;
  });

  it('should hash and verify passwords', async () => {
    const password = 'testPassword123';
    const hash = await authService.hashPassword(password);
    
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
    
    const valid = await authService.verifyPassword(password, hash);
    expect(valid).toBe(true);
    
    const invalid = await authService.verifyPassword('wrongPassword', hash);
    expect(invalid).toBe(false);
  });

  it('should create a user', async () => {
    const user = await authService.createUser({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'editor',
    });
    
    expect(user).toHaveProperty('id');
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.role).toBe('editor');
    // createUser returns the raw user from DB (with hashed password)
    expect(user).toHaveProperty('password');
    expect(user.password).not.toBe('password123');
    expect(user.password).toMatch(/^\$2[aby]\$/);
  });

  it('should throw error for duplicate email', async () => {
    await authService.createUser({
      name: 'User 1',
      email: 'duplicate@example.com',
      password: 'password123',
    });
    
    await expect(
      authService.createUser({
        name: 'User 2',
        email: 'duplicate@example.com',
        password: 'password123',
      })
    ).rejects.toThrow('Email already registered');
  });

  it('should authenticate valid credentials', async () => {
    await authService.createUser({
      name: 'Auth User',
      email: 'auth@example.com',
      password: 'password123',
    });
    
    const result = await authService.authenticate('auth@example.com', 'password123');
    
    expect(result).toHaveProperty('user');
    expect(result.user.email).toBe('auth@example.com');
    expect(result.user.password).toBeUndefined();
    expect(result).toHaveProperty('token');
    expect(typeof result.token).toBe('string');
  });

  it('should throw for invalid email', async () => {
    await expect(
      authService.authenticate('nonexistent@example.com', 'password123')
    ).rejects.toThrow('Invalid credentials');
  });

  it('should throw for invalid password', async () => {
    await authService.createUser({
      name: 'Auth User',
      email: 'auth@example.com',
      password: 'password123',
    });
    
    await expect(
      authService.authenticate('auth@example.com', 'wrongpassword')
    ).rejects.toThrow('Invalid credentials');
  });

  it('should generate and verify JWT tokens', async () => {
    const user = { id: 'user_123', email: 'test@example.com', role: 'admin' };
    const token = authService.generateToken(user);
    
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
    
    const decoded = authService.verifyToken(token);
    expect(decoded.id).toBe('user_123');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('admin');
  });

  it('should return null for invalid token', async () => {
    const decoded = authService.verifyToken('invalid.token.here');
    expect(decoded).toBeNull();
  });

  it('should sanitize user object', async () => {
    const userWithPassword = {
      id: 'user_123',
      email: 'test@example.com',
      password: 'hashed_password',
      role: 'editor',
      name: 'Test',
    };
    
    const sanitized = authService.sanitizeUser(userWithPassword);
    
    expect(sanitized).not.toHaveProperty('password');
    expect(sanitized.id).toBe('user_123');
    expect(sanitized.email).toBe('test@example.com');
  });
});