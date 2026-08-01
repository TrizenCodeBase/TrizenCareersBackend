/** Shared application status + interview status values for admin hiring pipeline. */

export const APPLICATION_STATUSES = Object.freeze([
  'pending',
  'reviewed',
  'shortlisted',
  'assignment_sent',
  'assignment_received',
  'interview_link_sent',
  'interview_scheduled',
  'rejected',
  'accepted'
]);

export const INTERVIEW_STATUSES = Object.freeze([
  'not_scheduled',
  'scheduled',
  'completed',
  'no_show',
  'cancelled',
  'selected',
  'rejected'
]);

export const emptyStatusBreakdown = () =>
  Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0]));

/** When main status advances, keep checklist fields in sync. */
export function pipelineFieldsForStatus(status, current = {}) {
  const now = new Date();
  const fields = {};

  if (status === 'assignment_sent' || status === 'assignment_received') {
    fields.assignmentSent = true;
    if (!current.assignmentSent) fields.assignmentSentAt = now;
  }

  if (status === 'assignment_received') {
    fields.assignmentReceived = true;
    if (!current.assignmentReceived) fields.assignmentReceivedAt = now;
  }

  if (
    status === 'interview_link_sent' ||
    status === 'interview_scheduled'
  ) {
    fields.interviewLinkSent = true;
    if (!current.interviewLinkSent) fields.interviewLinkSentAt = now;
  }

  if (status === 'interview_scheduled') {
    if (!current.interviewStatus || current.interviewStatus === 'not_scheduled') {
      fields.interviewStatus = 'scheduled';
    }
  }

  return fields;
}
