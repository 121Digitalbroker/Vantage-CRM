import { useEffect, useMemo, useState } from 'react';
import { Users, UserCheck, Clock3, TrendingUp, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchLeads } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';
import type { Lead } from '@/types';

const CLOSED_STATUSES = new Set(['Not Interested', 'Wrong Number', 'Low Budget', 'Fake Query']);

export default function GeneralManagerDashboard() {
  const { currentUser, managedUsers } = useRole();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const allLeads = await fetchLeads();
      const teamIds = new Set([currentUser?.id, ...managedUsers.map(u => u.id)].filter(Boolean) as string[]);
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
  }, [currentUser?.id, managedUsers.map(u => u.id).join(',')]);

  const byUser = useMemo(() => {
    const teamRows = managedUsers
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
  }, [managedUsers, leads, currentUser]);

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
          <p className="text-sm text-slate-500 mt-1">Team-wise performance for users assigned under you, including your own assigned leads.</p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading} className="h-9">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Team Members</p><p className="text-2xl font-bold">{managedUsers.length}</p></div><Users className="w-5 h-5 text-blue-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Assigned Leads</p><p className="text-2xl font-bold">{stats.total}</p></div><TrendingUp className="w-5 h-5 text-violet-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Active Pipeline</p><p className="text-2xl font-bold">{stats.active}</p></div><Clock3 className="w-5 h-5 text-amber-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Visits Scheduled</p><p className="text-2xl font-bold">{stats.visits}</p></div><UserCheck className="w-5 h-5 text-emerald-500" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Performance</CardTitle>
          <CardDescription>Only telecallers mapped under you by Admin are shown here.</CardDescription>
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
