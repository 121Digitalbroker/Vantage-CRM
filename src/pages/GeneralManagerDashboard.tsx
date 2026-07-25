import { useEffect, useMemo, useState } from 'react';
import { Users, Clock3, TrendingUp, RefreshCw, CalendarRange, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { fetchLeads } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';
import type { AppUser } from '@/src/contexts/RoleContext';
import type { Lead, LeadStatus } from '@/types';

const CLOSED_STATUSES = new Set<LeadStatus>(['Not Interested', 'Wrong Number', 'Low Budget', 'Fake Query']);
/** Junk/dump-only statuses (excludes Not Interested — counted separately). Matches Leads page DUMP_STATUSES. */
const DUMP_JUNK_STATUSES = new Set<LeadStatus>(['Fake Query', 'Wrong Number', 'Low Budget']);

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function leadCreatedInRange(lead: Lead, start: string, end: string): boolean {
  const key = localDateKey(lead.createdAt);
  if (start && key < start) return false;
  if (end && key > end) return false;
  return true;
}

function outcomeCounts(userLeads: Lead[]) {
  const notInterested = userLeads.filter(l => l.status === 'Not Interested').length;
  const dump = userLeads.filter(l => DUMP_JUNK_STATUSES.has(l.status)).length;
  const interested = userLeads.filter(l => l.status === 'Interested').length;
  const rate = userLeads.length > 0 ? Math.round((interested / userLeads.length) * 100) : 0;
  return { notInterested, dump, interested, rate };
}

export default function GeneralManagerDashboard() {
  const { currentUser, managedUsers, allUsers } = useRole();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  /** General Manager: direct telecallers + Manager1s who report to this GM + their telecallers. Manager1: self + mapped telecallers only. */
  const dashboardMembers = useMemo(() => {
    if (!currentUser) return [] as AppUser[];
    if (currentUser.role !== 'Manager') {
      return managedUsers;
    }
    const byId = new Map<string, AppUser>();
    for (const u of managedUsers) byId.set(u.id, u);
    const manager1Users = allUsers.filter(
      u => u.role === 'Manager1' && u.status === 'Active' && u.reportsToGmId === currentUser.id,
    );
    for (const u of manager1Users) byId.set(u.id, u);
    const manager1Ids = new Set(manager1Users.map(u => u.id));
    for (const u of allUsers) {
      if (u.role !== 'Telecaller' || u.status !== 'Active') continue;
      if (u.managerIds?.some(id => manager1Ids.has(id))) byId.set(u.id, u);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [currentUser, managedUsers, allUsers]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allLeads = await fetchLeads();
      const teamIds = new Set(
        [currentUser?.id, ...dashboardMembers.map(u => u.id)].filter(Boolean) as string[],
      );
      setLeads(allLeads.filter(l => teamIds.has(l.assignedUserId)));
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, dashboardMembers.map(u => u.id).sort().join(',')]);

  const filteredLeads = useMemo(() => {
    if (!dateRangeStart && !dateRangeEnd) return leads;
    return leads.filter(l => leadCreatedInRange(l, dateRangeStart, dateRangeEnd));
  }, [leads, dateRangeStart, dateRangeEnd]);

  const byUser = useMemo(() => {
    const teamRows = dashboardMembers
      .map(user => {
        const userLeads = filteredLeads.filter(l => l.assignedUserId === user.id);
        const active = userLeads.filter(l => !CLOSED_STATUSES.has(l.status)).length;
        const { notInterested, dump, interested, rate } = outcomeCounts(userLeads);
        return {
          id: user.id,
          name: user.name,
          total: userLeads.length,
          active,
          notInterested,
          dump,
          interested,
          rate,
        };
      })
      .sort((a, b) => b.total - a.total);

    const myLeads = filteredLeads.filter(l => l.assignedUserId === currentUser?.id);
    if (currentUser && myLeads.length > 0) {
      const active = myLeads.filter(l => !CLOSED_STATUSES.has(l.status)).length;
      const { notInterested, dump, interested, rate } = outcomeCounts(myLeads);
      teamRows.unshift({
        id: currentUser.id,
        name: `${currentUser.name} (Self)`,
        total: myLeads.length,
        active,
        notInterested,
        dump,
        interested,
        rate,
      });
    }
    return teamRows;
  }, [dashboardMembers, filteredLeads, currentUser]);

  const stats = useMemo(() => {
    const total = filteredLeads.length;
    const active = filteredLeads.filter(l => !CLOSED_STATUSES.has(l.status)).length;
    const interested = filteredLeads.filter(l => l.status === 'Interested').length;
    const followUpsToday = leads.filter(l => {
      if (!l.followUpDate) return false;
      const d = new Date(l.followUpDate);
      const n = new Date();
      return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).length;
    return { total, active, interested, followUpsToday };
  }, [filteredLeads, leads]);

  const dateFilterActive = Boolean(dateRangeStart || dateRangeEnd);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manager Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentUser?.role === 'Manager'
              ? 'Your direct telecallers, every Manager1, their teams, and your own assigned leads.'
              : 'Team-wise performance for users mapped under you, including your own assigned leads.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading} className="h-9 shrink-0">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex items-center gap-2 text-slate-700">
            <CalendarRange className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-sm font-medium">Lead created date</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="gm-dash-from" className="text-xs text-slate-500">From</Label>
              <input
                id="gm-dash-from"
                type="date"
                value={dateRangeStart}
                onChange={e => setDateRangeStart(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gm-dash-to" className="text-xs text-slate-500">To</Label>
              <input
                id="gm-dash-to"
                type="date"
                value={dateRangeEnd}
                onChange={e => setDateRangeEnd(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              disabled={!dateFilterActive}
              onClick={() => {
                setDateRangeStart('');
                setDateRangeEnd('');
              }}
            >
              Clear dates
            </Button>
          </div>
          <p className="text-xs text-slate-500 sm:ml-auto">
            {dateFilterActive
              ? 'Counts below use leads whose created date falls in this range (local time).'
              : 'Leave blank to include all leads by creation date.'}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Team Members</p><p className="text-2xl font-bold">{dashboardMembers.length}</p></div><Users className="w-5 h-5 text-blue-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Assigned Leads</p><p className="text-2xl font-bold">{stats.total}</p></div><TrendingUp className="w-5 h-5 text-violet-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Active Pipeline</p><p className="text-2xl font-bold">{stats.active}</p></div><Clock3 className="w-5 h-5 text-amber-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Interested</p><p className="text-2xl font-bold">{stats.interested}</p></div><Heart className="w-5 h-5 text-rose-500" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Performance</CardTitle>
          <CardDescription>
            {currentUser?.role === 'Manager'
              ? 'Includes Manager1 accounts and their telecallers, plus telecallers mapped directly to you.'
              : 'Only telecallers mapped under you are shown here.'}
            {dateFilterActive ? ' Filtered by lead created date above.' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Total Leads</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Not Interested</TableHead>
                  <TableHead>Dump</TableHead>
                  <TableHead>Interested</TableHead>
                  <TableHead>Interest %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byUser.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                      No team members assigned under you yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  byUser.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.active}</TableCell>
                      <TableCell>{row.notInterested}</TableCell>
                      <TableCell>{row.dump}</TableCell>
                      <TableCell>{row.interested}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.rate}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-slate-400 mt-3">Follow-ups due today across your team: {stats.followUpsToday}</p>
        </CardContent>
      </Card>
    </div>
  );
}
