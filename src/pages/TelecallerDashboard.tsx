import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast, isToday, parseISO, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Phone,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Users,
  TrendingUp,
  Clock,
  ChevronRight,
  MessageSquarePlus,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Plus,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Lead, LeadStatus, LeadLevel } from '@/types';
import { fetchLeads, updateLead, updateLeadWithAudit, addNote, addFollowUp, createLead, isAssignmentExpired } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LEAD_STATUSES: LeadStatus[] = [
  'New', 'Interested', 'Site Visit Scheduled', 'Busy', 'Not Reachable', 'Fake Query',
  'Not Interested', 'Wrong Number', 'Low Budget',
];

const LEAD_LEVELS: LeadLevel[] = ['Hot', 'Warm', 'Cold'];
const LEAD_SOURCES = ['Meta Ads', 'Google Ads', 'Website', 'Referral', 'Salesperson'];
const PROJECTS = ['Sunset Villas', 'Downtown Heights', 'Oceanside Apartments', 'Green Meadows', 'Skyline Towers', 'Lakeview Residency'];

const blankLeadForm = () => ({
  clientName: '', phoneNumber: '', email: '', project: PROJECTS[0],
  leadSource: LEAD_SOURCES[0], campaignName: '', adsetName: '', adName: '',
  leadLevel: 'Warm' as LeadLevel, status: 'New' as LeadStatus,
  followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
});

const getStatusColors = (status: LeadStatus) => {
  switch (status) {
    case 'New':                   return 'bg-blue-100 text-blue-700';
    case 'Interested':            return 'bg-purple-100 text-purple-700';
    case 'Site Visit Scheduled':  return 'bg-cyan-100 text-cyan-700';
    case 'Busy':                  return 'bg-amber-100 text-amber-800';
    case 'Not Reachable':         return 'bg-slate-200 text-slate-700';
    case 'Fake Query':            return 'bg-rose-100 text-rose-800';
    case 'Not Interested':        return 'bg-red-100 text-red-700';
    case 'Wrong Number':          return 'bg-gray-100 text-gray-600';
    case 'Low Budget':            return 'bg-yellow-100 text-yellow-700';
    default:                      return 'bg-gray-100 text-gray-700';
  }
};

const getLevelColors = (level: string) => {
  switch (level) {
    case 'Hot':  return 'bg-red-100 text-red-600 border-red-200';
    case 'Warm': return 'bg-amber-100 text-amber-600 border-amber-200';
    case 'Cold': return 'bg-blue-100 text-blue-500 border-blue-200';
    default:     return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const getTimeRemaining = (lead: Lead): string => {
  if (!lead.assignmentExpiresAt || !lead.assignedUserId || lead.lastStatusUpdate) return '';
  
  const now = new Date();
  const expires = new Date(lead.assignmentExpiresAt);
  const diff = expires.getTime() - now.getTime();
  
  if (diff <= 0) return 'EXPIRED';
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const getFollowUpPriority = (dateStr: string) => {
  try {
    const date = parseISO(dateStr);
    if (isToday(date))  return { colors: 'bg-orange-100 text-orange-600 border-orange-200', label: 'Today' };
    if (isPast(date))   return { colors: 'bg-red-100 text-red-600 border-red-200',          label: 'Overdue' };
    return { colors: 'bg-green-100 text-green-600 border-green-200', label: 'Upcoming' };
  } catch {
    return { colors: 'bg-gray-100 text-gray-500', label: '—' };
  }
};

export default function TelecallerDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useRole();

  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [noteOpen, setNoteOpen]       = useState(false);
  const [fuOpen, setFuOpen]           = useState(false);
  const [addOpen, setAddOpen]         = useState(false);
  const [editOpen, setEditOpen]       = useState(false);
  const [targetLead, setTargetLead]   = useState<Lead | null>(null);
  const [noteText, setNoteText]       = useState('');
  const [fuData, setFuData]           = useState({ type: 'Call', date: '', notes: '' });
  const [formData, setFormData]       = useState(blankLeadForm());
  const [saving, setSaving]           = useState(false);

  const loadLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLeads(currentUser.id);
      setLeads(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load leads';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    try {
      const updated = await updateLeadWithAudit(leadId, { status }, currentUser.name);
      setLeads(prev => prev.map(l => l.id === leadId ? updated : l));
      toast.success(`Status updated to "${status}"`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openNoteDialog = (lead: Lead) => { setTargetLead(lead); setNoteText(''); setNoteOpen(true); };
  const openFuDialog = (lead: Lead) => {
    setTargetLead(lead);
    setFuData({ type: 'Call', date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16), notes: '' });
    setFuOpen(true);
  };

  const handleAddNote = async () => {
    if (!targetLead || !noteText.trim()) { toast.error('Please enter a note'); return; }
    setSaving(true);
    try {
      await addNote(targetLead.id, noteText.trim(), currentUser.name);
      setLeads(prev => prev.map(l => l.id === targetLead.id ? { ...l, lastContactedAt: new Date().toISOString() } : l));
      setNoteOpen(false);
      toast.success('Note added');
    } catch { toast.error('Failed to add note'); }
    finally { setSaving(false); }
  };

  const handleAddFollowUp = async () => {
    if (!targetLead || !fuData.date) {
      toast.error('Please select a date');
      return;
    }
    setSaving(true);
    try {
      await addFollowUp(targetLead.id, { type: fuData.type, date: new Date(fuData.date).toISOString(), notes: fuData.notes.trim() }, currentUser.name);
      const iso = new Date(fuData.date).toISOString();
      const now = new Date().toISOString();
      setLeads(prev => prev.map(l =>
        l.id === targetLead.id ? { ...l, followUpDate: iso, lastContactedAt: now } : l));
      setFuOpen(false);
      toast.success('Follow-up scheduled');
    } catch { toast.error('Failed to schedule'); }
    finally { setSaving(false); }
  };

  // ── Add Lead ─────────────────────────────────────────────────────────────
  const openAddDialog = () => {
    setFormData(blankLeadForm());
    setAddOpen(true);
  };

  const handleAddLead = async () => {
    if (!formData.clientName.trim() || !formData.phoneNumber.trim()) {
      toast.error('Client Name and Phone Number are required');
      return;
    }
    setSaving(true);
    try {
      const newLead = await createLead({
        clientName: formData.clientName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim() || undefined,
        project: formData.project,
        leadSource: formData.leadSource,
        campaignName: formData.campaignName.trim() || undefined,
        adsetName: formData.adsetName.trim() || undefined,
        adName: formData.adName.trim() || undefined,
        assignedUserId: currentUser.id,
        leadLevel: formData.leadLevel,
        status: formData.status,
        followUpDate: new Date(formData.followUpDate).toISOString(),
      });
      setLeads(prev => [newLead, ...prev]);
      setAddOpen(false);
      toast.success(`Lead "${newLead.clientName}" created`);
    } catch {
      toast.error('Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit Lead ────────────────────────────────────────────────────────────
  const openEditDialog = (lead: Lead) => {
    setTargetLead(lead);
    setFormData({
      clientName: lead.clientName,
      phoneNumber: lead.phoneNumber,
      email: lead.email ?? '',
      project: lead.project,
      leadSource: lead.leadSource,
      campaignName: lead.campaignName ?? '',
      adsetName: lead.adsetName ?? '',
      adName: lead.adName ?? '',
      leadLevel: lead.leadLevel,
      status: lead.status,
      followUpDate: lead.followUpDate.slice(0, 16),
    });
    setEditOpen(true);
  };

  const handleEditLead = async () => {
    if (!targetLead) return;
    if (!formData.clientName.trim() || !formData.phoneNumber.trim()) {
      toast.error('Client Name and Phone Number are required');
      return;
    }
    setSaving(true);
    try {
      const updates: Partial<Lead> = {
        clientName: formData.clientName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim() || undefined,
        project: formData.project,
        leadSource: formData.leadSource,
        campaignName: formData.campaignName.trim() || undefined,
        adsetName: formData.adsetName.trim() || undefined,
        adName: formData.adName.trim() || undefined,
        leadLevel: formData.leadLevel,
        status: formData.status,
        followUpDate: new Date(formData.followUpDate).toISOString(),
      };
      const updated = await updateLead(targetLead.id, updates);
      setLeads(prev => prev.map(l => l.id === targetLead.id ? updated : l));
      setEditOpen(false);
      toast.success(`Lead "${updated.clientName}" updated`);
    } catch {
      toast.error('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today      = leads.filter(l => { try { return isToday(parseISO(l.followUpDate)); } catch { return false; } });
    const overdue    = leads.filter(l => { try { return isPast(parseISO(l.followUpDate)) && !isToday(parseISO(l.followUpDate)); } catch { return false; } });
    const visitsSched = leads.filter(l => l.status === 'Site Visit Scheduled');
    const hotLeads   = leads.filter(l => l.leadLevel === 'Hot');
    return { total: leads.length, today: today.length, overdue: overdue.length, visitsSched: visitsSched.length, hot: hotLeads.length };
  }, [leads]);

  // Priority leads = today + overdue, sorted hot first
  const priorityLeads = useMemo(() => {
    return leads
      .filter(l => {
        try {
          const d = parseISO(l.followUpDate);
          return isToday(d) || isPast(d);
        } catch { return false; }
      })
      .sort((a, b) => {
        const order = { Hot: 0, Warm: 1, Cold: 2 };
        return order[a.leadLevel] - order[b.leadLevel];
      })
      .slice(0, 6);
  }, [leads]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Good morning, {currentUser.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {format(new Date(), 'EEEE, MMM d yyyy')} · Your assigned leads dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={openAddDialog}
            className="bg-blue-500 hover:bg-blue-600 text-white h-9"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 text-slate-600 h-9"
            onClick={loadLeads}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load leads from Supabase</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── Stats cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Today's Calls</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{loading ? '—' : stats.today}</p>
              <p className="text-xs text-slate-500 mt-1">follow-ups due today</p>
            </div>
            <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-orange-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Overdue</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{loading ? '—' : stats.overdue}</p>
              <p className="text-xs text-slate-500 mt-1">missed follow-ups</p>
            </div>
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Assigned</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{loading ? '—' : stats.total}</p>
              <p className="text-xs text-slate-500 mt-1">leads in your queue</p>
            </div>
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Visit scheduled</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{loading ? '—' : stats.visitsSched}</p>
              <p className="text-xs text-slate-500 mt-1">site visits on calendar</p>
            </div>
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Priority Calls Section ─────────────────────────────────────────── */}
      {(priorityLeads.length > 0 || loading) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-500" />
              <h2 className="font-semibold text-slate-900 text-sm">Today's Priority Calls</h2>
              {stats.today + stats.overdue > 0 && (
                <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">
                  {stats.today + stats.overdue}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-blue-500 hover:text-blue-600 h-7"
              onClick={() => navigate('/leads')}
            >
              View all leads
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mr-2" />
              <span className="text-sm text-slate-500">Loading leads…</span>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {priorityLeads.map(lead => {
                const priority = getFollowUpPriority(lead.followUpDate);
                return (
                  <div
                    key={lead.id}
                    className="border border-slate-200 rounded-lg p-3.5 hover:border-blue-300 hover:shadow-sm transition-all bg-slate-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{lead.clientName}</p>
                        <a
                          href={`tel:${lead.phoneNumber}`}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                        >
                          <Phone className="w-3 h-3" />
                          {lead.phoneNumber}
                        </a>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[0.6rem] font-bold uppercase px-1.5 border rounded-full shrink-0 shadow-none ${getLevelColors(lead.leadLevel)}`}
                      >
                        {lead.leadLevel}
                      </Badge>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={`text-[0.65rem] font-semibold px-1.5 py-0.5 rounded border ${priority.colors}`}>
                        {priority.label}
                      </span>
                      <span className="text-[0.68rem] text-slate-500">
                        {format(parseISO(lead.followUpDate), 'h:mm a')}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[0.68rem] text-slate-500 truncate">{lead.project}</span>
                    </div>

                    <div className="mt-3 flex gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 flex-1 rounded-md border border-slate-200 bg-background px-2 text-xs font-medium text-slate-600 shadow-sm hover:bg-blue-50 hover:border-blue-300 outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          Update Status
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[190px]">
                          <DropdownMenuLabel className="text-xs text-slate-500">Change status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {LEAD_STATUSES.map(s => (
                            <DropdownMenuItem
                              key={s}
                              className={`text-xs cursor-pointer ${lead.status === s ? 'font-semibold text-blue-600 bg-blue-50' : ''}`}
                              onClick={() => handleStatusChange(lead.id, s)}
                            >
                              {s}
                              {lead.status === s && <span className="ml-auto">✓</span>}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── All Assigned Leads Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900 text-sm">All My Leads</h2>
            <span className="text-xs text-slate-400">({loading ? '…' : leads.length})</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="text-[0.8125rem] min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                <TableHead className="font-semibold text-slate-500 px-4 py-3">Client</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3">Project</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3">Level</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3">Status</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3">Follow Up</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3">Last Contacted</TableHead>
                <TableHead className="text-right font-semibold text-slate-500 px-4 py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100">
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 animate-pulse rounded w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                    No leads assigned to you yet.
                  </TableCell>
                </TableRow>
              ) : (
                leads.map(lead => {
                  const followUp = getFollowUpPriority(lead.followUpDate);
                  return (
                    <TableRow
                      key={lead.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="font-semibold text-slate-900 text-sm">{lead.clientName}</div>
                        <a
                          href={`tel:${lead.phoneNumber}`}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                        >
                          <Phone className="w-3 h-3" />
                          {lead.phoneNumber}
                        </a>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <div className="font-medium text-slate-700 text-xs">{lead.project}</div>
                        <div className="text-[0.68rem] text-slate-400">{lead.leadSource}</div>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={`rounded-full text-[0.65rem] font-bold uppercase px-2 py-0.5 border shadow-none ${getLevelColors(lead.leadLevel)}`}
                        >
                          {lead.leadLevel}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full cursor-pointer max-w-full">
                              <Badge
                                variant="secondary"
                                className={`rounded-full text-[0.65rem] font-semibold px-2 py-0.5 hover:opacity-80 border-none shadow-none pointer-events-none ${getStatusColors(lead.status)}`}
                              >
                                {lead.status}
                              </Badge>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[190px]">
                              <DropdownMenuLabel className="text-xs text-slate-500">Update status</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {LEAD_STATUSES.map(s => (
                                <DropdownMenuItem
                                  key={s}
                                  className={`text-xs cursor-pointer ${lead.status === s ? 'font-semibold text-blue-600 bg-blue-50' : ''}`}
                                  onClick={() => handleStatusChange(lead.id, s)}
                                >
                                  {s}
                                  {lead.status === s && <span className="ml-auto">✓</span>}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {lead.assignedUserId && !lead.lastStatusUpdate && lead.assignmentExpiresAt && (
                            <span className={`text-[0.65rem] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 w-fit ${isAssignmentExpired(lead) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              ⏱ {getTimeRemaining(lead)}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <button
                          type="button"
                          className="space-y-1 text-left rounded-md px-1.5 py-1 -mx-1.5 hover:bg-blue-50 transition-colors cursor-pointer"
                          onClick={() => openFuDialog(lead)}
                          title="Click to update follow-up"
                        >
                          <span className={`inline-block text-[0.65rem] font-semibold px-1.5 py-0.5 rounded border ${followUp.colors}`}>
                            {followUp.label}
                          </span>
                          <div className="text-xs text-slate-700">
                            {(() => { try { return format(parseISO(lead.followUpDate), 'MMM d, yyyy'); } catch { return '—'; } })()}
                          </div>
                        </button>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        {lead.lastContactedAt ? (
                          <div>
                            <div className="text-xs text-slate-700">
                              {format(parseISO(lead.lastContactedAt), 'MMM d, yyyy')}
                            </div>
                            <div className="text-[0.68rem] text-slate-400 mt-0.5">
                              {formatDistanceToNow(parseISO(lead.lastContactedAt), { addSuffix: true })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Never</span>
                        )}
                      </TableCell>

                      <TableCell className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Row actions"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent hover:bg-muted text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem
                              className="cursor-pointer text-xs"
                              onClick={() => navigate(`/leads/${lead.id}`)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-2 text-blue-500" />
                              View Lead
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-xs"
                              onClick={() => openEditDialog(lead)}
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-2 text-amber-500" />
                              Edit Lead
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-xs"
                              onClick={() => openNoteDialog(lead)}
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5 mr-2 text-slate-500" />
                              Add Note
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-xs"
                              onClick={() => openFuDialog(lead)}
                            >
                              <Clock className="w-3.5 h-3.5 mr-2 text-slate-500" />
                              Add Follow-up
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-between text-xs text-slate-400">
          <span>Showing {leads.length} assigned leads</span>
          <button
            className="text-blue-500 hover:underline"
            onClick={() => navigate('/leads')}
          >
            View all CRM leads →
          </button>
        </div>
      </div>

      {/* ── Add Note Dialog ──────────────────────────────────────────────── */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              {targetLead ? `Add a note for ${targetLead.clientName}` : 'Add a note'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Enter your note…"
              className="min-h-[120px] resize-none text-sm"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleAddNote} disabled={saving || !noteText.trim()}>
              {saving ? 'Saving…' : 'Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Follow-up Dialog ──────────────────────────────────────────── */}
      <Dialog open={fuOpen} onOpenChange={setFuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
            <DialogDescription>
              {targetLead ? `Schedule a follow-up for ${targetLead.clientName}` : 'Schedule a follow-up'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Type</Label>
              <Select value={fuData.type} onValueChange={v => setFuData(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Call', 'Meeting', 'Site Visit', 'Email', 'WhatsApp', 'Closure'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date & Time</Label>
              <Input
                type="datetime-local"
                value={fuData.date}
                onChange={e => setFuData(f => ({ ...f, date: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea
                placeholder="Brief description…"
                className="min-h-[80px] resize-none text-sm"
                value={fuData.notes}
                onChange={e => setFuData(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFuOpen(false)}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleAddFollowUp} disabled={saving || !fuData.date}>
              {saving ? 'Saving…' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Lead Dialog ───────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Create a new lead and assign it to yourself. Add campaign details as needed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Client Name *</Label>
                <Input
                  placeholder="Full name"
                  value={formData.clientName}
                  onChange={e => setFormData(f => ({ ...f, clientName: e.target.value }))}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone Number *</Label>
                <Input
                  placeholder="+91 XXXXX XXXXX"
                  value={formData.phoneNumber}
                  onChange={e => setFormData(f => ({ ...f, phoneNumber: e.target.value }))}
                  className="text-sm h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Project</Label>
                <Select value={formData.project} onValueChange={v => setFormData(f => ({ ...f, project: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECTS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Lead Source</Label>
                <Select value={formData.leadSource} onValueChange={v => setFormData(f => ({ ...f, leadSource: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Lead Level</Label>
                <Select value={formData.leadLevel} onValueChange={v => setFormData(f => ({ ...f, leadLevel: v as LeadLevel }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_LEVELS.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campaign Details Hidden */}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(f => ({ ...f, status: v as LeadStatus }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Follow-up Date</Label>
                <Input
                  type="datetime-local"
                  value={formData.followUpDate}
                  onChange={e => setFormData(f => ({ ...f, followUpDate: e.target.value }))}
                  className="text-sm h-9"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleAddLead} disabled={saving}>
              {saving ? 'Creating…' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Lead Dialog ──────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update lead information and campaign details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Client Name *</Label>
                <Input
                  placeholder="Full name"
                  value={formData.clientName}
                  onChange={e => setFormData(f => ({ ...f, clientName: e.target.value }))}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone Number *</Label>
                <Input
                  placeholder="+91 XXXXX XXXXX"
                  value={formData.phoneNumber}
                  onChange={e => setFormData(f => ({ ...f, phoneNumber: e.target.value }))}
                  className="text-sm h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Project</Label>
                <Select value={formData.project} onValueChange={v => setFormData(f => ({ ...f, project: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECTS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Lead Source</Label>
                <Select value={formData.leadSource} onValueChange={v => setFormData(f => ({ ...f, leadSource: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Lead Level</Label>
                <Select value={formData.leadLevel} onValueChange={v => setFormData(f => ({ ...f, leadLevel: v as LeadLevel }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_LEVELS.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campaign Details Hidden */}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(f => ({ ...f, status: v as LeadStatus }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Follow-up Date</Label>
                <Input
                  type="datetime-local"
                  value={formData.followUpDate}
                  onChange={e => setFormData(f => ({ ...f, followUpDate: e.target.value }))}
                  className="text-sm h-9"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleEditLead} disabled={saving}>
              {saving ? 'Updating…' : 'Update Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
