const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { google } = require('googleapis');
const User = require('../models/User');

// --- 1. GOOGLE API CONFIG (HTTP METHOD, NO SMTP, NO PORT 465) ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const sendMailAPI = async (options) => {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
  const messageParts = [
    `From: "The Lantern Library" <${process.env.EMAIL_USER}>`,
    `To: ${options.to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    options.html,
  ];
  
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  });
};

// --- 2. REGISTER ROUTE ---
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "A scholar with this email already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    
    const newUser = new User({ 
      username, 
      email, 
      password: hashedPassword, 
      verificationToken: token, 
      isVerified: false 
    });
    await newUser.save();

    const verifyLink = `${process.env.FRONTEND_URL}/verify/${token}`;
    await sendMailAPI({
      to: email,
      subject: "Welcome Scholar - Verify Your Archives",
      html: `
        <div style="background: #1a1a2e; color: #ecf0f1; padding: 30px; text-align: center; border: 1px solid #f39c12; border-radius: 10px;">
          <h2 style="color: #f39c12;">Welcome to The Lantern Library</h2>
          <p>We must verify your identity before granting access to the archives.</p>
          <a href="${verifyLink}" style="display: inline-block; padding: 12px 25px; margin-top: 20px; background: #f39c12; color: #1a1a2e; text-decoration: none; font-weight: bold; border-radius: 5px;">Verify My Account</a>
        </div>
      `
    });

    res.status(201).json({ message: "Registration successful! Please check your email." });
  } catch (err) {
    console.error("🚨 Register Error:", err);
    res.status(500).json({ message: "🚨 BUG: " + (err.message || err) });
  }
});

// --- 3. FORGOT PASSWORD ROUTE ---
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "If that email exists, a reset link has been sent." });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendMailAPI({
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <div style="background: #1a1a2e; color: #ecf0f1; padding: 30px; text-align: center; border: 1px solid #f39c12; border-radius: 10px;">
          <h2 style="color: #f39c12;">Reset Your Password</h2>
          <p>You requested a password reset. Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 25px; margin-top: 20px; background: #f39c12; color: #1a1a2e; text-decoration: none; font-weight: bold; border-radius: 5px;">Reset Password</a>
        </div>
      `
    });

    res.status(200).json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("🚨 Forgot Password Error:", err);
    res.status(500).json({ message: "🚨 BUG: " + (err.message || err) });
  }
});

// --- 4. VERIFY EMAIL ROUTE ---
router.get('/verify/:token', async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.status(400).json({ message: "Invalid or expired link." });
    
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    
    res.status(200).json({ message: "Account verified successfully! You may now log in." });
  } catch (err) {
    res.status(500).json({ message: "Verification failed." });
  }
});

// --- 5. LOGIN ROUTE ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid credentials." });
    }
    
    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email before entering the archives." });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    const userObject = user.toObject();
    delete userObject.password;
    
    res.json({ token, user: userObject });
  } catch (err) {
    res.status(500).json({ message: "Login failed." });
  }
});

// --- 6. RESET PASSWORD ROUTE ---
router.post('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({ 
      resetPasswordToken: req.params.token, 
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) return res.status(400).json({ message: "Link expired or invalid." });

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password updated successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Reset failed." });
  }
});

// --- 7. RESEND VERIFICATION EMAIL ROUTE ---
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "No scholar found with that email." });
    if (user.isVerified) return res.status(400).json({ message: "Account already verified! Please log in." });

    const newToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = newToken;
    await user.save();

    const verifyLink = `${process.env.FRONTEND_URL}/verify/${newToken}`;
    await sendMailAPI({
      to: user.email,
      subject: "Resend: Verify Your Archives",
      html: `
        <div style="background: #1a1a2e; color: #ecf0f1; padding: 30px; text-align: center; border: 1px solid #f39c12; border-radius: 10px;">
          <h2 style="color: #f39c12;">Welcome back to The Lantern Library</h2>
          <p>You requested a new verification link. Click below to unlock the archives.</p>
          <a href="${verifyLink}" style="display: inline-block; padding: 12px 25px; margin-top: 20px; background: #f39c12; color: #1a1a2e; text-decoration: none; font-weight: bold; border-radius: 5px;">Verify My Account</a>
        </div>
      `
    });

    res.status(200).json({ message: "A new verification link has been sent to your email!" });
  } catch (err) {
    console.error("🚨 Resend Verification Error:", err);
    res.status(500).json({ message: "🚨 BUG: " + (err.message || err) });
  }
});

module.exports = router;
