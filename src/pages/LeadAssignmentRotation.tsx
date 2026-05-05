import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Mail, Save, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useRole, isManagerKindRole } from '@/src/contexts/RoleContext';
import type { Lead } from '@/types';
import {
  assignLead,
  fetchLeads,
  getAssignmentInactivityHours,
  isAssignmentExpired,
  isInNewStatusAssignmentRotationWindow,
  shouldAutoRotateAfterAssignmentTimer,
} from '@/src/services/leadsService';
import {
  loadLeadRotationConfig,
  normalizeProjectKey,
  peekLeadRotationNextIndex,
  persistLeadRotationConfig,
  takeNextRoundRobinAssigneeId,
} from '@/src/services/leadRotationService';
import { sendTestEmail } from '@/src/services/testEmailService';

export default function LeadAssignmentRotation() {
  const { allUsers, currentUser, telecallers } = useRole();
  const [enabled, setEnabled] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [nextRoundRobinIndex, setNextRoundRobinIndex] = useState(0);
  const [rotationLoading, setRotationLoading] = useState(true);
  const [rotationSaving, setRotationSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testEmailSecret, setTestEmailSecret] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);

  /** Rotation queue is scoped by `Lead.project` (normalized). */
  const [selectedProjectKey, setSelectedProjectKey] = useState('__default__');
  const [manualProjectKey, setManualProjectKey] = useState('');

  const assignableUsers = useMemo(
    () =>
      allUsers.filter(
        (u) =>
          u.status === 'Active'
          && (u.role === 'Telecaller' || isManagerKindRole(u.role))
      ),
    [allUsers]
  );

  const selectedUsers = useMemo(() => {
    const byId = new Map(assignableUsers.map((user) => [user.id, user]));
    return selectedUserIds.map((id) => byId.get(id)).filter(Boolean);
  }, [assignableUsers, selectedUserIds]);

  const projectChoices = useMemo((): [string, string][] => {
    const m = new Map<string, string>();
    for (const l of leads) {
      const k = normalizeProjectKey(l.project);
      const label = k === '__default__' ? '(No project on lead)' : (l.project?.trim() || k);
      if (!m.has(k)) m.set(k, label);
    }
    if (!m.has('__default__')) {
      m.set('__default__', '(No project on lead)');
    }
    return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [leads]);

  const projectSelectOptions = useMemo((): [string, string][] => {
    const m = new Map<string, string>(projectChoices);
    if (!m.has(selectedProjectKey)) {
      m.set(
        selectedProjectKey,
        selectedProjectKey === '__default__' ? '(No project on lead)' : selectedProjectKey
      );
    }
    return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [projectChoices, selectedProjectKey]);

  const leadsInScope = useMemo(
    () => leads.filter((l) => normalizeProjectKey(l.project) === selectedProjectKey),
    [leads, selectedProjectKey]
  );

  const projectDisplayLabel = useMemo(() => {
    const row = projectSelectOptions.find(([k]) => k === selectedProjectKey);
    return row?.[1] ?? (selectedProjectKey === '__default__' ? '(No project on lead)' : selectedProjectKey);
  }, [projectSelectOptions, selectedProjectKey]);

  const getAssigneeDisplayName = (userId: string) => {
    if (!userId?.trim()) return '—';
    return (
      allUsers.find((u) => u.id === userId)?.name
      ?? telecallers.find((u) => u.id === userId)?.name
      ?? userId
    );
  };

  const rotatingLeadsTimerRunning = useMemo(() => {
    return leadsInScope
      .filter(
        (l) =>
          isInNewStatusAssignmentRotationWindow(l)
          && !isAssignmentExpired(l)
      )
      .sort(
        (a, b) =>
          new Date(a.assignmentExpiresAt!).getTime() - new Date(b.assignmentExpiresAt!).getTime()
      );
  }, [leadsInScope, nowMs]);

  const rotatingLeadsTimerExpired = useMemo(() => {
    return leadsInScope.filter(shouldAutoRotateAfterAssignmentTimer);
  }, [leadsInScope, nowMs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRotationLoading(true);
      try {
        const config = await loadLeadRotationConfig(selectedProjectKey);
        const peek = await peekLeadRotationNextIndex(selectedProjectKey);
        if (cancelled) return;
        setEnabled(config.enabled);
        setSelectedUserIds(config.selectedUserIds);
        setNextRoundRobinIndex(peek);
      } catch {
        if (!cancelled) toast.error('Could not load rotation settings');
      } finally {
        if (!cancelled) setRotationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectKey]);

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

  const handleSave = async () => {
    setRotationSaving(true);
    try {
      await persistLeadRotationConfig(selectedProjectKey, { enabled, selectedUserIds });
      setNextRoundRobinIndex(await peekLeadRotationNextIndex(selectedProjectKey));
      toast.success(
        `Rotation saved for "${selectedProjectKey === '__default__' ? 'default / no project' : selectedProjectKey}"`
      );
    } catch {
      toast.error('Failed to save rotation settings');
    } finally {
      setRotationSaving(false);
    }
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
        .filter((lead) => normalizeProjectKey(lead.project) === selectedProjectKey)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (unassigned.length === 0) {
        toast.success('No unassigned leads for this project');
        return;
      }

      let assignedCount = 0;
      for (const lead of unassigned) {
        const nextAssigneeId = await takeNextRoundRobinAssigneeId(selectedProjectKey);
        if (!nextAssigneeId) continue;
        await assignLead(lead.id, nextAssigneeId, currentUser?.name || 'System');
        assignedCount += 1;
      }

      const refreshed = await fetchLeads();
      setLeads(refreshed);
      setNextRoundRobinIndex(await peekLeadRotationNextIndex(selectedProjectKey));
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
    ? nextRoundRobinIndex % selectedUsers.length
    : 0;
  const nextUser = selectedUsers[nextIndex] ?? null;

  const leadsByUser = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const user of selectedUsers) map.set(user.id, []);
    for (const lead of leadsInScope) {
      if (!lead.assignedUserId) continue;
      const arr = map.get(lead.assignedUserId);
      if (!arr) continue;
      arr.push(lead);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
    return map;
  }, [leadsInScope, selectedUsers]);

  const totalAssignedToRotation = useMemo(() => {
    let sum = 0;
    for (const list of leadsByUser.values() as Iterable<Lead[]>) {
      sum += list.length;
    }
    return sum;
  }, [leadsByUser]);

  /** New-status leads in this project on the assignment timer (auto-rotate when it hits zero if rotation is on). */
  const liveTimerStats = useMemo(() => {
    let activeRotating = 0;
    let expiredPending = 0;
    let nearestExpiryAt: number | null = null;
    for (const l of leadsInScope) {
      if (!isInNewStatusAssignmentRotationWindow(l)) continue;
      if (isAssignmentExpired(l)) {
        expiredPending += 1;
      } else {
        activeRotating += 1;
        const t = new Date(l.assignmentExpiresAt!).getTime();
        if (nearestExpiryAt == null || t < nearestExpiryAt) nearestExpiryAt = t;
      }
    }
    return { activeRotating, expiredPending, nearestExpiryAt };
  }, [leadsInScope, nowMs]);

  const soonestHandoffLabel = useMemo(() => {
    const t = liveTimerStats.nearestExpiryAt;
    if (t == null) return '—';
    const diffMs = t - nowMs;
    if (diffMs <= 0) return '—';
    const totalSec = Math.floor(diffMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m >= 120) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${h}h ${mm}m`;
    }
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, [liveTimerStats.nearestExpiryAt, nowMs]);

  const assignmentWindowMinutes = getAssignmentInactivityHours() * 60;

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
            Pick a <strong className="font-medium text-slate-700">project</strong> first — each project has its own
            assignee order and round-robin pointer. Only leads whose <strong className="font-medium text-slate-700">Project</strong>{' '}
            field matches see this queue. After Save, settings are stored in the database. Run{' '}
            <code className="text-[11px] bg-slate-100 px-1 rounded">supabase-crm-lead-rotation-config.sql</code>{' '}
            in Supabase if saving fails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rotationLoading && (
            <p className="text-xs text-slate-500">Loading rotation settings…</p>
          )}

          <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/40">
            <div>
              <Label className="text-xs font-medium text-slate-800">Project scope</Label>
              <p className="text-xs text-slate-500 mt-1 mb-2">
                Leads are matched on the exact <span className="font-medium">Project / Form</span> string (trimmed).
                Configure a separate queue per campaign or form name.
              </p>
              <Select
                value={selectedProjectKey}
                onValueChange={setSelectedProjectKey}
                disabled={rotationLoading}
              >
                <SelectTrigger className="w-full max-w-xl bg-white">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projectSelectOptions.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-slate-500">Or type a project name</Label>
                <Input
                  value={manualProjectKey}
                  onChange={(e) => setManualProjectKey(e.target.value)}
                  placeholder="Paste project string from a lead…"
                  className="mt-1 bg-white"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={rotationLoading}
                onClick={() => {
                  const k = normalizeProjectKey(manualProjectKey);
                  setSelectedProjectKey(k);
                  setManualProjectKey('');
                  toast.message(
                    k === '__default__'
                      ? 'Using default bucket (empty project name).'
                      : `Editing rotation for: ${k}`
                  );
                }}
              >
                Use typed project
              </Button>
            </div>
          </div>

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
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white"
              disabled={rotationLoading || rotationSaving}
              onClick={() => void handleSave()}
            >
              <Save className="w-4 h-4 mr-2" />
              {rotationSaving ? 'Saving…' : 'Save Rotation'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Email test (Resend)</CardTitle>
          <CardDescription>
            Send one manual email through your Express backend to confirm{' '}
            <code className="text-[11px] bg-slate-100 px-1 rounded">RESEND_API_KEY</code>
            {' '}and{' '}
            <code className="text-[11px] bg-slate-100 px-1 rounded">MAIL_FROM</code>.
            Production: set <code className="text-[11px] bg-slate-100 px-1 rounded">VITE_API_BASE_URL</code> to your API origin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-md">
          <Input
            type="email"
            placeholder="Recipient email"
            autoComplete="email"
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Optional — TEST_EMAIL_SECRET if set on server"
            autoComplete="off"
            value={testEmailSecret}
            onChange={(e) => setTestEmailSecret(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="border-slate-200"
            disabled={testEmailSending || !testEmailTo.trim()}
            onClick={() => {
              void (async () => {
                setTestEmailSending(true);
                try {
                  const r = await sendTestEmail({
                    to: testEmailTo.trim(),
                    secret: testEmailSecret.trim() || undefined,
                  });
                  if (r.ok) toast.success(r.message || 'Test email sent');
                  else toast.error(r.error || 'Failed');
                } finally {
                  setTestEmailSending(false);
                }
              })();
            }}
          >
            <Mail className="w-4 h-4 mr-2" />
            {testEmailSending ? 'Sending…' : 'Send test email'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Live Rotation Data</CardTitle>
          <CardDescription>
            Scoped to the <span className="font-medium text-slate-700">selected project</span> above.{' '}
            <span className="font-medium text-slate-700">Active timers</span> are assigned leads still in{' '}
            <span className="font-medium text-slate-700">New</span> with no pipeline status change yet — they count down
            to auto handoff when rotation is enabled and an admin session is running the checker
            (~every 1 min). Window length: <span className="font-medium">{assignmentWindowMinutes} min</span> (Settings).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Rotation Status</p>
              <p className={`text-sm font-semibold mt-1 ${enabled ? 'text-emerald-600' : 'text-slate-600'}`}>
                {enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-xs text-emerald-800 font-medium">Timers running now</p>
              <p className="text-lg font-bold text-emerald-900 mt-0.5 tabular-nums">
                {liveTimerStats.activeRotating}
              </p>
              <p className="text-[0.65rem] text-emerald-800/90 mt-1 leading-snug">
                Soonest handoff in <span className="font-semibold">{soonestHandoffLabel}</span>
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs text-amber-900 font-medium">Timer expired, still New (pending)</p>
              <p className="text-lg font-bold text-amber-950 mt-0.5 tabular-nums">
                {liveTimerStats.expiredPending}
              </p>
              <p className="text-[0.65rem] text-amber-900/90 mt-1 leading-snug">
                {enabled
                  ? 'Next admin poll (~1 min) can reassign these.'
                  : 'Enable rotation + admin checker to hand off.'}
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
              <p className="text-xs text-slate-500">Assigned in this project</p>
              <p className="text-sm font-semibold mt-1 text-slate-900">{totalAssignedToRotation}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Who is on the rotation clock (by name)</h3>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-medium text-slate-700">Project:</span>{' '}
                <span className="text-slate-800">{projectDisplayLabel}</span>
                {' · '}Each row is a <span className="font-medium text-slate-700">New</span> lead counting down (or just
                expired) before auto handoff — with the{' '}
                <span className="font-medium text-slate-700">user who currently owns</span> that lead.
              </p>
            </div>

            {rotatingLeadsTimerRunning.length === 0 && rotatingLeadsTimerExpired.length === 0 ? (
              <p className="text-sm text-slate-500 py-1">
                No leads in an active rotation window for this project (assigned, still New, timer running or just
                expired). If assignees changed pipeline status from New, the timer stopped; unassigned leads are not
                listed here.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {rotatingLeadsTimerRunning.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 mb-2">
                      Timer running ({rotatingLeadsTimerRunning.length})
                    </p>
                    <ul className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {rotatingLeadsTimerRunning.map((lead) => (
                        <li
                          key={lead.id}
                          className="rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs shadow-sm"
                        >
                          <div className="font-semibold text-slate-900">{lead.clientName}</div>
                          <div className="text-slate-600 mt-0.5">
                            Assigned to{' '}
                            <span className="font-medium text-slate-800">
                              {getAssigneeDisplayName(lead.assignedUserId)}
                            </span>
                          </div>
                          <div className="text-emerald-700 font-medium tabular-nums mt-1">
                            {getLeadTimerLabel(lead)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {rotatingLeadsTimerExpired.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-900 mb-2">
                      Timer expired, still New — pending handoff ({rotatingLeadsTimerExpired.length})
                    </p>
                    <ul className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {rotatingLeadsTimerExpired.map((lead) => (
                        <li
                          key={lead.id}
                          className="rounded-md border border-amber-100 bg-white px-3 py-2 text-xs shadow-sm"
                        >
                          <div className="font-semibold text-slate-900">{lead.clientName}</div>
                          <div className="text-slate-600 mt-0.5">
                            With{' '}
                            <span className="font-medium text-slate-800">
                              {getAssigneeDisplayName(lead.assignedUserId)}
                            </span>
                          </div>
                          <div className="text-amber-800 font-medium mt-1">Expired — next admin check can rotate</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-slate-200"
              disabled={rotationLoading}
              onClick={() => { void rotateUnassignedLeadsNow(); }}
            >
              Rotate unassigned (this project only)
            </Button>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Who has which lead (this project)</h3>
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
