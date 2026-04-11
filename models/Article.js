const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true }, 
  snippet: { type: String }, 
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true }, 
  tags: [{ type: String }],
  source: { type: String, default: 'Community Scholar' },
  
  // 🔥 THIS IS THE MAGIC LINE MONGODB WAS MISSING
  isPrivate: { type: Boolean, default: false } 
  
}, { timestamps: true });

module.exports = mongoose.model('Article', articleSchema);