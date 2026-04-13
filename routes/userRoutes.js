const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Article = require('../models/Article');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const GroupChat = require('../models/GroupChat');
const authMiddleware = require('../middleware/auth');

// 👤 GET CURRENT USER PROFILE
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // --- 📅 STREAK CALCULATION ENGINE ---
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let saveRequired = false;

    if (!user.lastActiveDate) {
      user.currentStreak = 1;
      user.lastActiveDate = today;
      saveRequired = true;
    } else {
      const lastActive = new Date(user.lastActiveDate);
      const lastActiveNormalized = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
      
      const diffTime = Math.abs(today - lastActiveNormalized);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      if (diffDays === 1) {
        user.currentStreak += 1;
        user.lastActiveDate = today;
        saveRequired = true;
      } else if (diffDays > 1) {
        user.currentStreak = 1;
        user.lastActiveDate = today;
        saveRequired = true;
      }
    }

    if (saveRequired) await user.save();
    // ------------------------------------

    res.status(200).json(user);
  } catch (err) {
    console.error("Profile Fetch Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ⚙️ UPDATE USER PROFILE & SETTINGS
router.put('/update', authMiddleware, async (req, res) => {
  try {
    const { username, bio, interests, dailyArticleGoal, isLibraryPublic } = req.body;
    const user = await User.findById(req.user.id);
    
    if (username) user.username = username;
    if (bio) user.bio = bio;
    if (interests) user.interests = interests;
    if (dailyArticleGoal) user.dailyArticleGoal = dailyArticleGoal;
    if (isLibraryPublic !== undefined) user.isLibraryPublic = isLibraryPublic;
    
    await user.save();
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// 🔍 GET PUBLIC SCHOLAR PROFILE
router.get('/scholar/:id', async (req, res) => {
  try {
    const scholar = await User.findById(req.params.id).select('-password -email'); 
    if (!scholar) return res.status(404).json({ message: "Scholar not found." });
    
    const publicArticles = await Article.find({ authorId: req.params.id, isPrivate: false }).sort({ createdAt: -1 });
    res.status(200).json({ scholar, publicArticles });
  } catch (err) {
    res.status(500).json({ message: "Error retrieving archives." });
  }
});

// 🔎 GET: Search for scholars
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(200).json([]);

    const scholars = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: req.user.id } 
    })
    .select('username bio followers') 
    .limit(10); 

    res.status(200).json(scholars);
  } catch (err) {
    res.status(500).json({ message: "Error searching the archives." });
  }
});

// ➕ FOLLOW / UNFOLLOW A SCHOLAR
router.post('/follow/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.id === req.params.id) return res.status(400).json({ message: "A scholar cannot follow their own shadow." });

    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) return res.status(404).json({ message: "Scholar not found." });

    let isFollowing = false;

    if (currentUser.following.includes(req.params.id)) {
      currentUser.following = currentUser.following.filter(id => id.toString() !== req.params.id);
      targetUser.followers = targetUser.followers.filter(id => id.toString() !== req.user.id);
    } else {
      currentUser.following.push(req.params.id);
      targetUser.followers.push(req.user.id);
      isFollowing = true;
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ isFollowing, followingList: currentUser.following });
  } catch (err) {
    res.status(500).json({ message: "Error updating network." });
  }
});

// 🤝 SEND FRIEND REQUEST
router.post('/friend-request/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.id === req.params.id) return res.status(400).json({ message: "You cannot befriend yourself in the archives." });

    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: "Scholar not found." });

    if (!targetUser.friendRequests.includes(req.user.id) && !targetUser.friends.includes(req.user.id)) {
      targetUser.friendRequests.push(req.user.id);
      await targetUser.save();

      const newAlert = new Notification({
        recipientId: targetUser._id,
        senderId: currentUser._id,
        senderName: currentUser.username,
        type: 'friend_request',
        message: `${currentUser.username} sent you a friend request.`
      });
      await newAlert.save();
    }
    
    res.status(200).json({ message: "Request sent!" });
  } catch (err) { 
    res.status(500).json({ message: "Error sending request." }); 
  }
});

// ✅ ACCEPT FRIEND REQUEST
router.post('/accept-request/:id', authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(req.params.id);

    currentUser.friendRequests = currentUser.friendRequests.filter(id => id.toString() !== req.params.id);
    
    if (!currentUser.friends.includes(req.params.id)) currentUser.friends.push(req.params.id);
    if (!targetUser.friends.includes(req.user.id)) targetUser.friends.push(req.user.id);

    await currentUser.save();
    await targetUser.save();
    
    res.status(200).json({ friends: currentUser.friends, friendRequests: currentUser.friendRequests });
  } catch (err) { 
    res.status(500).json({ message: "Error accepting request." }); 
  }
});

// ❌ DECLINE REQUEST / UNFRIEND
router.post('/remove-friend/:id', authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(req.params.id);

    currentUser.friendRequests = currentUser.friendRequests.filter(id => id.toString() !== req.params.id);
    currentUser.friends = currentUser.friends.filter(id => id.toString() !== req.params.id);
    
    if (targetUser) {
      targetUser.friends = targetUser.friends.filter(id => id.toString() !== req.user.id);
      await targetUser.save();
    }

    await currentUser.save();
    res.status(200).json({ friends: currentUser.friends, friendRequests: currentUser.friendRequests });
  } catch (err) { 
    res.status(500).json({ message: "Error updating network." }); 
  }
});

// 🚫 BLOCK / UNBLOCK A SCHOLAR
router.post('/block/:id', authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const targetId = req.params.id;

    if (currentUser.blockedUsers.includes(targetId)) {
      currentUser.blockedUsers = currentUser.blockedUsers.filter(id => id.toString() !== targetId);
    } else {
      currentUser.blockedUsers.push(targetId);
      currentUser.following = currentUser.following.filter(id => id.toString() !== targetId);
      currentUser.followers = currentUser.followers.filter(id => id.toString() !== targetId);
      
      currentUser.friends = currentUser.friends.filter(id => id.toString() !== targetId);
      currentUser.friendRequests = currentUser.friendRequests.filter(id => id.toString() !== targetId);

      const targetUser = await User.findById(targetId);
      if (targetUser) {
        targetUser.following = targetUser.following.filter(id => id.toString() !== req.user.id);
        targetUser.followers = targetUser.followers.filter(id => id.toString() !== req.user.id);
        
        targetUser.friends = targetUser.friends.filter(id => id.toString() !== req.user.id);
        targetUser.friendRequests = targetUser.friendRequests.filter(id => id.toString() !== req.user.id);
        await targetUser.save();
      }
    }

    await currentUser.save();
    res.status(200).json({ blockedUsers: currentUser.blockedUsers });
  } catch (err) {
    res.status(500).json({ message: "Error updating block list." });
  }
});


// ==========================================
// 📖 LOG READING SESSION (Proof of Work)
// ==========================================
router.post('/log-read', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Scholar not found." });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // If this is their first read of the new day, reset the daily count to 0 first
    if (!user.lastActiveDate || user.lastActiveDate < today) {
       user.articlesReadToday = 0;
       user.lastActiveDate = today;
    }

    // Add +1 to their daily reading count!
    user.articlesReadToday += 1;
    await user.save();

    res.status(200).json({ 
      message: "Session logged! The archives have noted your diligence.",
      articlesReadToday: user.articlesReadToday,
      dailyGoal: user.dailyArticleGoal
    });
  } catch (err) {
    console.error("Log Read Error:", err);
    res.status(500).json({ message: "Failed to log reading session." });
  }
});


// ==========================================
// 📚 MEDIA LIST MANAGEMENT
// ==========================================
router.post('/add-item', authMiddleware, async (req, res) => {
  try {
    const { title, mediaType, coverImage, listType } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Scholar not found in the archives." });

    const newItem = { title, mediaType, coverImage: coverImage || 'https://placehold.co/150x220/2c3e50/ecf0f1?text=No+Cover', addedAt: new Date() };

    if (listType === 'currentlyConsuming') user.currentlyConsuming.push(newItem);
    else if (listType === 'finishedList') user.finishedList.push(newItem);
    else user.tbrList.push(newItem);

    await user.save();
    res.status(200).json({ message: "Successfully added to archives!", user });
  } catch (error) {
    res.status(500).json({ message: "Server error while adding item." });
  }
});

router.post('/move-item', authMiddleware, async (req, res) => {
  try {
    const { mediaId, currentList, targetList } = req.body;
    const user = await User.findById(req.user.id);

    const itemIndex = user[currentList].findIndex(item => item._id.toString() === mediaId);
    if (itemIndex === -1) return res.status(404).json({ message: 'Item not found in current list.' });

    const [itemToMove] = user[currentList].splice(itemIndex, 1);
    user[targetList].push(itemToMove);
    await user.save();

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error moving item' });
  }
});

router.post('/add-review', authMiddleware, async (req, res) => {
  try {
    const { mediaId, rating, reviewText } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.personalReviews || !(user.personalReviews instanceof Map)) {
      user.personalReviews = new Map(Object.entries(user.personalReviews || {}));
    }

    user.personalReviews.set(mediaId.toString(), { rating, reviewText, date: new Date() });
    await user.save();
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error adding review' });
  }
});

router.delete('/delete', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await Article.deleteMany({ authorId: userId });
    await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });
    await Notification.deleteMany({ $or: [{ recipientId: userId }, { senderId: userId }] });
    await GroupChat.updateMany({ members: userId }, { $pull: { members: userId } });
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "Scholar erased from the archives." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete account." });
  }
});

module.exports = router;