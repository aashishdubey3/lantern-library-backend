const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path if needed
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('📚 Connected to DB. Initiating protocol: Scorched Earth... 🔥');
    
    // Delete every single document in the User collection
    const result = await User.deleteMany({});
    
    console.log(`🔥 Success! ${result.deletedCount} test accounts have been burned to ash.`);
    
    // Disconnect and close the script
    mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Connection error:', err);
    process.exit(1);
  });