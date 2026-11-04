import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, teardown, login, accounts } from '../helpers.js';

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

describe('authentication', () => {
  it('registers a new user as a submitter', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'New Person', email: 'new@example.com', password: 'Passw0rd!', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('submitter');
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    expect(res.body.data.token).toBeTruthy();
  });

  it('rejects duplicate emails and weak passwords', async () => {
    const dup = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'NEW@example.com', password: 'Passw0rd!' });
    expect(dup.status).toBe(409);
    const weak = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'w@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.errors[0].field).toBe('password');
  });

  it('logs in and returns the current user', async () => {
    const token = await login(app, ...accounts.reviewer);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.role).toBe('reviewer');
  });

  it('rejects bad credentials and invalid tokens', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: accounts.admin[0], password: 'wrong-pass1' });
    expect(bad.status).toBe(401);
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
    const none = await request(app).get('/api/cases');
    expect(none.status).toBe(401);
  });
});

describe('role-based access control', () => {
  it('blocks non-admins from admin routes', async () => {
    const token = await login(app, ...accounts.submitter);
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    const reviewer = await login(app, ...accounts.reviewer);
    expect((await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${reviewer}`)).status).toBe(403);
  });

  it('lets admins manage users and blocks deactivated accounts', async () => {
    const admin = await login(app, ...accounts.admin);
    const created = await request(app).post('/api/users').set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Temp Reviewer', email: 'temp@example.com', password: 'Passw0rd!', role: 'reviewer' });
    expect(created.status).toBe(201);
    const token = await login(app, 'temp@example.com', 'Passw0rd!');
    await request(app).patch(`/api/users/${created.body.data.id}`).set('Authorization', `Bearer ${admin}`).send({ isActive: false });
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });
});
