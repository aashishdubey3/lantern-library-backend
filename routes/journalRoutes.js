const express = require('express');
const router = express.Router();
const Journal = require('../models/Journal');
const ArchivedPage = require('../models/ArchivedPage'); // 🔥 Import the new model
const authMiddleware = require('../middleware/auth');

// ==========================================
// 📥 THE ACTIVE DESK ROUTES
// ==========================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    let desk = await Journal.findOne({ userId: req.user.id });
    if (!desk) desk = { theme: 'leather', pages: [{ id: Date.now(), name: 'Page 1', items: [] }] };
    res.json(desk);
  } catch (err) { res.status(500).json({ message: "Failed to load desk." }); }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { pages, theme } = req.body;
    let desk = await Journal.findOne({ userId: req.user.id });
    if (!desk) desk = new Journal({ userId: req.user.id, pages, theme });
    else { desk.pages = pages; desk.theme = theme; desk.lastUpdated = Date.now(); desk.markModified('pages'); }
    await desk.save();
    res.json({ message: "Desk saved perfectly!" });
  } catch (err) { res.status(500).json({ message: "Failed to save desk." }); }
});

// ==========================================
// 🗄️ THE ARCHIVE DRAWER ROUTES (Permanent Snapshots)
// ==========================================

// Save a specific page to the Archives
router.post('/archive', authMiddleware, async (req, res) => {
  try {
    const { title, theme, items } = req.body;
    const newArchive = new ArchivedPage({ userId: req.user.id, title, theme, items });
    await newArchive.save();
    res.status(201).json({ message: "Sent to the archives!", archive: newArchive });
  } catch (error) {
    res.status(500).json({ message: "Failed to archive page." });
  }
});

// Fetch all archived pages for the user
router.get('/archive', authMiddleware, async (req, res) => {
  try {
    const archives = await ArchivedPage.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(archives);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch archives." });
  }
});

module.exports = router;