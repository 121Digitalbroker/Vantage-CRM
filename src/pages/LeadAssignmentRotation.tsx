import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Save, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useRole } from '@/src/contexts/RoleContext';
import type { Lead } from '@/types';
import { assignLead, fetchLeads } from '@/src/services/leadsService';
import {
  getLeadRotationConfig,
  getNextRoundRobinAssigneeId,
  getLeadRotationNextIndex,
  saveLeadRotationConfig,
} from '@/src/services/leadRotationService';

export default function LeadAssignmentRotation() {
  const { allUsers, currentUser } = useRole();
  const [enabled, setEnabled] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());

  const assignableUsers = useMemo(
    () =>
      allUsers.filter(
        (u) =>
          u.status === 'Active'
          && (u.role === 'Telecaller' || u.role === 'Manager')
      ),
    [allUsers]
  );

  const selectedUsers = useMemo(() => {
    const byId = new Map(assignableUsers.map((user) => [user.id, user]));
    return selectedUserIds.map((id) => byId.get(id)).filter(Boolean);
  }, [assignableUsers, selectedUserIds]);

  useEffect(() => {
    const config = getLeadRotationConfig();
    setEnabled(config.enabled);
    setSelectedUserIds(config.selectedUserIds);
  }, []);

  useEffect(() => {
    let active = true;
    const loadLeads = async () => {
      try {
        const data = await fetchLeads();
        if (active) setLeads(data);
      } catch {
        // Silent fail: this page should still remain usable for configuration.
      }
    };

    void loadLeads();
    const refreshTimer = window.setInterval(() => { void loadLeads(); }, 15000);
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const addUser = (id: string) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeUser = (id: string) => {
    setSelectedUserIds((prev) => prev.filter((userId) => userId !== id));
  };

  const moveUser = (id: string, direction: 'up' | 'down') => {
    setSelectedUserIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;

      const next = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    saveLeadRotationConfig({
      enabled,
      selectedUserIds,
    });
    toast.success('Lead rotation settings saved');
  };

  const rotateUnassignedLeadsNow = async () => {
    if (!enabled) {
      toast.error('Enable rotation first');
      return;
    }
    if (selectedUsers.length === 0) {
      toast.error('Add users to assignment order first');
      return;
    }

    try {
      const allLeads = await fetchLeads();
      const unassigned = allLeads
        .filter((lead) => !lead.assignedUserId?.trim())
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (unassigned.length === 0) {
        toast.success('No unassigned leads found');
        return;
      }

      let assignedCount = 0;
      for (const lead of unassigned) {
        const nextAssigneeId = getNextRoundRobinAssigneeId();
        if (!nextAssigneeId) continue;
        await assignLead(lead.id, nextAssigneeId, currentUser?.name || 'System');
        assignedCount += 1;
      }

      const refreshed = await fetchLeads();
      setLeads(refreshed);
      if (assignedCount > 0) {
        toast.success(`${assignedCount} unassigned lead(s) rotated successfully`);
      } else {
        toast.error('Could not assign leads. Check selected users and rotation settings.');
      }
    } catch {
      toast.error('Failed to rotate unassigned leads');
    }
  };

  const nextIndex = selectedUsers.length > 0
    ? getLeadRotationNextIndex() % selectedUsers.length
    : 0;
  const nextUser = selectedUsers[nextIndex] ?? null;

  const leadsByUser = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const user of selectedUsers) map.set(user.id, []);
    for (const lead of leads) {
      if (!lead.assignedUserId) continue;
      const arr = map.get(lead.assignedUserId);
      if (!arr) continue;
      arr.push(lead);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
    return map;
  }, [leads, selectedUsers]);

  const totalAssignedToRotation = useMemo(
    () => Array.from(leadsByUser.values()).reduce((sum, list) => sum + list.length, 0),
    [leadsByUser]
  );

  const getLeadTimerLabel = (lead: Lead): string => {
    if (!lead.assignedUserId) return 'Unassigned';
    if (lead.lastStatusUpdate) return 'Timer stopped (status updated)';
    if (!lead.assignmentExpiresAt) return 'No timer set';
    const diffMs = new Date(lead.assignmentExpiresAt).getTime() - nowMs;
    if (diffMs <= 0) return 'Expired';
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lead Assignment Rotation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Auto-assign new unassigned leads in the exact order you set below.
        </p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Rotation Controls</CardTitle>
          <CardDescription>
            Turn this on to distribute incoming leads one-by-one to selected users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Enable round-robin assignment</p>
              <p className="text-xs text-slate-500">Only applies when a new lead has no manual assignee.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={enabled ? 'default' : 'outline'}
              className={enabled ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
              onClick={() => setEnabled((prev) => !prev)}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Available Users</h3>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {assignableUsers.length === 0 && (
                  <p className="text-xs text-slate-500">No active telecallers/managers found.</p>
                )}
                {assignableUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.role}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={isSelected ? 'secondary' : 'outline'}
                        className="h-8"
                        disabled={isSelected}
                        onClick={() => addUser(user.id)}
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                        {isSelected ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Assignment Order</h3>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {selectedUsers.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Add users from the left. First user gets lead #1, second gets lead #2, then loop repeats.
                  </p>
                )}
                {selectedUsers.map((user, index) => (
                  <div key={user.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        #{index + 1} {user.name}
                      </p>
                      <p className="text-xs text-slate-500">{user.role}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => moveUser(user.id, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => moveUser(user.id, 'down')}
                        disabled={index === selectedUsers.length - 1}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeUser(user.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Rotation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Live Rotation Data</CardTitle>
          <CardDescription>
            Current queue pointer, timer state, and leads held by selected users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Rotation Status</p>
              <p className={`text-sm font-semibold mt-1 ${enabled ? 'text-emerald-600' : 'text-slate-600'}`}>
                {enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Next Queue Position</p>
              <p className="text-sm font-semibold mt-1 text-slate-900">
                {selectedUsers.length > 0 ? `#${nextIndex + 1}` : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Next Assignee</p>
              <p className="text-sm font-semibold mt-1 text-slate-900">
                {nextUser?.name ?? 'No user selected'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Assigned Leads (Selected Users)</p>
              <p className="text-sm font-semibold mt-1 text-slate-900">{totalAssignedToRotation}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-slate-200"
              onClick={() => { void rotateUnassignedLeadsNow(); }}
            >
              Rotate Unassigned Leads Now
            </Button>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Who Has Which Lead Right Now</h3>
            <div className="space-y-3">
              {selectedUsers.length === 0 && (
                <p className="text-xs text-slate-500">No users selected in rotation.</p>
              )}
              {selectedUsers.map((user) => {
                const userLeads = leadsByUser.get(user.id) ?? [];
                return (
                  <div key={user.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{userLeads.length} lead(s)</p>
                    </div>
                    {userLeads.length === 0 ? (
                      <p className="text-xs text-slate-500">No assigned leads right now.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {userLeads.slice(0, 5).map((lead) => (
                          <div key={lead.id} className="flex items-center justify-between text-xs rounded border border-slate-100 px-2 py-1.5">
                            <div className="text-slate-700 truncate pr-2">
                              {lead.clientName} ({lead.phoneNumber})
                            </div>
                            <div className="text-slate-500 whitespace-nowrap">{getLeadTimerLabel(lead)}</div>
                          </div>
                        ))}
                        {userLeads.length > 5 && (
                          <p className="text-[11px] text-slate-500">+{userLeads.length - 5} more leads</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
