const mongoose = require('mongoose');

const JournalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  theme: { type: String, default: 'leather' }, // 🔥 Remembers their desk background!
  pages: { type: Array, default: [] }, 
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Journal', JournalSchema);