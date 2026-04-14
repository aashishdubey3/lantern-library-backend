const mongoose = require('mongoose');

const ArchivedPageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  theme: { type: String, default: 'parchment' },
  pages: { type: Array, default: [] }, // 🔥 THIS MUST BE HERE OR PAGES ARE DELETED!
  items: { type: Array, default: [] }, // Failsafe for older saves
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ArchivedPage', ArchivedPageSchema);