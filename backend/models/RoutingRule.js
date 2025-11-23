const mongoose = require('mongoose');

const routingRuleSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['IT', 'HR', 'Facility', 'Network', 'Software', 'Hardware', 'Other'],
    required: true,
  },
  assignedTeam: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priority: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const RoutingRule = mongoose.model('RoutingRule', routingRuleSchema);

module.exports = RoutingRule;
