/**
 * useAutoRotateExpiredLeads
 *
 * Runs in the background while the admin is logged in.
 * Every CHECK_INTERVAL_MS it:
 *   1. Fetches all leads
 *   2. Finds any with an expired assignment timer (no status update yet)
 *   3. For each, loads rotation config for that lead's **project**; if enabled,
 *      re-assigns to the next user in **that project's** queue
 *   4. Shows a toast so the admin knows what happened
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { fetchLeads, assignLead, isAssignmentExpired } from '@/src/services/leadsService';
import {
  loadLeadRotationConfig,
  normalizeProjectKey,
  takeNextRoundRobinAssigneeId,
} from '@/src/services/leadRotationService';
import { useRole } from '@/src/contexts/RoleContext';
import type { AppUser } from '@/src/contexts/RoleContext';

const CHECK_INTERVAL_MS = 60_000; // check every 60 seconds

export function useAutoRotateExpiredLeads() {
  const { isAdmin, allUsers, currentUser } = useRole();
  const allUsersRef = useRef(allUsers);
  useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);

  useEffect(() => {
    if (!isAdmin) return;

    const run = async () => {
      let leads: Awaited<ReturnType<typeof fetchLeads>>;
      try {
        leads = await fetchLeads();
      } catch {
        return;
      }

      const expired = leads.filter(
        (lead) => lead.assignedUserId?.trim() && isAssignmentExpired(lead),
      );

      if (expired.length === 0) return;

      const byId = new Map<string, AppUser>(allUsersRef.current.map((u) => [u.id, u]));
      let reassignedCount = 0;

      for (const lead of expired) {
        const projectKey = normalizeProjectKey(lead.project);
        let config: Awaited<ReturnType<typeof loadLeadRotationConfig>>;
        try {
          config = await loadLeadRotationConfig(projectKey);
        } catch {
          continue;
        }
        if (!config.enabled || config.selectedUserIds.length === 0) continue;

        const nextId = await takeNextRoundRobinAssigneeId(projectKey);
        if (!nextId) continue;

        try {
          await assignLead(lead.id, nextId, currentUser?.name || 'System (auto-rotate)');
          reassignedCount += 1;
          const nextName = byId.get(nextId)?.name ?? nextId;
          const prevName = byId.get(lead.assignedUserId)?.name ?? lead.assignedUserId;
          toast.info(
            `⏱ Timer expired: "${lead.clientName}" (${projectKey === '__default__' ? 'default project' : projectKey}) ${prevName} → ${nextName}`,
            { duration: 6000 },
          );
        } catch {
          // Silent – will retry on next interval
        }
      }

      if (reassignedCount > 0) {
        console.info(`[AutoRotate] Re-assigned ${reassignedCount} expired lead(s)`);
      }
    };

    void run();
    const timer = window.setInterval(() => { void run(); }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isAdmin, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps
}
