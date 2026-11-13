const { Task } = require('../models/Task');
const ApiError = require('../utils/ApiError');
const { groupTasksByWeek, startOfDayInZone, addDays } = require('../utils/week');

const SEARCH_LIMIT = 50;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function listTasks() {
  return Task.find().sort({ scheduledAt: 1 });
}

async function getTask(id) {
  const task = await Task.findById(id);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

function createTask(data) {
  return Task.create(data);
}

async function updateTask(id, data) {
  const task = await Task.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

async function deleteTask(id) {
  const task = await Task.findByIdAndDelete(id);
  if (!task) throw ApiError.notFound('Task not found');
}

function searchTasks(query) {
  const q = query.trim();
  if (!q) return [];

  const regex = new RegExp(escapeRegex(q), 'i');
  return Task.find({ $or: [{ title: regex }, { description: regex }] })
    .sort({ scheduledAt: 1 })
    .limit(SEARCH_LIMIT);
}

// startDate and endDate are local dates (YYYY-MM-DD) in the given timezone, both inclusive
async function getWeeklyTasks({ startDate, endDate, timeZone }) {
  const filter = {};
  if (startDate || endDate) {
    filter.scheduledAt = {};
    if (startDate) filter.scheduledAt.$gte = startOfDayInZone(startDate, timeZone);
    if (endDate) filter.scheduledAt.$lt = startOfDayInZone(addDays(endDate, 1), timeZone);
  }

  const tasks = await Task.find(filter).sort({ scheduledAt: 1 });
  return groupTasksByWeek(tasks.map((task) => task.toJSON()), timeZone);
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  searchTasks,
  getWeeklyTasks,
};
