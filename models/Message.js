const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional now (if it's a group)
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupChat' }, // Optional (if it's 1-on-1)
  text: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);