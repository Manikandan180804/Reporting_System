const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  category: {
    type: String,
    enum: ['IT', 'HR', 'Facility'],
    default: 'IT',
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Low',
  },
  status: {
    type: String,
    enum: ['Open', 'Investigating', 'Resolved'],
    default: 'Open',
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reporterName: String,
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assigneeName: String,
  assignedTeam: String,
  statusHistory: [
    {
      fromStatus: { type: String, enum: ['Open', 'Investigating', 'Resolved'], default: null },
      toStatus: { type: String, enum: ['Open', 'Investigating', 'Resolved'], required: true },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      changedByName: String,
      note: String,
      changedAt: { type: Date, default: Date.now },
    }
  ],
  comments: [
    {
      text: String,
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      createdAt: { type: Date, default: Date.now },
    }
  ],
  attachments: [
    {
      url: String,
      filename: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadedAt: { type: Date, default: Date.now },
    }
  ],
  activity: [
    {
      type: { type: String },
      message: String,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      byName: String,
      at: { type: Date, default: Date.now },
      meta: mongoose.Schema.Types.Mixed,
    }
  ],
  watchers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
}, {
  timestamps: true,
});

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;