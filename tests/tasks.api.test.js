const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { Task } = require('../src/models/Task');

let mongo;
let app;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Task.deleteMany({});
});

const newTask = (overrides = {}) => ({
  title: 'Write report',
  description: 'Quarterly numbers',
  scheduledAt: '2026-11-12T10:00:00.000Z',
  priority: 'High',
  ...overrides,
});

describe('POST /api/tasks', () => {
  test('creates a task with defaults', async () => {
    const res = await request(app).post('/api/tasks').send(newTask({ priority: undefined }));
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body._id, undefined);
    assert.equal(res.body.status, 'In Progress');
    assert.equal(res.body.priority, 'Medium');
    assert.ok(res.body.createdAt && res.body.updatedAt);
  });

  test('rejects a missing title and date with field errors', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '   ', priority: 'Urgent' });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.error.details).sort(), ['priority', 'scheduledAt', 'title']);
  });

  test('rejects malformed JSON', async () => {
    const res = await request(app).post('/api/tasks').set('Content-Type', 'application/json').send('{bad');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Malformed JSON body');
  });
});

describe('GET /api/tasks and /:id', () => {
  test('lists tasks sorted by scheduledAt', async () => {
    await request(app).post('/api/tasks').send(newTask({ title: 'Later', scheduledAt: '2026-12-01T00:00:00Z' }));
    await request(app).post('/api/tasks').send(newTask({ title: 'Sooner', scheduledAt: '2026-11-01T00:00:00Z' }));
    const res = await request(app).get('/api/tasks');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((t) => t.title), ['Sooner', 'Later']);
  });

  test('gets a task by id, 404 for unknown and 400 for invalid id', async () => {
    const { body } = await request(app).post('/api/tasks').send(newTask());
    assert.equal((await request(app).get(`/api/tasks/${body.id}`)).body.title, 'Write report');
    assert.equal((await request(app).get(`/api/tasks/${new mongoose.Types.ObjectId()}`)).status, 404);
    assert.equal((await request(app).get('/api/tasks/not-an-id')).status, 400);
  });
});

describe('PUT /api/tasks/:id', () => {
  test('updates provided fields only', async () => {
    const { body } = await request(app).post('/api/tasks').send(newTask());
    const res = await request(app).put(`/api/tasks/${body.id}`).send({ title: 'Updated', priority: 'Low' });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Updated');
    assert.equal(res.body.priority, 'Low');
    assert.equal(res.body.description, 'Quarterly numbers');
  });

  test('rejects an empty update and invalid values', async () => {
    const { body } = await request(app).post('/api/tasks').send(newTask());
    assert.equal((await request(app).put(`/api/tasks/${body.id}`).send({})).status, 400);
    assert.equal((await request(app).put(`/api/tasks/${body.id}`).send({ scheduledAt: 'nope' })).status, 400);
  });
});

describe('PATCH /api/tasks/:id/status', () => {
  test('marks a task completed and back', async () => {
    const { body } = await request(app).post('/api/tasks').send(newTask());
    let res = await request(app).patch(`/api/tasks/${body.id}/status`).send({ status: 'Completed' });
    assert.equal(res.body.status, 'Completed');
    res = await request(app).patch(`/api/tasks/${body.id}/status`).send({ status: 'In Progress' });
    assert.equal(res.body.status, 'In Progress');
  });

  test('rejects unknown statuses', async () => {
    const { body } = await request(app).post('/api/tasks').send(newTask());
    const res = await request(app).patch(`/api/tasks/${body.id}/status`).send({ status: 'Done' });
    assert.equal(res.status, 400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  test('deletes a task, then 404s', async () => {
    const { body } = await request(app).post('/api/tasks').send(newTask());
    assert.equal((await request(app).delete(`/api/tasks/${body.id}`)).status, 204);
    assert.equal((await request(app).delete(`/api/tasks/${body.id}`)).status, 404);
  });
});

describe('GET /api/tasks/search', () => {
  test('matches title or description, case-insensitively', async () => {
    await request(app).post('/api/tasks').send(newTask({ title: 'Buy groceries', description: 'milk' }));
    await request(app).post('/api/tasks').send(newTask({ title: 'Gym', description: 'Leg day, then MILKshake' }));
    await request(app).post('/api/tasks').send(newTask({ title: 'Read', description: '' }));

    const res = await request(app).get('/api/tasks/search').query({ q: 'milk' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((t) => t.title).sort(), ['Buy groceries', 'Gym']);
  });

  test('treats regex characters literally and returns [] for empty query', async () => {
    await request(app).post('/api/tasks').send(newTask({ title: 'Fix (urgent) bug' }));
    assert.equal((await request(app).get('/api/tasks/search').query({ q: '(urgent)' })).body.length, 1);
    assert.equal((await request(app).get('/api/tasks/search').query({ q: '.*' })).body.length, 0);
    assert.deepEqual((await request(app).get('/api/tasks/search')).body, []);
  });
});

describe('GET /api/tasks/weekly', () => {
  beforeEach(async () => {
    // times picked around the Sunday/Monday boundary in IST (UTC+5:30)
    await Task.create([
      { title: 'Mon morning IST', scheduledAt: '2026-11-09T03:30:00Z' }, // Mon 09:00 IST
      { title: 'Sun night IST', scheduledAt: '2026-11-15T18:00:00Z', status: 'Completed' }, // Sun 23:30 IST
      { title: 'Next Mon IST', scheduledAt: '2026-11-15T19:00:00Z' }, // Mon 00:30 IST
    ]);
  });

  test('groups by Monday-Sunday weeks in the client timezone', async () => {
    const res = await request(app).get('/api/tasks/weekly').query({ tz: 'Asia/Kolkata' });
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((w) => ({ s: w.weekStart, e: w.weekEnd, o: w.openTasks, c: w.completedTasks })),
      [
        { s: '2026-11-09', e: '2026-11-15', o: 1, c: 1 },
        { s: '2026-11-16', e: '2026-11-22', o: 1, c: 0 },
      ]
    );
  });

  test('filters by local start/end date range', async () => {
    const res = await request(app)
      .get('/api/tasks/weekly')
      .query({ tz: 'Asia/Kolkata', startDate: '2026-11-09', endDate: '2026-11-15' });
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].tasks.length, 2);
  });

  test('validates query parameters', async () => {
    assert.equal((await request(app).get('/api/tasks/weekly').query({ tz: 'Mars/Base' })).status, 400);
    assert.equal((await request(app).get('/api/tasks/weekly').query({ startDate: '2026-13-01' })).status, 400);
    assert.equal(
      (await request(app).get('/api/tasks/weekly').query({ startDate: '2026-11-20', endDate: '2026-11-01' })).status,
      400
    );
  });
});

test('unknown routes return 404 JSON', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.ok(res.body.error.message);
});
