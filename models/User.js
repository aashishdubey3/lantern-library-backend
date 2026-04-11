const mongoose = require('mongoose');

// 📦 Define what a media item looks like before putting it in a user's list
const mediaItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  mediaType: { type: String }, // 'book', 'movie', 'series', 'paper'
  coverImage: { type: String },
  addedAt: { type: Date, default: Date.now }
});

// 👤 Define the main User profile
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  bio: { type: String, default: "A wandering scholar of the archives." },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  interests: { type: [String], default: [] },


  
  // 🔥 NEW: Security & Verification
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  

  yearlyReadingGoal: { type: Number, default: 12 },
  currentStreak: { type: Number, default: 0 },
  lastActiveDate: { type: Date },

  // Habit Tracking
  currentStreak: { type: Number, default: 0 },
  lastStreakDate: { type: String }, // The last day they hit their GOAL
  lastActiveDate: { type: String }, // The last day they read ANYTHING
  articlesReadToday: { type: Number, default: 0 },
  dailyArticleGoal: { type: Number, default: 1 }, 
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isLibraryPublic: { type: Boolean, default: true }, 
  

  // 🔥 These arrays now use the mediaItemSchema instead of ObjectIds
  tbrList: [mediaItemSchema],
  currentlyConsuming: [mediaItemSchema],
  finishedList: [mediaItemSchema],

  // The personal review notebook
  personalReviews: { type: Map, of: Object, default: {} }
  
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);