/**
 * New fresh leads (no assignee) → Admin User by default.
 * Override with env DEFAULT_NEW_LEAD_ASSIGNEE_ID (CRM users.id).
 */
export function getDefaultNewLeadAssigneeId() {
  const fromEnv = String(process.env.DEFAULT_NEW_LEAD_ASSIGNEE_ID ?? '').trim();
  return fromEnv || 'admin-1';
}
