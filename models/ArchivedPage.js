const mongoose = require('mongoose');

const ArchivedPageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  theme: { type: String, default: 'parchment' },
  items: { type: Array, default: [] }, // The layout of all the stickers, notes, and photos
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ArchivedPage', ArchivedPageSchema);