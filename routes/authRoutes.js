const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const User = require('../models/User');

// --- GOOGLE OAUTH CONFIG ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const sendMailAPI = async (options) => {
  const { token } = await oauth2Client.getAccessToken();
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_USER,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      accessToken: token,
    },
  });
  return await transport.sendMail(options);
};

// --- ROUTES ---

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Scholar already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const newUser = new User({ username, email, password: hashedPassword, verificationToken: token, isVerified: false });
    await newUser.save();

    const verifyLink = `${process.env.FRONTEND_URL}/verify/${token}`;
    await sendMailAPI({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify Your Archive Access",
      html: `Click here: <a href="${verifyLink}">${verifyLink}</a>`
    });

    res.status(201).json({ message: "Verification sent!" });
  } catch (err) {
    res.status(500).json({ message: "🚨 SYSTEM ERROR: " + err.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "Email not found." });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendMailAPI({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Library Password Reset",
      html: `Reset here: <a href="${resetLink}">${resetLink}</a>`
    });

    res.status(200).json({ message: "Reset link dispatched!" });
  } catch (err) {
    res.status(500).json({ message: "🚨 SYSTEM ERROR: " + err.message });
  }
});

// --- VERIFY, LOGIN, RESET ---
router.get('/verify/:token', async (req, res) => {
  const user = await User.findOne({ verificationToken: req.params.token });
  if (!user) return res.status(400).send("Invalid link");
  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();
  res.send("<h1>Verified! Return to the library and log in.</h1>");
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !user.isVerified || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials or unverified email." });
  }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { username: user.username, email: user.email } });
});

router.post('/reset-password/:token', async (req, res) => {
  const user = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if (!user) return res.status(400).json({ message: "Link expired" });
  user.password = await bcrypt.hash(req.body.password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  res.json({ message: "Password updated!" });
});

module.exports = router;
