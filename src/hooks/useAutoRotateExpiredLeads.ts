/**
 * Assignment deadline runner (admin session).
 *
 * Every CHECK_INTERVAL_MS:
 *   Fetches leads and enforces assignment-expiry rules:
 *   - "New" + no status update + deadline passed => unassign/rotate (per Business Settings)
 *   Per Settings → Business:
 *     - **Unassign** (default): clears assignee so the lead returns to the pool.
 *     - **Rotate**: if Lead Rotation is enabled for that project, assigns the next user in queue.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  fetchLeads,
  assignLead,
  shouldAutoRotateAfterAssignmentTimer,
  getAssignmentExpiryAction,
} from '@/src/services/leadsService';
import {
  loadLeadRotationConfig,
  normalizeProjectKey,
  takeNextRoundRobinAssigneeId,
} from '@/src/services/leadRotationService';
import { useRole } from '@/src/contexts/RoleContext';
import type { AppUser } from '@/src/contexts/RoleContext';

const CHECK_INTERVAL_MS = 60_000;

export function useAutoRotateExpiredLeads() {
  const { isAdmin, allUsers, currentUser } = useRole();
  const allUsersRef = useRef(allUsers);
  useEffect(() => {
    allUsersRef.current = allUsers;
  }, [allUsers]);

  useEffect(() => {
    if (!isAdmin) return;

    const run = async () => {
      let leads: Awaited<ReturnType<typeof fetchLeads>>;
      try {
        leads = await fetchLeads();
      } catch {
        return;
      }

      const expired = leads.filter(shouldAutoRotateAfterAssignmentTimer);
      if (expired.length === 0) return;

      const action = getAssignmentExpiryAction();
      const byId = new Map<string, AppUser>(allUsersRef.current.map((u) => [u.id, u]));
      let unassignedCount = 0;
      let reassignedCount = 0;

      for (const lead of expired) {
        if (action === 'unassign') {
          try {
            await assignLead(
              lead.id,
              '',
              currentUser?.name || 'System',
              'Auto-unassigned: no pipeline update before deadline',
            );
            unassignedCount += 1;
          } catch {
            // Retry next interval
          }
          continue;
        }

        const projectKey = normalizeProjectKey(lead.project);
        let config: Awaited<ReturnType<typeof loadLeadRotationConfig>>;
        try {
          config = await loadLeadRotationConfig(projectKey);
        } catch {
          try {
            await assignLead(
              lead.id,
              '',
              currentUser?.name || 'System',
              'Auto-unassigned: rotation unavailable for this project',
            );
            unassignedCount += 1;
          } catch {
            /* retry later */
          }
          continue;
        }
        if (!config.enabled || config.selectedUserIds.length === 0) {
          try {
            await assignLead(
              lead.id,
              '',
              currentUser?.name || 'System',
              'Auto-unassigned: lead rotation not enabled for this project',
            );
            unassignedCount += 1;
          } catch {
            /* retry later */
          }
          continue;
        }

        const nextId = await takeNextRoundRobinAssigneeId(projectKey);
        if (!nextId) {
          try {
            await assignLead(
              lead.id,
              '',
              currentUser?.name || 'System',
              'Auto-unassigned: no rotation slot available',
            );
            unassignedCount += 1;
          } catch {
            /* retry later */
          }
          continue;
        }

        try {
          await assignLead(lead.id, nextId, currentUser?.name || 'System (auto-rotate)');
          reassignedCount += 1;
          const nextName = byId.get(nextId)?.name ?? nextId;
          const prevName = byId.get(lead.assignedUserId)?.name ?? lead.assignedUserId;
          toast.info(
            `⏱ Deadline passed (still New): "${lead.clientName}" (${projectKey === '__default__' ? 'default project' : projectKey}) ${prevName} → ${nextName}`,
            { duration: 6000 },
          );
        } catch {
          // Silent – will retry on next interval
        }
      }

      if (unassignedCount > 0) {
        toast.info(
          `${unassignedCount} lead(s) auto-unassigned (deadline passed, still New — no pipeline update).`,
          { duration: 6000 },
        );
        console.info(`[AssignmentExpiry] Unassigned ${unassignedCount} lead(s)`);
      }
      if (reassignedCount > 0) {
        console.info(`[AssignmentExpiry] Re-assigned ${reassignedCount} lead(s)`);
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isAdmin, currentUser]);
}
