const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 

require('dotenv').config();

// 📥 IMPORT ALL YOUR ROUTES HERE
const authRoutes = require('./routes/authRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const aiRoutes = require('./routes/aiRoutes');
const articleRoutes = require('./routes/articleRoutes');
const userRoutes = require('./routes/userRoutes');
const discussionRoutes = require('./routes/discussionRoutes'); 
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);

// 🔥 UPGRADED: Socket.io with Bulletproof CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Allows Vercel to connect without trailing-slash errors
    methods: ["GET", "POST"]
  }
});

// ==========================================
// 🔥 BULLETPROOF API CORS & PAYLOAD LIMITS
// ==========================================
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"] // Explicitly allows your Bearer token!
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Apply Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/notifications', notificationRoutes);

// ==========================================
// 📚 DATABASE CONNECTION
// ==========================================
mongoose.connect(process.env.MONGO_URI, {
  family: 4, 
})
  .then(() => console.log('📚 Connected to The Lantern Library Database (IPv4 Forced)'))
  .catch((err) => console.log('Database connection error:', err));

app.get('/', (req, res) => {
  res.send('The Lantern Library API is running...');
});

// 🔥 TRACK WHO IS CURRENTLY ONLINE
const onlineScholars = new Map();

io.on('connection', (socket) => {
  console.log('⚡ A socket connected:', socket.id);

  // 1. Register User (Now handles proper _id)
  socket.on('register_scholar', (userId) => {
    if (userId) {
      onlineScholars.set(userId.toString(), socket.id);
      console.log(`✅ Scholar Registered Online: ${userId}`);
    }
  });

  // 2. Real-Time Online Status Check
  socket.on('check_online_status', (targetUserId) => {
    const isOnline = onlineScholars.has(targetUserId.toString());
    socket.emit('online_status_result', { userId: targetUserId, isOnline });
  });

  // 3. Group Lounge 
  socket.on('join_topic', (topicId) => {
    socket.join(topicId);
  });
  socket.on('send_reply', (data) => {
    socket.to(data.topicId).emit('receive_reply', data.replyData);
  });

  // 4. PRIVATE DIRECT MESSAGING
  socket.on('send_private_message', (data) => {
    const receiverSocketId = onlineScholars.get(data.receiverId.toString());
    
    if (receiverSocketId) {
      console.log(`📬 Routing private message to: ${data.receiverId}`);
      io.to(receiverSocketId).emit('receive_private_message', data.message);
    } else {
      console.log(`💤 Scholar ${data.receiverId} is offline. Message saved to DB only.`);
    }
  });

  // 5. GROUP CHAT MESSAGING
  socket.on('join_group_chat', (groupId) => {
    socket.join(groupId); 
  });

  socket.on('send_group_message', (data) => {
    socket.to(data.groupId).emit('receive_group_message', data.message);
  });

  // 6. LIVE NOTIFICATION PING
  socket.on('send_notification_ping', (data) => {
    const targetSocketId = onlineScholars.get(data.targetUserId.toString());
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive_notification_ping', data);
    }
  });

  // 7. Disconnect logic
  socket.on('disconnect', () => {
    for (let [userId, socketId] of onlineScholars.entries()) {
      if (socketId === socket.id) {
        onlineScholars.delete(userId);
        console.log(`❌ Scholar went offline: ${userId}`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server & Live Sockets are glowing on port ${PORT}`);
});