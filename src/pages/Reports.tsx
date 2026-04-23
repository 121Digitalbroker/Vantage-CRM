import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchLeads } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';
import { Lead } from '@/types';
import { format, parseISO, startOfWeek, startOfMonth, startOfDay, compareAsc } from 'date-fns';
import { Megaphone, ArrowUpRight, TrendingUp, TrendingDown, Users, UserCheck, PhoneCall } from 'lucide-react';

const MOCK_CAMPAIGNS = [
  { id: 1, name: 'Google Search Ads - Q1', platform: 'Google Ads',  spend: 450000, leads: 145, costPerLead: 3103, status: 'Active',    trend: 'up' },
  { id: 2, name: 'FB Retargeting - Villas', platform: 'Facebook',   spend: 210000, leads: 86,  costPerLead: 2441, status: 'Active',    trend: 'up' },
  { id: 3, name: 'LinkedIn Professionals',  platform: 'LinkedIn',   spend: 320000, leads: 42,  costPerLead: 7619, status: 'Paused',    trend: 'down' },
  { id: 4, name: 'Spring Newsletter',       platform: 'Email',      spend: 15000,  leads: 28,  costPerLead: 535,  status: 'Completed', trend: 'up' },
];

export default function Reports() {
  const { telecallers } = useRole();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [timeframe, setTimeframe] = useState<'Day' | 'Week' | 'Month'>('Week');

  useEffect(() => {
    fetchLeads().then(setLeads).catch(() => setLeads([]));
  }, []);

  // 1. Lead Source Distribution (Pie Chart)
  const sourceData = useMemo(() => {
    const groups: Record<string, number> = {};
    leads.forEach(l => {
      const source = l.leadSource || 'Unknown';
      groups[source] = (groups[source] || 0) + 1;
    });
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];
    return Object.entries(groups).map(([name, value], i) => ({
      name, value, fill: colors[i % colors.length]
    }));
  }, [leads]);

  // 2. Telecaller Conversion Rate (Bar Chart)
  const telecallerPerformance = useMemo(() => {
    return telecallers.map(t => {
      const assigned = leads.filter(l => l.assignedUserId === t.id);
      const total = assigned.length;
      const converted = assigned.filter(l => l.status === 'Booked').length;
      const rate = total > 0 ? (converted / total) * 100 : 0;
      return { 
        name: t.name.split(' ')[0], 
        rate: Number(rate.toFixed(1)),
        converted,
        total 
      };
    }).filter(t => t.total > 0).sort((a, b) => b.rate - a.rate);
  }, [leads, telecallers]);

  // 3. Lead Levels: Hot / Warm / Cold (Pie Chart)
  const leadLevelsData = useMemo(() => {
    const hot = leads.filter(l => l.leadLevel === 'Hot').length;
    const warm = leads.filter(l => l.leadLevel === 'Warm').length;
    const cold = leads.filter(l => l.leadLevel === 'Cold').length;
    return [
      { name: 'Hot', value: hot, fill: '#ef4444' },   // red-500
      { name: 'Warm', value: warm, fill: '#f59e0b' }, // amber-500
      { name: 'Cold', value: cold, fill: '#3b82f6' }, // blue-500
    ].filter(l => l.value > 0);
  }, [leads]);

  // Helper to group by time
  const getGroupedByTime = () => {
    const groups: Record<string, { total: number, booked: number, date: Date }> = {};
    leads.forEach(l => {
      try {
        const d = parseISO(l.createdAt);
        let key = '';
        let sortDate = d;
        if (timeframe === 'Day') {
          sortDate = startOfDay(d);
          key = format(sortDate, 'MMM dd');
        } else if (timeframe === 'Week') {
          sortDate = startOfWeek(d, { weekStartsOn: 1 }); // Starts Monday
          key = format(sortDate, 'MMM dd');
        } else if (timeframe === 'Month') {
          sortDate = startOfMonth(d);
          key = format(sortDate, 'MMM yyyy');
        }
        
        if (!groups[key]) groups[key] = { total: 0, booked: 0, date: sortDate };
        groups[key].total += 1;
        if (l.status === 'Booked') groups[key].booked += 1;
      } catch { /* ignore bad dates */ }
    });

    // Convert to array and sort chronologically
    return Object.entries(groups)
      .map(([key, data]) => ({ name: key, ...data }))
      .sort((a, b) => compareAsc(a.date, b.date))
      .slice(-12); // Keep last 12 periods so it doesn't get too crowded
  };

  // 4. Incoming Leads Over Time (Bar Chart)
  const leadsOverTime = useMemo(() => {
    return getGroupedByTime().map(g => ({ name: g.name, count: g.total }));
  }, [leads, timeframe]);

  // 5. Conversion Rate Trends (Line Chart)
  const conversionTrends = useMemo(() => {
    return getGroupedByTime().map(g => ({
      name: g.name,
      rate: g.total > 0 ? Number(((g.booked / g.total) * 100).toFixed(1)) : 0
    }));
  }, [leads, timeframe]);

  // 6. Lead Assignments by Telecaller (Stacked Bar Chart)
  const assignmentsByTelecaller = useMemo(() => {
    const telecallerIds = telecallers.map(t => t.id);
    const telecallerNames: Record<string, string> = {};
    telecallers.forEach(t => { telecallerNames[t.id] = t.name.split(' ')[0]; });

    // Group by date
    const dateGroups: Record<string, { date: Date; key: string; assignments: Record<string, number> }> = {};
    
    leads.forEach(l => {
      if (!telecallerIds.includes(l.assignedUserId)) return;
      
      try {
        const d = parseISO(l.createdAt);
        let key = '';
        let sortDate = d;
        
        if (timeframe === 'Day') {
          sortDate = startOfDay(d);
          key = format(sortDate, 'MMM dd');
        } else if (timeframe === 'Week') {
          sortDate = startOfWeek(d, { weekStartsOn: 1 });
          key = format(sortDate, 'MMM dd');
        } else if (timeframe === 'Month') {
          sortDate = startOfMonth(d);
          key = format(sortDate, 'MMM yyyy');
        }
        
        if (!dateGroups[key]) {
          dateGroups[key] = { date: sortDate, key, assignments: {} };
        }
        dateGroups[key].assignments[l.assignedUserId] = (dateGroups[key].assignments[l.assignedUserId] || 0) + 1;
      } catch { /* ignore */ }
    });

    // Sort chronologically
    const sortedDates = Object.values(dateGroups)
      .sort((a, b) => compareAsc(a.date, b.date))
      .slice(-12);

    // Build data array with each telecaller as a separate series
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444'];
    
    return sortedDates.map((g, i) => {
      const row: Record<string, number | string> = { name: g.key };
      telecallers.forEach((t, idx) => {
        row[t.name.split(' ')[0]] = g.assignments[t.id] || 0;
      });
      return row;
    });
  }, [leads, telecallers, timeframe]);

  const telecallerColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444'];

  // Stats: Total leads assigned to telecallers
  const assignmentStats = useMemo(() => {
    const telecallerIds = new Set(telecallers.map(t => t.id));
    const assignedLeads = leads.filter(l => telecallerIds.has(l.assignedUserId));
    const unassignedLeads = leads.filter(l => !l.assignedUserId || !telecallerIds.has(l.assignedUserId));
    return {
      totalAssigned: assignedLeads.length,
      unassigned: unassignedLeads.length,
      totalLeads: leads.length,
    };
  }, [leads, telecallers]);

  const campaignStats = useMemo(() => {
    const totalSpend = MOCK_CAMPAIGNS.reduce((s, c) => s + c.spend, 0);
    const totalLeads = MOCK_CAMPAIGNS.reduce((s, c) => s + c.leads, 0);
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
    return { totalSpend, totalLeads, avgCPL };
  }, []);

  // Spend by platform for the bar chart
  const spendByPlatform = useMemo(() => {
    const groups: Record<string, number> = {};
    MOCK_CAMPAIGNS.forEach(c => { groups[c.platform] = (groups[c.platform] || 0) + c.spend; });
    return Object.entries(groups).map(([name, spend]) => ({ name, spend }));
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Live metrics and performance indicators for your team.</p>
        </div>
        
        {/* Global Timeframe Filter for Time-based charts */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-sm font-medium text-slate-600">View timeline by:</span>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
            <SelectTrigger className="h-8 border-none shadow-none focus:ring-0 w-[100px] font-semibold text-blue-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Day">Daily</SelectItem>
              <SelectItem value="Week">Weekly</SelectItem>
              <SelectItem value="Month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Summary Stats Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Leads Given to Telecallers</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{assignmentStats.totalAssigned}</p>
                <p className="text-xs text-slate-400 mt-0.5">out of {assignmentStats.totalLeads} total leads</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                <PhoneCall className="w-5 h-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Unassigned Leads</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{assignmentStats.unassigned}</p>
                <p className="text-xs text-slate-400 mt-0.5">waiting for assignment</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Booked</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {leads.filter(l => l.status === 'Booked').length}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">converted leads</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Telecallers</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{telecallers.length}</p>
                <p className="text-xs text-slate-400 mt-0.5">handling leads</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ── 1. Telecaller Conversion Rate (Replaces Sales Performance) ── */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Telecaller Conversion Rate</CardTitle>
            <CardDescription>Percentage of assigned leads converted to "Booked"</CardDescription>
          </CardHeader>
          <CardContent className="p-6 h-[300px] overflow-y-auto">
            {telecallerPerformance.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No performance data yet.
              </div>
            ) : (
              <div className="space-y-6">
                {telecallerPerformance.map((tp, index) => {
                  const colors = [
                    'from-emerald-400 to-emerald-500',
                    'from-blue-400 to-blue-500',
                    'from-purple-400 to-purple-500',
                    'from-orange-400 to-orange-500',
                    'from-pink-400 to-pink-500'
                  ];
                  const bgClass = colors[index % colors.length];
                  
                  return (
                    <div key={tp.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white bg-gradient-to-br ${bgClass} shadow-sm`}>
                            {index + 1}
                          </div>
                          <span className="font-semibold text-slate-800">{tp.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs font-medium">{tp.converted} / {tp.total} leads</span>
                          <span className="font-bold text-slate-900">{tp.rate}%</span>
                        </div>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${bgClass} transition-all duration-1000 ease-out relative`} 
                          style={{ width: `${Math.max(tp.rate, 2)}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 w-full h-full skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 2. Hot vs Warm vs Cold Leads ── */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Lead Pipeline Levels</CardTitle>
            <CardDescription>Current distribution of Hot, Warm, and Cold leads</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-6 flex flex-col justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadLevelsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {leadLevelsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── 3. Incoming Leads Over Time ── */}
        <Card className="md:col-span-2 bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Incoming Leads Volume</CardTitle>
            <CardDescription>Number of new leads created ({timeframe.toLowerCase()}ly)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsOverTime}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" name="New Leads" fill="url(#colorCount)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── 4. Lead Assignments by Telecaller ── */}
        <Card className="md:col-span-2 bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Lead Assignments by Telecaller</CardTitle>
            <CardDescription>How many leads each telecaller received ({timeframe.toLowerCase()}ly)</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] p-6">
            {assignmentsByTelecaller.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No assignment data available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assignmentsByTelecaller}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} label={{ value: 'Leads Assigned', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }} 
                    content={({ active, payload, label }) => {
                      if (!active || !payload) return null;
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-semibold text-slate-900 mb-2">{label}</p>
                          {payload.map((entry: any, idx: number) => (
                            entry.value > 0 && (
                              <div key={idx} className="flex items-center gap-2 py-0.5">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }} />
                                <span className="text-slate-600">{entry.name}:</span>
                                <span className="font-semibold text-slate-900">{entry.value} leads</span>
                              </div>
                            )
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  {telecallers.map((t, idx) => (
                    <Bar 
                      key={t.id}
                      dataKey={t.name.split(' ')[0]} 
                      name={t.name.split(' ')[0]}
                      stackId="a"
                      fill={telecallerColors[idx % telecallerColors.length]} 
                      radius={[0, 0, 0, 0]}
                    />
                  )).reverse()}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── 6. Conversion Rate Trends ── */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Conversion Rate Trends</CardTitle>
            <CardDescription>Percentage of leads booked ({timeframe.toLowerCase()}ly)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionTrends}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip formatter={(value: number) => [`${value}%`, 'Conversion Rate']} />
                <Line type="monotone" dataKey="rate" name="Conversion Rate" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── 7. Lead Source Distribution ── */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Lead Source Distribution</CardTitle>
            <CardDescription>Where your leads are coming from</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
       *  CAMPAIGN PERFORMANCE SECTION
       * ══════════════════════════════════════════════════════════════════════ */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Campaign Performance</h2>
            <p className="text-sm text-slate-500">Ad spend, leads generated, and cost-per-lead by campaign</p>
          </div>
        </div>

        {/* ── Campaign KPI cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-md rounded-xl text-white">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-blue-100">Total Ad Spend</p>
                  <p className="text-3xl font-bold mt-1">₹{campaignStats.totalSpend.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-blue-200 mt-1">across {MOCK_CAMPAIGNS.length} campaigns</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">₹</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-md rounded-xl text-white">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-emerald-100">Total Leads Generated</p>
                  <p className="text-3xl font-bold mt-1">{campaignStats.totalLeads.toLocaleString()}</p>
                  <p className="text-xs text-emerald-200 mt-1">from paid campaigns</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-md rounded-xl text-white">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-purple-100">Avg. Cost Per Lead</p>
                  <p className="text-3xl font-bold mt-1">₹{campaignStats.avgCPL.toFixed(0)}</p>
                  <p className="text-xs text-purple-200 mt-1">blended across all sources</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Spend by Platform chart + Campaign table ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 py-4">
              <CardTitle className="text-base font-semibold">Spend by Platform</CardTitle>
              <CardDescription>Total ad budget allocated per channel</CardDescription>
            </CardHeader>
            <CardContent className="h-[240px] p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendByPlatform}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.85}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={v => `₹${v.toLocaleString('en-IN')}`} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Spend']} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="spend" name="Ad Spend" fill="url(#spendGrad)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 py-4">
              <CardTitle className="text-base font-semibold">Leads vs CPL per Campaign</CardTitle>
              <CardDescription>Comparing volume to cost efficiency</CardDescription>
            </CardHeader>
            <CardContent className="h-[240px] p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_CAMPAIGNS.map(c => ({ name: c.platform, leads: c.leads, cpl: c.costPerLead }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} yAxisId="left" />
                  <YAxis axisLine={false} tickLine={false} yAxisId="right" orientation="right" tickFormatter={v => `₹${v.toLocaleString('en-IN')}`} />
                  <Tooltip formatter={(value: number, name: string) => name === 'cpl' ? [`₹${value.toLocaleString('en-IN')}`, 'CPL'] : [value, 'Leads']} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="cpl" name="CPL (₹)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ── Campaign detail table ─────────────────────────────────────── */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Campaign Breakdown</CardTitle>
            <CardDescription>Detailed performance per campaign</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-full text-[0.8125rem]">
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-500 px-6 py-3">Campaign Name</TableHead>
                  <TableHead className="font-semibold text-slate-500 px-6 py-3">Platform</TableHead>
                  <TableHead className="font-semibold text-slate-500 px-6 py-3">Spend</TableHead>
                  <TableHead className="font-semibold text-slate-500 px-6 py-3">Leads</TableHead>
                  <TableHead className="font-semibold text-slate-500 px-6 py-3">CPL</TableHead>
                  <TableHead className="font-semibold text-slate-500 px-6 py-3">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CAMPAIGNS.map(c => (
                  <TableRow key={c.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="px-6 py-4 font-semibold text-slate-900">{c.name}</TableCell>
                    <TableCell className="px-6 py-4 text-slate-500">{c.platform}</TableCell>
                    <TableCell className="px-6 py-4 text-slate-900 font-medium">₹{c.spend.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900">
                        {c.leads}
                        {c.trend === 'up'
                          ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-slate-900 font-medium">₹{c.costPerLead.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border shadow-none ${
                        c.status === 'Active'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        c.status === 'Paused'    ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                   'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
