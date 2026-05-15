/**
 * API Tests
 * Basic endpoint validation tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');

// Test user credentials
const testUser = {
  name: 'Test User',
  email: `test_${Date.now()}@example.com`,
  password: 'Test123!',
  targetRole: 'Software Engineer',
  skills: ['JavaScript', 'Node.js'],
};

let authToken;
let sessionId;

beforeAll(async () => {
  // Wait for MongoDB connection
  if (mongoose.connection.readyState !== 1) {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
});

afterAll(async () => {
  // Cleanup test data
  if (authToken) {
    await mongoose.connection.collection('users').deleteOne({ email: testUser.email });
  }
  await mongoose.connection.close();
});

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe('Authentication', () => {
  test('POST /api/auth/register - creates new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    authToken = res.body.token;
  });

  test('POST /api/auth/register - rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
  });

  test('POST /api/auth/login - authenticates user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  test('POST /api/auth/login - rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('GET /api/auth/profile - returns user profile', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe(testUser.name);
  });

  test('GET /api/auth/profile - rejects without token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
describe('Health Check', () => {
  test('GET /api/health - returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── Dashboard Tests ──────────────────────────────────────────────────────────
describe('Dashboard', () => {
  test('GET /api/dashboard/data - returns dashboard data', async () => {
    const res = await request(app)
      .get('/api/dashboard/data')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.stats).toBeDefined();
  });

  test('GET /api/dashboard/history - returns interview history', async () => {
    const res = await request(app)
      .get('/api/dashboard/history')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.interviews)).toBe(true);
  });
});
