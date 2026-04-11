const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  externalId: { type: String, required: true }, // The ID from Google Books or TMDB
  title: { type: String, required: true },
  creator: { type: String }, // Author or Director
  blurb: { type: String },   // The summary for your hover effect
  coverImage: { type: String },
  mediaType: { type: String, enum: ['book', 'movie', 'series'], required: true },
});

module.exports = mongoose.model('Media', mediaSchema);