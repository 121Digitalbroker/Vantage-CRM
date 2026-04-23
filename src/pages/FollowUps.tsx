import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isToday, isPast, differenceInHours, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  CalendarDays, Phone, Mail, Clock, Search, Filter, CheckCircle2,
  Flame, AlertCircle, Trash2, Eye, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchLeads, getFollowUps, deleteFollowUp, completeFollowUp } from '@/src/services/leadsService';
import type { DemoFollowUp } from '@/src/services/leadsService';
import type { Lead, LeadLevel } from '@/types';
import { useRole } from '@/src/contexts/RoleContext';

interface FollowUpWithLead extends DemoFollowUp {
  lead?: Lead;
}

type TypeFilter = 'all' | 'Call' | 'Meeting' | 'Site Visit' | 'Email' | 'WhatsApp' | 'Closure';

const getLevelColor = (level: LeadLevel) => {
  switch (level) {
    case 'Hot':  return 'text-red-500 bg-red-50 border-red-200';
    case 'Warm': return 'text-amber-500 bg-amber-50 border-amber-200';
    case 'Cold': return 'text-blue-500 bg-blue-50 border-blue-200';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'Call':       return <Phone className="w-4 h-4" />;
    case 'Email':      return <Mail className="w-4 h-4" />;
    case 'Meeting':    return <CalendarDays className="w-4 h-4" />;
    case 'Site Visit': return <CalendarDays className="w-4 h-4" />;
    case 'WhatsApp':   return <Phone className="w-4 h-4" />;
    default:           return <CalendarDays className="w-4 h-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'Call':       return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'Email':      return 'bg-purple-50 text-purple-600 border-purple-200';
    case 'Meeting':    return 'bg-green-50 text-green-600 border-green-200';
    case 'Site Visit': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'WhatsApp':   return 'bg-teal-50 text-teal-600 border-teal-200';
    case 'Closure':    return 'bg-orange-50 text-orange-600 border-orange-200';
    default:           return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

export default function FollowUps() {
  const navigate = useNavigate();
  const { currentUser, allUsers } = useRole();
  const isAdmin = currentUser.role === 'Admin';

  const [followUps, setFollowUps] = useState<FollowUpWithLead[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const getUserName = (userId: string) => {
    if (!userId?.trim()) return 'Unassigned';
    return allUsers.find(u => u.id === userId)?.name ?? userId;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const leadsData = await fetchLeads();

      // Collect all follow-ups from all leads
      const allFollowUps: FollowUpWithLead[] = [];
      for (const lead of leadsData) {
        const leadFollowUps = await getFollowUps(lead.id);
        leadFollowUps.forEach(fu => {
          allFollowUps.push({ ...fu, lead });
        });
      }

      // Filter by user role
      let filtered = allFollowUps;
      if (!isAdmin) {
        filtered = allFollowUps.filter(fu => fu.lead?.assignedUserId === currentUser.id);
      }

      setFollowUps(filtered);
    } catch (err) {
      toast.error('Failed to load follow-ups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (followUpId: string) => {
    if (!isAdmin) return;
    if (!confirm('Delete this follow-up?')) return;

    try {
      await deleteFollowUp(followUpId);
      setFollowUps(prev => prev.filter(fu => fu.id !== followUpId));
      toast.success('Follow-up deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleComplete = async (followUpId: string, leadId: string) => {
    try {
      await completeFollowUp(followUpId, leadId);
      setFollowUps(prev =>
        prev.map(fu =>
          fu.id === followUpId ? { ...fu, completed: true } : fu
        )
      );
      toast.success('Follow-up marked as done ✓');
    } catch {
      toast.error('Failed to complete follow-up');
    }
  };

  // Filter and categorize follow-ups
  const { overdue, today, upcoming, completed } = useMemo(() => {
    let filtered = followUps;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(fu =>
        fu.lead?.clientName.toLowerCase().includes(term) ||
        fu.lead?.phoneNumber.includes(term) ||
        fu.lead?.project.toLowerCase().includes(term) ||
        fu.notes.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(fu => fu.type === typeFilter);
    }

    const overdue: FollowUpWithLead[] = [];
    const today: FollowUpWithLead[] = [];
    const upcoming: FollowUpWithLead[] = [];
    const completed: FollowUpWithLead[] = [];

    filtered.forEach(fu => {
      const fuDate = parseISO(fu.date);

      if (fu.completed) {
        completed.push(fu);
      } else if (isPast(fuDate) && !isToday(fuDate)) {
        overdue.push(fu);
      } else if (isToday(fuDate)) {
        today.push(fu);
      } else {
        upcoming.push(fu);
      }
    });

    // Sort by date
    const sortByDate = (a: FollowUpWithLead, b: FollowUpWithLead) => 
      new Date(a.date).getTime() - new Date(b.date).getTime();

    overdue.sort(sortByDate);
    today.sort(sortByDate);
    upcoming.sort(sortByDate);
    completed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { overdue, today, upcoming, completed };
  }, [followUps, searchTerm, typeFilter]);

  const displayFollowUps = useMemo(() => {
    return [...overdue, ...today, ...upcoming, ...completed];
  }, [overdue, today, upcoming, completed]);

  const renderFollowUpCard = (fu: FollowUpWithLead) => {
    if (!fu.lead) return null;

    const fuDate = parseISO(fu.date);
    const now = new Date();
    const hoursUntil = differenceInHours(fuDate, now);
    const daysUntil = differenceInDays(fuDate, now);
    const isOverdue = isPast(fuDate) && !isToday(fuDate) && !fu.completed;
    const isTodayFu = isToday(fuDate);

    let timeText = '';
    if (fu.completed) {
      timeText = 'Completed';
    } else if (isOverdue) {
      if (Math.abs(hoursUntil) < 24) {
        timeText = `Overdue by ${Math.abs(hoursUntil)}h`;
      } else {
        timeText = `Overdue by ${Math.abs(daysUntil)}d`;
      }
    } else if (isTodayFu) {
      if (hoursUntil > 0) {
        timeText = `In ${hoursUntil}h`;
      } else {
        timeText = `${Math.abs(hoursUntil)}h ago`;
      }
    } else if (daysUntil === 1) {
      timeText = 'Tomorrow';
    } else {
      timeText = `In ${daysUntil}d`;
    }

    return (
      <Card
        key={fu.id}
        className={`
          border shadow-sm rounded-xl transition-all hover:shadow-md
          ${isOverdue ? 'bg-red-50/50 border-red-200' : ''}
          ${isTodayFu && !fu.completed ? 'bg-amber-50/30 border-amber-200' : ''}
          ${fu.completed ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}
        `}
      >
        <CardContent className="p-4">
          <div className="flex gap-4 items-start">
            {/* Icon */}
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${getTypeColor(fu.type)}`}>
              {getTypeIcon(fu.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-semibold text-slate-900 ${fu.completed ? 'line-through' : ''}`}>
                      {fu.lead.clientName}
                    </h4>
                    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${getLevelColor(fu.lead.leadLevel)}`}>
                      <Flame className="w-3 h-3 mr-0.5" />
                      {fu.lead.leadLevel}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">{fu.lead.project} • {fu.lead.leadSource}</p>
                </div>

                {/* Status Badge */}
                <Badge
                  variant="outline"
                  className={`
                    text-xs font-medium px-2 py-1 flex items-center gap-1
                    ${isOverdue ? 'bg-red-100 text-red-700 border-red-300' : ''}
                    ${isTodayFu && !fu.completed ? 'bg-amber-100 text-amber-700 border-amber-300' : ''}
                    ${fu.completed ? 'bg-green-100 text-green-700 border-green-300' : ''}
                    ${!isOverdue && !isTodayFu && !fu.completed ? 'bg-blue-100 text-blue-700 border-blue-300' : ''}
                  `}
                >
                  {isOverdue && <AlertCircle className="w-3 h-3" />}
                  {fu.completed && <CheckCircle2 className="w-3 h-3" />}
                  {isTodayFu && !fu.completed && <Clock className="w-3 h-3" />}
                  {timeText}
                </Badge>
              </div>

              {/* Phone & Contact Info */}
              <div className="flex items-center gap-4 mb-2">
                <a
                  href={`tel:${fu.lead.phoneNumber}`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {fu.lead.phoneNumber}
                </a>
                {fu.lead.investmentBudget && fu.lead.investmentBudget !== 'Not Specified' && (
                  <span className="text-xs text-emerald-600 font-semibold">
                    💰 {fu.lead.investmentBudget}
                  </span>
                )}
              </div>

              {/* Type & Notes */}
              <div className="space-y-1 mb-3">
                <p className="text-xs text-slate-600 font-medium">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${getTypeColor(fu.type)}`}>
                    {getTypeIcon(fu.type)}
                    {fu.type}
                  </span>
                </p>
                {fu.notes && (
                  <p className="text-sm text-slate-700 mt-1">💬 {fu.notes}</p>
                )}
              </div>

              {/* Footer - Date & Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {format(fuDate, 'MMM d, yyyy • h:mm a')}
                  </span>
                  <span>👤 {getUserName(fu.lead.assignedUserId)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!fu.completed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 font-medium"
                      onClick={() => handleComplete(fu.id, fu.lead?.id || '')}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Mark Done
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => navigate(`/leads/${fu.lead?.id}`)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    View Lead
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(fu.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-slate-500">Loading follow-ups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Follow-ups</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin ? 'Manage all scheduled follow-ups' : 'Your scheduled calls and meetings'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name, phone, project..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Call">Call</SelectItem>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Site Visit">Site Visit</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Closure">Closure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Follow-ups List */}
      {displayFollowUps.length === 0 ? (
        <Card className="bg-white border-slate-200">
          <CardContent className="p-12 text-center">
            <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No follow-ups found</p>
            <p className="text-sm text-slate-400 mt-1">
              {searchTerm || typeFilter !== 'all' ? 'Try adjusting your filters' : 'Schedule follow-ups from lead details'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayFollowUps.map(renderFollowUpCard)}
        </div>
      )}
    </div>
  );
}
