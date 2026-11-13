const mongoose = require('mongoose');

const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['In Progress', 'Completed'];

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description must be at most 1000 characters'],
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Date & time is required'],
    },
    priority: {
      type: String,
      enum: { values: PRIORITIES, message: 'Priority must be Low, Medium or High' },
      default: 'Medium',
    },
    status: {
      type: String,
      enum: { values: STATUSES, message: 'Status must be In Progress or Completed' },
      default: 'In Progress',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        delete ret._id;
        return ret;
      },
    },
  }
);

taskSchema.index({ scheduledAt: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = { Task, PRIORITIES, STATUSES };
