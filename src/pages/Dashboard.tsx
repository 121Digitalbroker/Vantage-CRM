import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Clock,
  RefreshCw,
  KanbanSquare,
  CalendarClock,
  CircleDot,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Lead, LeadStatus } from '@/types';
import { fetchLeads } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';

const PIPELINE_STAGES: LeadStatus[] = [
  'New',
  'Interested',
  'Site Visit Scheduled',
  'Busy',
  'Not Reachable',
  'Fake Query',
];

const CLOSED_STATUSES: LeadStatus[] = ['Not Interested', 'Wrong Number', 'Low Budget', 'Fake Query', 'Not Reachable'];

/** Primary “success” stage for KPIs (replaces legacy Booked) */
const VISIT_SCHEDULED: LeadStatus = 'Site Visit Scheduled';

const stageColors = ['#60a5fa', '#a78bfa', '#22d3ee', '#fbbf24', '#94a3b8', '#fb7185'];
const activityColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

// Add this component at the top of the file or bottom, before export default function
function ConcentricRings({ progressRings }: { progressRings: any[] }) {
  const rings = [
    { size: 240, strokeWidth: 24, color: progressRings[0]?.color || '#E07A5F', percent: progressRings[0]?.percent || 0 },
    { size: 170, strokeWidth: 24, color: progressRings[1]?.color || '#81B29A', percent: progressRings[1]?.percent || 0 },
    { size: 100, strokeWidth: 24, color: progressRings[2]?.color || '#F2CC8F', percent: progressRings[2]?.percent || 0 },
  ];

  const maxSize = rings[0].size + rings[0].strokeWidth;

  return (
    <div className="relative flex items-center justify-center" style={{ width: maxSize, height: maxSize }}>
      <svg width={maxSize} height={maxSize} className="transform -rotate-90">
        {rings.map((ring, i) => {
          const radius = ring.size / 2;
          const circumference = radius * 2 * Math.PI;
          const offset = circumference - (ring.percent / 100) * circumference;
          const center = maxSize / 2;

          return (
            <g key={i}>
              {/* Background Track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                fill="transparent"
                opacity={0.1}
              />
              {/* Foreground Progress Arc */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { telecallers } = useRole();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await fetchLeads();
      setLeads(data);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    const isSameDate = (a: string) => {
      const d = new Date(a);
      return d.getFullYear() === today.getFullYear()
        && d.getMonth() === today.getMonth()
        && d.getDate() === today.getDate();
    };

    const todaysLeads = leads.filter(l => isSameDate(l.createdAt)).length;
    const pendingFollowUps = leads.filter(l => !CLOSED_STATUSES.includes(l.status)).length;
    const convertedLeads = leads.filter(l => l.status === VISIT_SCHEDULED).length;
    const activeLeads = leads.filter(l => !CLOSED_STATUSES.includes(l.status)).length;

    return [
      { title: "Today's Leads", value: String(todaysLeads), icon: UserPlus, tone: 'bg-blue-50 text-blue-600' },
      { title: 'Open Pipeline', value: String(activeLeads), icon: KanbanSquare, tone: 'bg-indigo-50 text-indigo-600' },
      { title: 'Visits scheduled', value: String(convertedLeads), icon: UserCheck, tone: 'bg-emerald-50 text-emerald-600' },
      { title: 'Active Telecallers', value: String(telecallers.length), icon: Users, tone: 'bg-purple-50 text-purple-600' },
      { title: 'Pending Follow-ups', value: String(pendingFollowUps), icon: Clock, tone: 'bg-amber-50 text-amber-600' },
    ];
  }, [leads, telecallers.length]);

  const pipelineHealth = useMemo(() => {
    const counts = PIPELINE_STAGES.map(stage => ({
      stage,
      count: leads.filter(l => l.status === stage).length,
    }));

    const totalInPipeline = counts.reduce((acc, curr) => acc + curr.count, 0);

    return counts.map((item, index) => {
      const prevCount = index === 0 ? counts[0].count : counts[index - 1].count;
      const ratio = index === 0
        ? 100
        : prevCount > 0
          ? Math.min(100, Math.round((item.count / prevCount) * 100))
          : 0;

      return {
        ...item,
        ratio,
        totalInPipeline,
        color: stageColors[index],
      };
    });
  }, [leads]);

  const dealsBySalesPerson = useMemo(() => {
    return telecallers
      .map(user => {
        const assigned = leads.filter(l => l.assignedUserId === user.id);
        const open = assigned.filter(l => !CLOSED_STATUSES.includes(l.status)).length;
        const visits = assigned.filter(l => l.status === VISIT_SCHEDULED).length;
        return {
          name: user.name.length > 14 ? `${user.name.slice(0, 14)}...` : user.name,
          open,
          booked: visits,
          total: assigned.length,
        };
      })
      .filter(user => user.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [telecallers, leads]);

  const activityStatus = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;

    const upcoming = { name: 'Upcoming', value: 0 };
    const todayBucket = { name: 'Today', value: 0 };
    const overdue = { name: 'Overdue', value: 0 };
    const completed = { name: 'Visit sched.', value: leads.filter(l => l.status === VISIT_SCHEDULED).length };

    leads
      .filter(l => !CLOSED_STATUSES.includes(l.status))
      .forEach(lead => {
        const time = new Date(lead.followUpDate).getTime();
        if (Number.isNaN(time)) return;
        if (time < start) overdue.value += 1;
        else if (time < end) todayBucket.value += 1;
        else upcoming.value += 1;
      });

    return [overdue, todayBucket, upcoming, completed];
  }, [leads]);

  const progressRings = useMemo(() => {
    // 1. Lead Conversion Goal
    const closed = leads.filter(l => l.status === VISIT_SCHEDULED).length;
    const totalOpenOrClosed = leads.filter(l => l.status !== 'Wrong Number' && l.status !== 'Not Interested').length;
    const conversionRate = totalOpenOrClosed > 0 ? (closed / totalOpenOrClosed) * 100 : 0;

    // 2. Hot Lead Engagement
    const hotLeads = leads.filter(l => l.leadLevel === 'Hot');
    const hotEngaged = hotLeads.filter(l => l.status !== 'New').length;
    const hotEngagedRate = hotLeads.length > 0 ? (hotEngaged / hotLeads.length) * 100 : 0;

    // 3. Revenue Goal
    const goalRaw = localStorage.getItem('crm_revenue_goal') || '50000000';
    const avgValueRaw = localStorage.getItem('crm_avg_deal_value') || '5000000';
    const revenueGoal = parseInt(goalRaw, 10) || 50000000;
    const avgDealValue = parseInt(avgValueRaw, 10) || 5000000;

    const today = new Date();
    const currentMonthBookedLeads = leads.filter(l => {
      if (l.status !== VISIT_SCHEDULED) return false;
      const d = new Date(l.createdAt);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;

    const achievedRevenue = currentMonthBookedLeads * avgDealValue;
    const revenueGoalPercent = revenueGoal > 0 ? (achievedRevenue / revenueGoal) * 100 : 0;

    const formatINR = (num: number) => {
      if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
      if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
      if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
      return `₹${num}`;
    };

    return [
      { title: 'Conversion Goal', percent: Math.round(conversionRate), value: `${closed}/${totalOpenOrClosed}`, color: '#E07A5F' },
      { title: 'Hot Engagement', percent: Math.round(hotEngagedRate), value: `${hotEngaged}/${hotLeads.length}`, color: '#81B29A' },
      { title: 'Revenue Goal', percent: Math.min(100, Math.round(revenueGoalPercent)), value: `${formatINR(achievedRevenue)}/${formatINR(revenueGoal)}`, color: '#F2CC8F' },
    ];
  }, [leads]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Pipeline-focused admin insights for leads, salespeople, and follow-up activity.</p>
        </div>
        <Button variant="outline" className="border-slate-200 h-9" onClick={loadLeads}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-2">{stat.title}</h3>
                  <div className="text-3xl font-bold text-slate-900 leading-none">{stat.value}</div>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.tone}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress Rings & Pipeline Health Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Concentric Rings Card (Left Side) */}
        <Card className="bg-gradient-to-br from-[#3A2F2C] via-[#4A3F3A] to-[#5E5147] border-[#6B5B52] shadow-sm rounded-xl overflow-hidden flex flex-col items-center justify-center p-8">
          <div className="text-center mb-6">
            <h3 className="text-[#F8F4EF] font-semibold text-lg tracking-wide">Key Metrics</h3>
            <p className="text-[#D6C9BC] text-xs mt-1">Conversion vs Engagement vs Revenue</p>
          </div>
          
          <ConcentricRings progressRings={progressRings} />
          
          {/* Legend */}
          <div className="flex flex-col gap-3 mt-8 w-full max-w-[200px]">
            {progressRings.map((ring) => (
              <div key={ring.title} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ring.color }} />
                  <span className="text-[#E7DDD3] text-xs font-medium">{ring.title}</span>
                </div>
                <span className="text-[#FFF8EF] text-xs font-bold">{ring.percent}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Pipeline Health Card (Right Side) */}
        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 py-4 bg-white">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full border border-slate-300 text-slate-700">
              <span className="text-sm font-bold">$</span>
            </div>
            <CardTitle className="text-base font-semibold text-slate-900">Pipeline health</CardTitle>
          </div>
          <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-1.5">
            ALL LEADS · LIFETIME · WON, LOST, OPEN
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <div className="text-center mb-10">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Overall Pipeline Win Rate</h3>
              <div className="text-4xl font-black text-slate-900 flex items-center justify-center gap-2">
                {pipelineHealth.length > 0 && pipelineHealth[0].totalInPipeline > 0 
                  ? Math.round((pipelineHealth[pipelineHealth.length - 1].count / pipelineHealth[0].totalInPipeline) * 100) 
                  : 0}%
                <span className="text-sm font-medium text-slate-400">conversion</span>
              </div>
            </div>
            
            <div className="relative h-[240px] flex pl-10 pr-4">
              {/* Y-Axis */}
              <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-[10px] text-slate-400 font-bold">
                <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap text-slate-300 uppercase tracking-widest">
                  Deals Count
                </div>
                {[...Array(3)].map((_, i) => {
                  const max = Math.max(...pipelineHealth.map(p => p.count), 4);
                  const step = Math.ceil(max / 2);
                  const val = (2 - i) * step;
                  return (
                    <div key={i} className="flex items-center justify-end pr-3 h-0 relative">
                      <span className="absolute -translate-y-1/2">{val}</span>
                    </div>
                  );
                })}
              </div>

              {/* Grid Lines */}
              <div className="absolute left-10 right-4 top-0 bottom-8 flex flex-col justify-between">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-full border-t border-slate-50 h-0" />
                ))}
              </div>

              {/* Bars and Chevrons */}
              <div className="relative w-full h-[calc(100%-32px)] flex items-end z-10">
                {pipelineHealth.map((item, index) => {
                  const max = Math.max(...pipelineHealth.map(p => p.count), 4);
                  const step = Math.ceil(max / 2);
                  const graphMax = step * 2;
                  
                  const heightPct = item.count === 0 ? 0 : Math.max(2, (item.count / graphMax) * 100);
                  const isWon = item.stage === VISIT_SCHEDULED;
                  const barColor = isWon ? 'bg-[#4cb276]' : 'bg-[#ffcd4b]';
                  
                  return (
                    <div key={item.stage} className="flex-1 flex flex-col h-full relative group">
                      {/* Bar Container */}
                      <div className="w-full flex-1 flex flex-col justify-end relative px-1.5 md:px-4">
                        {/* Bar with Label Inside/Mid */}
                        <div 
                          className={`w-full transition-all duration-700 rounded-t-md relative flex items-center justify-center overflow-hidden ${heightPct === 0 ? 'bg-transparent border-b-2 border-slate-100' : barColor + ' shadow-sm hover:brightness-105'}`}
                          style={{ height: `${heightPct}%` }}
                        >
                           {heightPct > 15 && (
                             <span className="text-white text-[11px] font-black drop-shadow-sm">
                               {item.count}
                             </span>
                           )}
                        </div>

                        {/* Label Above Bar if too short to fit inside */}
                        {heightPct <= 15 && item.count > 0 && (
                          <div 
                            className="w-full text-center text-[11px] font-black text-slate-700 absolute transition-all duration-300"
                            style={{ bottom: `calc(${heightPct}% + 6px)` }}
                          >
                            {item.count}
                          </div>
                        )}

                        {/* 0 label */}
                        {item.count === 0 && (
                           <div className="w-full text-center text-[10px] font-bold text-slate-300 absolute bottom-1">
                             0
                           </div>
                        )}
                      </div>

                      {/* X-Axis Label */}
                      <div className="absolute -bottom-10 left-0 right-0 text-center text-[10px] font-bold text-slate-500 px-0.5 leading-tight">
                        {item.stage === 'Site Visit Scheduled' ? 'Visit\nSched.' :
                         item.stage === 'Not Reachable' ? 'No\nreach' :
                         item.stage === 'Fake Query' ? 'Fake\nquery' :
                         item.stage === 'Busy' ? 'Busy' : item.stage}
                      </div>

                      {/* Conversion Chevron */}
                      {index < pipelineHealth.length - 1 && (
                        <div className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-10 pointer-events-none">
                          <div className="relative bg-slate-700 text-white text-[9px] font-black px-1.5 py-1 flex items-center justify-center min-w-[34px] rounded-sm shadow-md">
                            {pipelineHealth[index + 1].ratio}%
                            {/* CSS Triangle for Chevron */}
                            <div className="absolute -right-2 top-0 w-0 h-0 border-y-[9px] border-y-transparent border-l-[8px] border-l-slate-700" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-12 pt-6 border-t border-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ffcd4b] shadow-inner" />
                Active Pipeline
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#4cb276] shadow-inner" />
                Visit scheduled
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Deals Status by Sales Person</CardTitle>
            <CardDescription>Assigned leads: open pipeline vs. visit scheduled.</CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {dealsBySalesPerson.length === 0 ? (
              <p className="text-sm text-slate-500">No salesperson lead assignments yet.</p>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dealsBySalesPerson} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#475569' }} width={110} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                    />
                    <Bar dataKey="open" stackId="a" fill="#93c5fd" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="booked" stackId="a" fill="#34d399" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Activities Status</CardTitle>
            <CardDescription>Follow-up workload: overdue, today, upcoming, and visits scheduled.</CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-3 mb-5">
              {activityStatus.map((item, index) => {
                const icons = [CalendarClock, Clock, Users, CheckCircle2] as const;
                const Icon = icons[index];
                return (
                  <div key={item.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.name}</p>
                      <Icon className="w-4 h-4" style={{ color: activityColors[index] }} />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 leading-none">{item.value}</div>
                  </div>
                );
              })}
            </div>
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityStatus} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {activityStatus.map((entry, index) => (
                      <Cell key={entry.name} fill={activityColors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
