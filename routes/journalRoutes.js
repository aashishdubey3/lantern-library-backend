const express = require('express');
const router = express.Router();
const Journal = require('../models/Journal');
const authMiddleware = require('../middleware/auth');

// 📥 LOAD THE DESK
router.get('/', authMiddleware, async (req, res) => {
  try {
    let desk = await Journal.findOne({ userId: req.user.id });
    if (!desk) {
      desk = { theme: 'leather', pages: [{ id: Date.now(), name: 'Page 1', items: [] }] };
    }
    res.json(desk);
  } catch (err) {
    res.status(500).json({ message: "Failed to load desk." });
  }
});

// 📤 SAVE THE DESK
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { pages, theme } = req.body;
    let desk = await Journal.findOne({ userId: req.user.id });
    
    if (!desk) {
      desk = new Journal({ userId: req.user.id, pages, theme });
    } else {
      desk.pages = pages;
      desk.theme = theme;
      desk.lastUpdated = Date.now();
    }
    
    await desk.save();
    res.json({ message: "Desk saved perfectly!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save desk." });
  }
});

module.exports = router;