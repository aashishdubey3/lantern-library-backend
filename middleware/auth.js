const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // 1. Grab the token from the request header
  let token = req.header('Authorization');

  // 2. If there is no token at all, block the door
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied.' });
  }

  // 3. 🔥 THE FIX: Chop off the word "Bearer " so we only verify the raw gibberish!
  if (token.startsWith('Bearer ')) {
    token = token.slice(7, token.length).trimLeft();
  }

  // 4. Verify the raw token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Let the user through!
    next();
  } catch (err) {
    console.error("Token Verification Failed:", err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};