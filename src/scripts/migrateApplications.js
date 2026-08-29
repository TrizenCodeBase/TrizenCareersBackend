import mongoose from 'mongoose';
import { getApplicationModel, COLLECTION_MAPPING } from '../models/ApplicationFactory.js';
import Application from '../models/Application.js';
import dotenv from 'dotenv';
import { connectMongo } from '../config/mongodb.js';

dotenv.config();

const migrateApplications = async () => {
  try {
    // Connect to MongoDB
    await connectMongo();
    console.log('Connected to MongoDB');

    // Get all existing applications
    const existingApplications = await Application.find({});
    console.log(`Found ${existingApplications.length} existing applications to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const app of existingApplications) {
      try {
        // Check if jobId is supported
        if (!COLLECTION_MAPPING[app.jobId]) {
          console.log(`Skipping application ${app._id} - unsupported jobId: ${app.jobId}`);
          skippedCount++;
          continue;
        }

        // Get the appropriate model for this job
        const ApplicationModel = getApplicationModel(app.jobId);

        // Check if application already exists in the new collection
        const existingApp = await ApplicationModel.findOne({
          appliedBy: app.appliedBy,
          email: app.email
        });

        if (existingApp) {
          console.log(`Skipping application ${app._id} - already exists in ${COLLECTION_MAPPING[app.jobId]}`);
          skippedCount++;
          continue;
        }

        // Create application in the new collection
        const newApp = await ApplicationModel.create({
          ...app.toObject(),
          _id: app._id, // Preserve original ID
          createdAt: app.createdAt,
          updatedAt: app.updatedAt
        });

        console.log(`Migrated application ${app._id} to ${COLLECTION_MAPPING[app.jobId]}`);
        migratedCount++;

      } catch (error) {
        console.error(`Error migrating application ${app._id}:`, error.message);
        skippedCount++;
      }
    }

    console.log(`\nMigration completed:`);
    console.log(`- Migrated: ${migratedCount} applications`);
    console.log(`- Skipped: ${skippedCount} applications`);
    console.log(`- Total processed: ${migratedCount + skippedCount} applications`);

    // Optional: Remove old applications after successful migration
    // Uncomment the following lines if you want to remove the old collection
    /*
    if (migratedCount > 0) {
      console.log('\nRemoving old applications collection...');
      await Application.deleteMany({});
      console.log('Old applications collection cleared');
    }
    */

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateApplications();
}

export default migrateApplications;

