/**
 * Single source of truth for supported application job IDs and metadata.
 * When adding a role in jobs.json, register it here and in ApplicationFactory mappings.
 */

export const JOB_TITLES = {
  'TV-AIML-INT-2025-001': 'AIML Intern',
  'TV-AIML-INT-2026-001': 'AIML Intern',
  'TV-AI-AUT-2026-001': 'Associate AI & Automation Engineer',
  'TV-AI-FS-2026-002': 'AI & Automation Engineer Intern (WhatsApp, AI Agents & Voice Automation)',
  'TV-WEB-MERN-2025-005': 'MERN Stack Developer Intern',
  'TV-WEB-MERN-2025-002': 'MERN Stack Developer Intern',
  'TV-WEB-MERN-2026-005': 'MERN Stack Developer Intern',
  'TV-WEB-MERN-2026-002': 'MERN Stack Developer Intern',
  'TV-WEB-MERN-2026-007': 'Full Stack Developer (MERN + React Native)',
  'TV-WEB-MERN-2026-008': 'Full Stack Developer Intern (MERN + React Native)',
  'TV-MKT-SMM-2025-003': 'Social Media Management Intern',
  'TV-MKT-SMM-2026-003': 'Social Media Management Intern',
  'TV-MKT-GME-2026-003': 'Growth Marketing Executive',
  'TV-MKT-CSM-2026-004': 'Content & Social Media Executive',
  'TV-MKT-GMI-2026-005': 'Growth Marketing Intern',
  'TV-MKT-CSMI-2026-006': 'Content & Social Media Intern',
  'TV-SLS-BDE-2026-009': 'Business Development Executive – IT Services'
};

export const ALL_SUPPORTED_JOB_IDS = Object.freeze(Object.keys(JOB_TITLES));

export const LEGACY_SMM_JOB_IDS = ['TV-MKT-SMM-2025-003', 'TV-MKT-SMM-2026-003'];
export const CONTENT_SOCIAL_MEDIA_JOB_IDS = ['TV-MKT-CSM-2026-004', 'TV-MKT-CSMI-2026-006'];
export const GROWTH_MARKETING_JOB_IDS = ['TV-MKT-GME-2026-003', 'TV-MKT-GMI-2026-005', 'TV-SLS-BDE-2026-009'];

export const MERN_INTERN_JOB_IDS = [
  'TV-WEB-MERN-2025-005',
  'TV-WEB-MERN-2025-002',
  'TV-WEB-MERN-2026-005',
  'TV-WEB-MERN-2026-002',
  'TV-WEB-MERN-2026-008'
];

export const MERN_FULLTIME_JOB_IDS = ['TV-WEB-MERN-2026-007'];
export const MERN_JOB_IDS = [...MERN_INTERN_JOB_IDS, ...MERN_FULLTIME_JOB_IDS];

export const ENGINEERING_FULLTIME_JOB_IDS = [
  'TV-AI-AUT-2026-001',
  'TV-WEB-MERN-2026-007'
];

export const ENGINEERING_INTERN_JOB_IDS = [
  'TV-AIML-INT-2025-001',
  'TV-AIML-INT-2026-001',
  'TV-AI-FS-2026-002',
  ...MERN_INTERN_JOB_IDS
];

export const isMarketingApplicationJob = (jobId) =>
  LEGACY_SMM_JOB_IDS.includes(jobId) ||
  CONTENT_SOCIAL_MEDIA_JOB_IDS.includes(jobId) ||
  GROWTH_MARKETING_JOB_IDS.includes(jobId);

export const isEngineeringFullTimeJob = (jobId) =>
  ENGINEERING_FULLTIME_JOB_IDS.includes(jobId);

export const isEngineeringInternJob = (jobId) =>
  ENGINEERING_INTERN_JOB_IDS.includes(jobId);

export const isMernJob = (jobId) => MERN_JOB_IDS.includes(jobId);

export const isMernFullTimeJob = (jobId) => MERN_FULLTIME_JOB_IDS.includes(jobId);

export const requiresYearOfPassingOut = (jobId) => {
  if (isMernFullTimeJob(jobId)) return true;
  if (isEngineeringFullTimeJob(jobId)) return false;
  return true;
};

export const getJobTitle = (jobId) => JOB_TITLES[jobId] || jobId;

export function assertRegistryMatchesMappings(collectionMapping) {
  const missing = ALL_SUPPORTED_JOB_IDS.filter((id) => !collectionMapping[id]);
  if (missing.length > 0) {
    throw new Error(
      `Job registry mismatch: missing ApplicationFactory mappings for: ${missing.join(', ')}`
    );
  }
}
