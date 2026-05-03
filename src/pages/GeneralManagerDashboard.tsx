import { useEffect, useMemo, useState } from 'react';
import { Users, UserCheck, Clock3, TrendingUp, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchLeads } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';
import type { AppUser } from '@/src/contexts/RoleContext';
import type { Lead } from '@/types';

const CLOSED_STATUSES = new Set(['Not Interested', 'Wrong Number', 'Low Budget', 'Fake Query']);

export default function GeneralManagerDashboard() {
  const { currentUser, managedUsers, allUsers } = useRole();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  /** General Manager: direct telecallers + every Manager1 + telecallers under those Manager1s. Manager1: unchanged (self + mapped telecallers only). */
  const dashboardMembers = useMemo(() => {
    if (!currentUser) return [] as AppUser[];
    if (currentUser.role !== 'Manager') {
      return managedUsers;
    }
    const byId = new Map<string, AppUser>();
    for (const u of managedUsers) byId.set(u.id, u);
    const manager1Users = allUsers.filter(u => u.role === 'Manager1' && u.status === 'Active');
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

  const byUser = useMemo(() => {
    const teamRows = dashboardMembers
      .map(user => {
        const userLeads = leads.filter(l => l.assignedUserId === user.id);
        const active = userLeads.filter(l => !CLOSED_STATUSES.has(l.status)).length;
        const visits = userLeads.filter(l => l.status === 'Site Visit Scheduled').length;
        return {
          id: user.id,
          name: user.name,
          total: userLeads.length,
          active,
          visits,
          rate: userLeads.length > 0 ? Math.round((visits / userLeads.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    const myLeads = leads.filter(l => l.assignedUserId === currentUser?.id);
    if (currentUser && myLeads.length > 0) {
      const active = myLeads.filter(l => !CLOSED_STATUSES.has(l.status)).length;
      const visits = myLeads.filter(l => l.status === 'Site Visit Scheduled').length;
      teamRows.unshift({
        id: currentUser.id,
        name: `${currentUser.name} (Self)`,
        total: myLeads.length,
        active,
        visits,
        rate: Math.round((visits / myLeads.length) * 100),
      });
    }
    return teamRows;
  }, [dashboardMembers, leads, currentUser]);

  const stats = useMemo(() => {
    const total = leads.length;
    const active = leads.filter(l => !CLOSED_STATUSES.has(l.status)).length;
    const visits = leads.filter(l => l.status === 'Site Visit Scheduled').length;
    const followUpsToday = leads.filter(l => {
      if (!l.followUpDate) return false;
      const d = new Date(l.followUpDate);
      const n = new Date();
      return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).length;
    return { total, active, visits, followUpsToday };
  }, [leads]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manager Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentUser?.role === 'Manager'
              ? 'Your direct telecallers, every Manager1, their teams, and your own assigned leads.'
              : 'Team-wise performance for users mapped under you, including your own assigned leads.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading} className="h-9">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Team Members</p><p className="text-2xl font-bold">{dashboardMembers.length}</p></div><Users className="w-5 h-5 text-blue-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Assigned Leads</p><p className="text-2xl font-bold">{stats.total}</p></div><TrendingUp className="w-5 h-5 text-violet-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Active Pipeline</p><p className="text-2xl font-bold">{stats.active}</p></div><Clock3 className="w-5 h-5 text-amber-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Visits Scheduled</p><p className="text-2xl font-bold">{stats.visits}</p></div><UserCheck className="w-5 h-5 text-emerald-500" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Performance</CardTitle>
          <CardDescription>
            {currentUser?.role === 'Manager'
              ? 'Includes Manager1 accounts and their telecallers, plus telecallers mapped directly to you.'
              : 'Only telecallers mapped under you are shown here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Total Leads</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byUser.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    No team members assigned under you yet.
                  </TableCell>
                </TableRow>
              ) : (
                byUser.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.total}</TableCell>
                    <TableCell>{row.active}</TableCell>
                    <TableCell>{row.visits}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.rate}%</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-slate-400 mt-3">Follow-ups due today across your team: {stats.followUpsToday}</p>
        </CardContent>
      </Card>
    </div>
  );
}
