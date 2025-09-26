import request from 'supertest';
import app from '../index';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Admin Routes', () => {
  let adminToken: string;
  let studentToken: string;
  let studentUserId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany();

    const hashedPassword = await bcrypt.hash('password123', 12);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@vt.edu',
        password: hashedPassword,
        role: 'admin',
      },
    });

    // Create student user
    const student = await prisma.user.create({
      data: {
        name: 'Student User',
        email: 'student@vt.edu',
        password: hashedPassword,
        role: 'student',
      },
    });

    studentUserId = student.id;

    // Generate tokens
    adminToken = jwt.sign({ userId: admin.id }, process.env.JWT_SECRET!);
    studentToken = jwt.sign({ userId: student.id }, process.env.JWT_SECRET!);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/v1/admin/users', () => {
    it('should return users list for admin', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token required');
    });
  });

  describe('POST /api/v1/admin/users/:id/suspend', () => {
    it('should suspend user for admin', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/users/${studentUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify user is suspended
      const user = await prisma.user.findUnique({
        where: { id: studentUserId },
      });
      expect(user?.suspended).toBe(true);
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/users/${studentUserId}/suspend`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });

    it('should reject attempt to suspend non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/admin/users/non-existent-id/suspend')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });
});