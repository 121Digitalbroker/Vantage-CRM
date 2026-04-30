/**
 * useAutoRotateExpiredLeads
 *
 * Runs in the background while the admin is logged in.
 * Every CHECK_INTERVAL_MS it:
 *   1. Fetches all leads
 *   2. Finds any with an expired assignment timer (no status update yet)
 *   3. If round-robin rotation is enabled, re-assigns each expired lead to
 *      the next person in the rotation queue
 *   4. Shows a toast so the admin knows what happened
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { fetchLeads, assignLead, isAssignmentExpired } from '@/src/services/leadsService';
import {
  getLeadRotationConfig,
  getNextRoundRobinAssigneeId,
} from '@/src/services/leadRotationService';
import { useRole } from '@/src/contexts/RoleContext';
import type { AppUser } from '@/src/contexts/RoleContext';

const CHECK_INTERVAL_MS = 60_000; // check every 60 seconds

export function useAutoRotateExpiredLeads() {
  const { isAdmin, allUsers, currentUser } = useRole();
  // Keep allUsers in a ref so the interval always sees the latest value
  const allUsersRef = useRef(allUsers);
  useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);

  useEffect(() => {
    // Only admins run the background checker
    if (!isAdmin) return;

    const run = async () => {
      const config = getLeadRotationConfig();
      if (!config.enabled || config.selectedUserIds.length === 0) return;

      let leads: ReturnType<typeof fetchLeads> extends Promise<infer T> ? T : never;
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
        const nextId = getNextRoundRobinAssigneeId();
        if (!nextId) continue;

        try {
          await assignLead(lead.id, nextId, currentUser?.name || 'System (auto-rotate)');
          reassignedCount += 1;
          const nextName = byId.get(nextId)?.name ?? nextId;
          const prevName = byId.get(lead.assignedUserId)?.name ?? lead.assignedUserId;
          toast.info(
            `⏱ Timer expired: "${lead.clientName}" moved from ${prevName} → ${nextName}`,
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

    // Run immediately on mount, then repeat
    void run();
    const timer = window.setInterval(() => { void run(); }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isAdmin, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps
}
