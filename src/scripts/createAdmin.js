import dotenv from 'dotenv';
import User from '../models/User.js';
import { connectMongo } from '../config/mongodb.js';

dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable is not set');
      process.exit(1);
    }

    await connectMongo();
    console.log('✅ Connected to MongoDB');

    // Get admin details from command line arguments or use defaults
    const email = process.argv[2] || 'admin@trizenventures.com';
    const password = process.argv[3] || 'Admin@123';
    const username = process.argv[4] || 'admin';
    const firstName = process.argv[5] || 'Admin';
    const lastName = process.argv[6] || 'User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log('⚠️  Admin user already exists with this email/username');
        console.log(`   Email: ${existingAdmin.email}`);
        console.log(`   Username: ${existingAdmin.username}`);
        console.log(`   Role: ${existingAdmin.role}`);
        process.exit(0);
      } else {
        // Update existing user to admin
        existingAdmin.role = 'admin';
        existingAdmin.password = password; // Will be hashed by pre-save hook
        await existingAdmin.save();
        console.log('✅ Existing user upgraded to admin');
        console.log(`   Email: ${existingAdmin.email}`);
        console.log(`   Username: ${existingAdmin.username}`);
        process.exit(0);
      }
    }

    // Create new admin user
    const admin = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!');
    console.log('\n📋 Admin Credentials:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${admin.role}`);
    console.log('\n⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin();

