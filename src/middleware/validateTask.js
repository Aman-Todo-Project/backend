const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { PRIORITIES, STATUSES } = require('../models/Task');

const isString = (value) => typeof value === 'string';

// partial = true is used for updates, where every field is optional
function buildTaskValidator({ partial }) {
  return (req, res, next) => {
    const body = req.body || {};
    const errors = {};
    const data = {};

    if (body.title !== undefined || !partial) {
      if (!isString(body.title) || !body.title.trim()) errors.title = 'Title is required';
      else if (body.title.trim().length > 120) errors.title = 'Title must be at most 120 characters';
      else data.title = body.title.trim();
    }

    if (body.description === null) {
      data.description = '';
    } else if (body.description !== undefined) {
      if (!isString(body.description)) errors.description = 'Description must be text';
      else if (body.description.trim().length > 1000) errors.description = 'Description must be at most 1000 characters';
      else data.description = body.description.trim();
    }

    if (body.scheduledAt !== undefined || !partial) {
      const valid = isString(body.scheduledAt) || typeof body.scheduledAt === 'number';
      const date = valid ? new Date(body.scheduledAt) : null;
      if (!date || Number.isNaN(date.getTime())) errors.scheduledAt = 'A valid date & time is required';
      else data.scheduledAt = date;
    }

    // Optional; null or '' clears it.
    if (body.endAt === null || body.endAt === '') {
      data.endAt = null;
    } else if (body.endAt !== undefined) {
      const valid = isString(body.endAt) || typeof body.endAt === 'number';
      const date = valid ? new Date(body.endAt) : null;
      if (!date || Number.isNaN(date.getTime())) errors.endAt = 'End time must be a valid date & time';
      else if (data.scheduledAt && date <= data.scheduledAt) errors.endAt = 'End time must be after the start time';
      else data.endAt = date;
    }

    if (body.priority !== undefined && body.priority !== null && body.priority !== '') {
      if (!PRIORITIES.includes(body.priority)) errors.priority = 'Priority must be Low, Medium or High';
      else data.priority = body.priority;
    }

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) errors.status = 'Status must be In Progress or Completed';
      else data.status = body.status;
    }

    if (Object.keys(errors).length) return next(ApiError.badRequest('Validation failed', errors));
    if (partial && !Object.keys(data).length) return next(ApiError.badRequest('No valid fields to update'));

    req.validatedBody = data;
    next();
  };
}

function validateStatus(req, res, next) {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) {
    return next(ApiError.badRequest('Validation failed', { status: 'Status must be In Progress or Completed' }));
  }
  next();
}

function validateObjectId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return next(ApiError.badRequest('Invalid task id'));
  next();
}

module.exports = {
  validateCreateTask: buildTaskValidator({ partial: false }),
  validateUpdateTask: buildTaskValidator({ partial: true }),
  validateStatus,
  validateObjectId,
};
