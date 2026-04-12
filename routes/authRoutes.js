const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const User = require('../models/User');

// 1. Setup OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

// 2. Transporter Generator (API Method)
const createTransporter = async () => {
  try {
    const { token } = await oauth2Client.getAccessToken();
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: token,
      },
    });
  } catch (err) {
    throw new Error("OAuth Token Generation Failed: " + err.message);
  }
};

// 3. REGISTER
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const newUser = new User({ username, email, password: hashedPassword, verificationToken, isVerified: false });
    await newUser.save();

    const transporter = await createTransporter();
    const verifyLink = `${process.env.FRONTEND_URL}/verify/${verificationToken}`;
    
    await transporter.sendMail({
      from: `"The Lantern Library" <${process.env.EMAIL_USER}>`,
      to: newUser.email,
      subject: "Verify Your Account",
      html: `<div style="background:#1a1a2e; color:#fff; padding:20px; text-align:center;">
               <h2>Welcome Scholar</h2>
               <a href="${verifyLink}" style="background:#f39c12; padding:10px; color:#1a1a2e; text-decoration:none;">Verify Account</a>
             </div>`
    });
    res.status(201).json({ message: "Check your email!" });
  } catch (error) {
    res.status(500).json({ message: "🚨 BUG: " + error.message });
  }
});

// 4. FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "Email not found." });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const transporter = await createTransporter();
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: `"The Lantern Library" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset",
      html: `<a href="${resetLink}">Reset Password</a>`
    });
    res.status(200).json({ message: "Reset link sent!" });
  } catch (error) {
    res.status(500).json({ message: "🚨 BUG: " + error.message });
  }
});

// 5. VERIFY EMAIL
router.get('/verify/:token', async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.status(400).send("Invalid Token");
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    res.send("<h1>Verified! You can now log in.</h1>");
  } catch (err) { res.status(500).send("Verification Error"); }
});

// 6. LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isVerified || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid or Unverified" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { username: user.username, email: user.email } });
  } catch (err) { res.status(500).send("Login Error"); }
});

// 7. RESET PASSWORD
router.post('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: "Expired link" });
    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: "Success!" });
  } catch (err) { res.status(500).send("Reset Error"); }
});

module.exports = router;
