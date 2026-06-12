import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALL_SUPPORTED_JOB_IDS } from '../src/config/jobRegistry.js';
import { COLLECTION_MAPPING } from '../src/models/ApplicationFactory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jobsPath = path.resolve(__dirname, '../../TrizenCareersFrontend/src/data/jobs.json');
const jobsData = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));

const openJobIds = jobsData.jobs
  .filter((job) => job.status !== 'closed')
  .map((job) => job.id);

const allListedIds = [
  ...jobsData.jobs.map((job) => job.id),
  ...(jobsData.archivedJobs || []).map((job) => job.id)
];

let failed = false;

for (const id of openJobIds) {
  if (!ALL_SUPPORTED_JOB_IDS.includes(id)) {
    console.error(`OPEN JOB NOT IN BACKEND REGISTRY: ${id}`);
    failed = true;
  }
  if (!COLLECTION_MAPPING[id]) {
    console.error(`OPEN JOB MISSING COLLECTION MAPPING: ${id}`);
    failed = true;
  }
}

for (const id of allListedIds) {
  if (!ALL_SUPPORTED_JOB_IDS.includes(id)) {
    console.warn(`Listed job not in backend registry (archived/legacy): ${id}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`OK: ${openJobIds.length} open jobs verified against backend registry.`);
console.log(`Backend supports ${ALL_SUPPORTED_JOB_IDS.length} job IDs total.`);
