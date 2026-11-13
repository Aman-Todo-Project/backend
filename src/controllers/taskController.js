const taskService = require('../services/taskService');
const ApiError = require('../utils/ApiError');
const { isValidDateKey, isValidTimeZone } = require('../utils/week');
const { DEFAULT_TIMEZONE } = require('../config/env');

async function list(req, res) {
  res.json(await taskService.listTasks());
}

async function getById(req, res) {
  res.json(await taskService.getTask(req.params.id));
}

async function create(req, res) {
  const task = await taskService.createTask(req.validatedBody);
  res.status(201).json(task);
}

async function update(req, res) {
  res.json(await taskService.updateTask(req.params.id, req.validatedBody));
}

async function updateStatus(req, res) {
  res.json(await taskService.updateTask(req.params.id, { status: req.body.status }));
}

async function remove(req, res) {
  await taskService.deleteTask(req.params.id);
  res.status(204).end();
}

async function search(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (q.length > 100) throw ApiError.badRequest('Search query must be at most 100 characters');
  res.json(await taskService.searchTasks(q));
}

async function weekly(req, res) {
  const { startDate, endDate } = req.query;
  const timeZone = req.query.tz || DEFAULT_TIMEZONE;

  if (!isValidTimeZone(timeZone)) throw ApiError.badRequest('Invalid timezone (tz)');
  if (startDate && !isValidDateKey(startDate)) throw ApiError.badRequest('startDate must be YYYY-MM-DD');
  if (endDate && !isValidDateKey(endDate)) throw ApiError.badRequest('endDate must be YYYY-MM-DD');
  if (startDate && endDate && startDate > endDate) {
    throw ApiError.badRequest('startDate must be on or before endDate');
  }

  res.json(await taskService.getWeeklyTasks({ startDate, endDate, timeZone }));
}

module.exports = { list, getById, create, update, updateStatus, remove, search, weekly };
