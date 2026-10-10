import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Job from '../models/Job.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedJobsIfEmpty() {
  try {
    const count = await Job.countDocuments();
    if (count > 0) {
      logger.info(`Database already contains ${count} jobs, skipping initial seed.`);
      return;
    }

    const dataPath = path.join(__dirname, '../data/jobs.json');
    if (!fs.existsSync(dataPath)) {
      logger.warn(`Initial jobs file not found at ${dataPath}`);
      return;
    }

    const raw = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const archivedJobs = Array.isArray(data.archivedJobs) ? data.archivedJobs : [];

    const jobsToInsert = [
      ...jobs.map((j) => ({
        ...j,
        status: j.status || 'published',
        closedDate: j.closedDate || null,
        isArchived: false,
      })),
      ...archivedJobs.map((j) => ({
        ...j,
        status: 'closed',
        closedDate: j.closedDate || j.postedDate || new Date().toISOString().split('T')[0],
        isArchived: true,
      })),
    ];

    if (jobsToInsert.length === 0) {
      logger.info('No jobs found to seed.');
      return;
    }

    await Job.insertMany(jobsToInsert, { ordered: false });
    logger.info(`Successfully seeded ${jobsToInsert.length} jobs into MongoDB.`);
  } catch (error) {
    logger.error('Error seeding initial jobs:', error.message || error);
  }
}

// Allow direct execution via `node src/scripts/seedJobs.js`
if (process.argv[1] && process.argv[1].endsWith('seedJobs.js')) {
  const { connectMongo } = await import('../config/mongodb.js');
  const dotenv = (await import('dotenv')).default;
  dotenv.config();

  try {
    await connectMongo();
    await seedJobsIfEmpty();
    process.exit(0);
  } catch (err) {
    console.error('Seed script failed:', err);
    process.exit(1);
  }
}

export default seedJobsIfEmpty;
