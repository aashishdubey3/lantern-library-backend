const express = require('express');
const router = express.Router();
const Journal = require('../models/Journal');
const ArchivedPage = require('../models/ArchivedPage'); 
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

// 🔥 SAVE TO VAULT (Now accepts full Notebooks)
router.post('/archive', authMiddleware, async (req, res) => {
  try {
    // Extracts both 'pages' (new layout) and 'items' (fallback)
    const { title, theme, pages, items } = req.body;
    const newArchive = new ArchivedPage({ userId: req.user.id, title, theme, pages, items });
    await newArchive.save();
    res.status(201).json({ message: "Sent to the archives!", archive: newArchive });
  } catch (error) {
    res.status(500).json({ message: "Failed to archive page." });
  }
});

// FETCH ALL VAULTS
router.get('/archive', authMiddleware, async (req, res) => {
  try {
    const archives = await ArchivedPage.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(archives);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch archives." });
  }
});

// 🔥 BULLETPROOF DELETE VAULT
router.delete('/archive/:id', authMiddleware, async (req, res) => {
  try {
    // 1. Ensure the vault belongs to this user
    const archive = await ArchivedPage.findOne({ _id: req.params.id, userId: req.user.id });
    if (!archive) return res.status(404).json({ message: "Vault not found." });
    
    // 2. Safely delete it
    await ArchivedPage.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Vault permanently burned." });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: "Server Error: Failed to delete vault." }); 
  }
});

// 🔥 RESTORE VAULT TO DESK ("Edit on Desk" Button)
router.post('/archive/restore/:id', authMiddleware, async (req, res) => {
  try {
    // 1. Find the vault they want to edit
    const archive = await ArchivedPage.findOne({ _id: req.params.id, userId: req.user.id });
    if (!archive) return res.status(404).json({ message: "Vault not found." });

    // 2. Prepare the pages to restore (handles old single-page saves safely)
    const pagesToRestore = archive.pages && archive.pages.length > 0 
      ? archive.pages 
      : [{ id: Date.now(), name: 'Restored Page', items: archive.items || [] }];

    // 3. Overwrite their current active desk
    let desk = await Journal.findOne({ userId: req.user.id });
    if (!desk) {
       desk = new Journal({ userId: req.user.id, pages: pagesToRestore, theme: archive.theme });
    } else {
       desk.pages = pagesToRestore;
       desk.theme = archive.theme;
       desk.lastUpdated = Date.now();
       desk.markModified('pages');
    }
    
    await desk.save();
    res.json({ message: "Restored to active desk!" });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: "Failed to restore." }); 
  }
});

module.exports = router;