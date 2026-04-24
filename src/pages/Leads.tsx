import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast, isToday, parseISO, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  FileDown, FileUp, Filter, MoreHorizontal, Plus, Search,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit, UserPlus,
  Trash2, MessageSquarePlus, CalendarPlus, ChevronDown, Phone, RefreshCw, AlertCircle,
  LayoutList, Kanban,
} from 'lucide-react';
import PipelineView from '@/src/components/PipelineView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableCell, TableHead, TableHeader, TableRow, TableBody } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lead, LeadStatus, LeadLevel, InvestmentBudget } from '@/types';
import {
  fetchLeads, createLead, createLeadWithDate, checkDuplicateLead, updateLead, updateLeadWithAudit, assignLead, deleteLead, exportLeadsCSV, isAssignmentExpired,
} from '@/src/services/leadsService';
import { addNote, addFollowUp } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const LEAD_STATUSES: LeadStatus[] = [
  'New', 'Interested', 'Site Visit Scheduled', 'Busy', 'Not Reachable', 'Fake Query',
  'Not Interested', 'Wrong Number', 'Low Budget',
];
const LEAD_LEVELS: LeadLevel[] = ['Hot', 'Warm', 'Cold'];
const LEAD_SOURCES = ['Meta Ads', 'Google Ads', 'Website', 'Referral', 'Salesperson'];
const PROJECTS = ['Sunset Villas', 'Downtown Heights', 'Oceanside Apartments', 'Green Meadows', 'Skyline Towers', 'Lakeview Residency'];
const INVESTMENT_BUDGETS: InvestmentBudget[] = ['Below ₹50L', '₹50L - ₹1Cr', 'Above ₹1Cr', 'Not Specified'];

type SortField = 'createdAt' | 'followUpDate' | 'leadLevel' | 'status' | 'assignedUserId';
type SortDir   = 'asc' | 'desc';
const LEVEL_ORDER: Record<LeadLevel, number> = { Hot: 0, Warm: 1, Cold: 2 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const getLevelColors = (level: LeadLevel) => {
  switch (level) {
    case 'Hot':  return 'bg-red-100 text-red-600 border-red-200';
    case 'Warm': return 'bg-amber-100 text-amber-600 border-amber-200';
    case 'Cold': return 'bg-blue-100 text-blue-500 border-blue-200';
  }
};

const getStatusColors = (status: LeadStatus) => {
  switch (status) {
    case 'New':                  return 'bg-blue-100 text-blue-700';
    case 'Interested':           return 'bg-purple-100 text-purple-700';
    case 'Site Visit Scheduled': return 'bg-cyan-100 text-cyan-700';
    case 'Busy':                 return 'bg-amber-100 text-amber-800';
    case 'Not Reachable':        return 'bg-slate-200 text-slate-700';
    case 'Fake Query':           return 'bg-rose-100 text-rose-800';
    case 'Not Interested':       return 'bg-red-100 text-red-700';
    case 'Wrong Number':         return 'bg-gray-100 text-gray-600';
    case 'Low Budget':           return 'bg-yellow-100 text-yellow-700';
    default:                     return 'bg-gray-100 text-gray-700';
  }
};

const getFollowUpPriority = (dateStr: string) => {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return { colors: 'bg-orange-100 text-orange-600 border-orange-200', label: 'Today' };
    if (isPast(date))  return { colors: 'bg-red-100 text-red-600 border-red-200',          label: 'Overdue' };
  } catch { /* ignore */ }
  return { colors: 'bg-green-100 text-green-600 border-green-200', label: 'Upcoming' };
};

const getSourceLabel = (source: string) => {
  switch (source) {
    case 'Meta Ads':   return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'Google Ads': return 'bg-red-50 text-red-600 border-red-200';
    case 'Website':    return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'Referral':   return 'bg-green-50 text-green-600 border-green-200';
    case 'Salesperson': return 'bg-purple-50 text-purple-600 border-purple-200';
    default:           return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const blankLeadForm = () => ({
  clientName: '', phoneNumber: '', email: '', project: PROJECTS[0],
  leadSource: LEAD_SOURCES[0], campaignName: '', adsetName: '', adName: '',
  assignedUserId: '', leadLevel: 'Warm' as LeadLevel, status: 'New' as LeadStatus,
  followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  investmentBudget: 'Not Specified' as InvestmentBudget,
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Leads() {
  const navigate  = useNavigate();
  const { currentUser, telecallers, allUsers, isAdmin, isTelecaller } = useRole();

  const [leads,        setLeads]       = useState<Lead[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState<string | null>(null);
  const [searchTerm,   setSearchTerm]  = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [levelFilter,  setLevelFilter]  = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [sortField,    setSortField]   = useState<SortField>('createdAt');
  const [sortDir,      setSortDir]     = useState<SortDir>('desc');

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [addOpen, setAddOpen]           = useState(false);
  const [editOpen, setEditOpen]         = useState(false);
  const [noteOpen, setNoteOpen]         = useState(false);
  const [fuOpen, setFuOpen]             = useState(false);
  const [importOpen, setImportOpen]     = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [targetLead, setTargetLead]     = useState<Lead | null>(null);
  const [formData, setFormData]         = useState(blankLeadForm());
  const [noteText, setNoteText]         = useState('');
  const [fuData, setFuData]             = useState({ type: 'Call', date: '', notes: '' });
  const [saving, setSaving]             = useState(false);
  const [viewMode, setViewMode]         = useState<'table' | 'pipeline'>('table');

  const getUserName = (id: string) => {
    if (!id?.trim()) return 'Unassigned';
    return allUsers.find(u => u.id === id)?.name ?? telecallers.find(u => u.id === id)?.name ?? id;
  };

  // ── Data fetching ────────────────────────────────────────────────────────
  const loadLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const assignedTo = isTelecaller ? currentUser.id : undefined;
      const data = await fetchLeads(assignedTo);
      setLeads(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeads(); }, [currentUser.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sort toggle ──────────────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp   className="w-3 h-3 ml-1 text-blue-500" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  // ── Inline updaters ──────────────────────────────────────────────────────
  const patchLocal = (id: string, patch: Partial<Lead>) =>
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  const handleAssign = async (leadId: string, userId: string) => {
    const isUnassign = !userId?.trim();
    if (isUnassign) {
      patchLocal(leadId, {
        assignedUserId: '',
        assignedAt: undefined,
        assignmentExpiresAt: undefined,
      });
    } else {
      patchLocal(leadId, { assignedUserId: userId });
    }
    try {
      await assignLead(leadId, isUnassign ? '' : userId, currentUser.name);
      if (isUnassign) toast.success('Lead unassigned.');
      else {
        const name = telecallers.find(u => u.id === userId)?.name ?? userId;
        toast.success(`Lead assigned to ${name}`);
      }
    } catch {
      toast.error('Failed to save assignment');
      loadLeads();
    }
  };

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    try {
      const updated = await updateLeadWithAudit(leadId, { status }, currentUser.name);
      patchLocal(leadId, updated);
      toast.success(`Status updated to "${status}"`);
    } catch {
      toast.error('Failed to update status');
      loadLeads();
    }
  };

  const handleLevelChange = async (leadId: string, level: LeadLevel) => {
    patchLocal(leadId, { leadLevel: level });
    try {
      await updateLead(leadId, { leadLevel: level });
      toast.success(`Lead level set to ${level}`);
    } catch {
      toast.error('Failed to update level');
      loadLeads();
    }
  };

  const handleDelete = async (leadId: string, clientName: string) => {
    if (!confirm(`Delete lead "${clientName}"? This cannot be undone.`)) return;
    setLeads(prev => prev.filter(l => l.id !== leadId));
    try {
      await deleteLead(leadId);
      toast.success(`Lead "${clientName}" deleted`);
    } catch {
      toast.error('Failed to delete lead');
      loadLeads();
    }
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
        assignedUserId: formData.assignedUserId,
        leadLevel: formData.leadLevel,
        status: formData.status,
        followUpDate: new Date(formData.followUpDate).toISOString(),
        investmentBudget: formData.investmentBudget,
      });
      setLeads(prev => [newLead, ...prev]);
      // Clear filters so the new lead is visible (new leads are usually "New" status)
      setStatusFilter('All');
      setLevelFilter('All');
      setAssigneeFilter('All');
      setSearchTerm('');
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
      assignedUserId: lead.assignedUserId,
      leadLevel: lead.leadLevel,
      status: lead.status,
      followUpDate: lead.followUpDate.slice(0, 16),
      investmentBudget: lead.investmentBudget ?? 'Not Specified',
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
        assignedUserId: formData.assignedUserId,
        leadLevel: formData.leadLevel,
        status: formData.status,
        followUpDate: new Date(formData.followUpDate).toISOString(),
        investmentBudget: formData.investmentBudget,
      };
      const updated = await updateLead(targetLead.id, updates);
      patchLocal(targetLead.id, updated);
      setEditOpen(false);
      toast.success(`Lead "${updated.clientName}" updated`);
    } catch {
      toast.error('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  // ── Add Note ─────────────────────────────────────────────────────────────
  const openNoteDialog = (lead: Lead) => {
    setTargetLead(lead);
    setNoteText('');
    setNoteOpen(true);
  };

  const handleAddNote = async () => {
    if (!targetLead || !noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }
    setSaving(true);
    try {
      await addNote(targetLead.id, noteText.trim(), currentUser.name);
      patchLocal(targetLead.id, { lastContactedAt: new Date().toISOString() });
      setNoteOpen(false);
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  // ── Add Follow-up ────────────────────────────────────────────────────────
  const openFuDialog = (lead: Lead) => {
    setTargetLead(lead);
    setFuData({
      type: 'Call',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      notes: '',
    });
    setFuOpen(true);
  };

  const handleAddFollowUp = async () => {
    if (!targetLead || !fuData.date) {
      toast.error('Please select a date');
      return;
    }
    setSaving(true);
    try {
      await addFollowUp(
        targetLead.id,
        { type: fuData.type, date: new Date(fuData.date).toISOString(), notes: fuData.notes.trim() },
        currentUser.name
      );
      patchLocal(targetLead.id, {
        followUpDate: new Date(fuData.date).toISOString(),
        lastContactedAt: new Date().toISOString(),
      });
      setFuOpen(false);
      toast.success('Follow-up scheduled');
    } catch {
      toast.error('Failed to add follow-up');
    } finally {
      setSaving(false);
    }
  };

  // ── Import CSV ────────────────────────────────────────────────────────────
  const handleImportCSV = async (file: File) => {
    setSaving(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        toast.error('CSV must have header row and at least one data row');
        setSaving(false);
        return;
      }

      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/[""]/g, ''));
      const dataRows = lines.slice(1);
      const importedLeads: Lead[] = [];
      let skippedDuplicates = 0;
      let skippedInvalid = 0;

      for (const row of dataRows) {
        const values = row.split(delimiter).map(v => v.trim().replace(/[""]/g, ''));
        if (values.every(v => !v)) continue;

        const data: Record<string, string> = {};
        headers.forEach((h, i) => { data[h] = values[i] ?? ''; });

        // Phone – strip prefix like "p:+91"
        let phone = (data['phone'] || data['phone_number'] || '').trim();
        if (phone.startsWith('p:')) phone = phone.substring(2);
        phone = phone.trim();

        const clientName = (data['full_name'] || data['name'] || data['client name'] || '').trim();

        if (!phone || !clientName) { skippedInvalid++; continue; }

        // Deduplication by Facebook lead id OR phone number
        const fbLeadId = data['id']?.trim() || undefined;
        const isDuplicate = await checkDuplicateLead(fbLeadId, phone);
        if (isDuplicate) { skippedDuplicates++; continue; }

        // Parse created_time from CSV (Facebook format: "2026-04-22 T 15:29:08+05:30" or ISO)
        let createdAt = new Date().toISOString();
        if (data['created_time'] && data['created_time'].trim()) {
          try {
            // Clean up Facebook date format but KEEP timezone offset
            let dateStr = data['created_time'].trim();
            // Handle formats like "2026-04-22 T 15:29:08+05:30" -> "2026-04-22T15:29:08+05:30"
            dateStr = dateStr.replace(/\s*T\s*/g, 'T'); // Remove spaces around T
            // Keep the timezone offset! JS can parse "2026-04-22T15:29:08+05:30" correctly

            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              createdAt = parsed.toISOString(); // Converts to UTC ISO string
              console.log('Parsed created_time:', data['created_time'], '->', createdAt);
            } else {
              console.warn('Failed to parse created_time:', data['created_time']);
            }
          } catch (e) {
            console.warn('Error parsing created_time:', data['created_time'], e);
          }
        } else {
          console.log('No created_time in CSV, using current time:', createdAt);
        }

        const newLead = await createLeadWithDate({
          clientName,
          phoneNumber: phone,
          email:         data['email']?.trim()    || undefined,
          project:       (data['form_name'] || data['project'] || PROJECTS[0]).trim(),
          leadSource:    data['platform']  || data['source'] || 'Meta Ads',
          // Full campaign tracking
          campaignName: data['campaign_name']?.trim()  || undefined,
          campaignId:   data['campaign_id']?.trim()    || undefined,
          adsetName:    data['adset_name']?.trim()     || undefined,
          adsetId:      data['adset_id']?.trim()       || undefined,
          adName:       data['ad_name']?.trim()        || undefined,
          adId:         data['ad_id']?.trim()          || undefined,
          formName:     data['form_name']?.trim()      || undefined,
          formId:       data['form_id']?.trim()        || undefined,
          isOrganic:    data['is_organic']?.toLowerCase() === 'true',
          // Lead qualification
          city:               data['city']?.trim()                                  || undefined,
          bestTimeToContact:  data['what_is_the_best_time_to_contact_you?']?.trim() || undefined,
          planningToBuy:      data['when_are_you_planning_to_buy?']?.trim()          || undefined,
          investmentBudget:  (data['your_investment_budget?'] || 'Not Specified') as InvestmentBudget,
          facebookLeadId:     fbLeadId,
          // Defaults
          assignedUserId: isAdmin ? '' : currentUser.id,
          leadLevel:      'Warm'  as LeadLevel,
          status:         'New'   as LeadStatus,
          followUpDate:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          createdAt,
        });
        importedLeads.push(newLead);
      }

      setLeads(prev => [...importedLeads, ...prev]);
      setImportOpen(false);

      const parts: string[] = [];
      if (importedLeads.length > 0) parts.push(`✅ ${importedLeads.length} leads imported`);
      if (skippedDuplicates > 0)    parts.push(`⚠️ ${skippedDuplicates} duplicates skipped`);
      if (skippedInvalid > 0)       parts.push(`❌ ${skippedInvalid} invalid rows skipped`);
      toast.success(parts.join(' · ') || 'No new leads found');
    } catch (err) {
      console.error('Import error:', err);
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Bulk Delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) {
      toast.error('Select leads to delete');
      return;
    }
    if (!confirm(`Delete ${selectedLeads.size} lead(s)? This cannot be undone.`)) return;

    setSaving(true);
    try {
      for (const leadId of selectedLeads) {
        await deleteLead(leadId);
      }
      setLeads(prev => prev.filter(l => !selectedLeads.has(l.id)));
      setSelectedLeads(new Set());
      toast.success(`${selectedLeads.size} lead(s) deleted`);
    } catch {
      toast.error('Failed to delete leads');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === sorted.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(sorted.map(l => l.id)));
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return leads.filter(lead => {
      const matchesSearch = !q
        || lead.clientName.toLowerCase().includes(q)
        || lead.phoneNumber.includes(q)
        || lead.project.toLowerCase().includes(q)
        || (lead.campaignName ?? '').toLowerCase().includes(q);
      const matchesStatus   = statusFilter   === 'All' || lead.status         === statusFilter;
      const matchesLevel    = levelFilter    === 'All' || lead.leadLevel       === levelFilter;
      const matchesAssignee = assigneeFilter === 'All' || lead.assignedUserId  === assigneeFilter;
      return matchesSearch && matchesStatus && matchesLevel && matchesAssignee;
    });
  }, [leads, searchTerm, statusFilter, levelFilter, assigneeFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      if      (sortField === 'leadLevel')      { aVal = LEVEL_ORDER[a.leadLevel]; bVal = LEVEL_ORDER[b.leadLevel]; }
      else if (sortField === 'status')         { aVal = a.status; bVal = b.status; }
      else if (sortField === 'assignedUserId') { aVal = getUserName(a.assignedUserId); bVal = getUserName(b.assignedUserId); }
      else                                     { aVal = a[sortField] ?? ''; bVal = b[sortField] ?? ''; }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const anyFilter = statusFilter !== 'All' || levelFilter !== 'All' || assigneeFilter !== 'All' || searchTerm;

  // ── Shared Lead form fields ──────────────────────────────────────────────
  const LeadFormFields = () => (
    <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="clientName" className="text-xs font-medium">Client Name *</Label>
          <Input id="clientName" value={formData.clientName} onChange={e => setFormData(f => ({ ...f, clientName: e.target.value }))} placeholder="John Doe" className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phoneNumber" className="text-xs font-medium">Phone Number *</Label>
          <Input id="phoneNumber" value={formData.phoneNumber} onChange={e => setFormData(f => ({ ...f, phoneNumber: e.target.value }))} placeholder="+91 98765-43210" className="h-9 text-sm" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs font-medium">Email</Label>
        <Input id="email" type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" className="h-9 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Project</Label>
          <Select value={formData.project} onValueChange={v => setFormData(f => ({ ...f, project: v }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{PROJECTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Lead Source</Label>
          <Select value={formData.leadSource} onValueChange={v => setFormData(f => ({ ...f, leadSource: v }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {/* Campaign Details Form Fields Hidden */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Level</Label>
          <Select value={formData.leadLevel} onValueChange={v => setFormData(f => ({ ...f, leadLevel: v as LeadLevel }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{LEAD_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Status</Label>
          <Select value={formData.status} onValueChange={v => setFormData(f => ({ ...f, status: v as LeadStatus }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Assign To</Label>
          <Select value={formData.assignedUserId || '__none__'} onValueChange={v => setFormData(f => ({ ...f, assignedUserId: v === '__none__' ? '' : v }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {telecallers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="followUpDate" className="text-xs font-medium">Follow Up</Label>
        <Input id="followUpDate" type="datetime-local" value={formData.followUpDate} onChange={e => setFormData(f => ({ ...f, followUpDate: e.target.value }))} className="h-9 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Investment Budget</Label>
        <Select value={formData.investmentBudget} onValueChange={v => setFormData(f => ({ ...f, investmentBudget: v as InvestmentBudget }))}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{INVESTMENT_BUDGETS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            View, filter, and manage all real estate leads.
            {isTelecaller && (
              <span className="ml-2 text-xs font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Showing your assigned leads only
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden h-9">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`flex items-center gap-1.5 px-3 text-xs font-medium transition-colors ${viewMode === 'pipeline' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <Kanban className="w-3.5 h-3.5" /> Pipeline
            </button>
          </div>

          <Button variant="outline" className="border-slate-200 h-9" onClick={loadLeads}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" className="border-slate-200 h-9" onClick={() => { exportLeadsCSV(sorted, getUserName); toast.success('CSV downloaded'); }}>
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" className="border-slate-200 h-9" onClick={() => setImportOpen(true)}>
            <FileUp className="w-4 h-4 mr-2" />
            Import
          </Button>
          {selectedLeads.size > 0 && (
            <Button variant="destructive" className="bg-red-500 hover:bg-red-600 text-white h-9" onClick={handleBulkDelete} disabled={saving}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedLeads.size}
            </Button>
          )}
          {isAdmin && (
            <Button className="bg-blue-500 text-white hover:bg-blue-600 h-9" onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
          )}
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Connection error</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── Pipeline view ──────────────────────────────────────────────────── */}
      {viewMode === 'pipeline' && (
        <PipelineView
          leads={filtered}
          onLeadsChange={(nextLeads) => {
            // Pipeline works on filtered rows; merge updates back into full state.
            const updatesById = new Map(nextLeads.map(lead => [lead.id, lead]));
            setLeads(prev => prev.map(lead => updatesById.get(lead.id) ?? lead));
          }}
        />
      )}

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      {viewMode === 'table' && <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            <div className="font-semibold text-slate-900">
              All Leads
              <span className="ml-2 text-xs font-normal text-slate-400">({sorted.length} results)</span>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search name, phone, project…"
                className="pl-9 bg-slate-50 border-slate-200 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-[160px] border-slate-200 bg-slate-50">
                <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
                <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-8 text-xs w-[130px] border-slate-200 bg-slate-50">
                <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Levels</SelectItem>
                {LEAD_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>

            {isAdmin && (
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-8 text-xs w-[150px] border-slate-200 bg-slate-50">
                  <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
                  <SelectValue placeholder="All Assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Assignees</SelectItem>
                  {telecallers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {anyFilter && (
              <Button
                variant="ghost" size="sm"
                className="h-8 text-xs text-slate-500 hover:text-slate-900 px-2"
                onClick={() => { setStatusFilter('All'); setLevelFilter('All'); setAssigneeFilter('All'); setSearchTerm(''); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="w-full text-[0.8125rem] min-w-[1200px]">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                <TableHead className="font-semibold text-slate-500 px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedLeads.size === sorted.length && sorted.length > 0}
                    onChange={toggleSelectAll}
                    className="cursor-pointer"
                  />
                </TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3 min-w-[150px]">Client Name</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3 min-w-[130px]">Phone</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3 min-w-[130px]">Project</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3 min-w-[170px]">Campaign</TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3 min-w-[140px]">Investment Budget</TableHead>
                {isAdmin && (
                  <TableHead
                    className="font-semibold text-slate-500 px-4 py-3 min-w-[150px] cursor-pointer hover:text-blue-600 select-none"
                    onClick={() => toggleSort('assignedUserId')}
                  >
                    <div className="flex items-center">Assigned To <SortIcon field="assignedUserId" /></div>
                  </TableHead>
                )}
                <TableHead
                  className="font-semibold text-slate-500 px-4 py-3 min-w-[95px] cursor-pointer hover:text-blue-600 select-none"
                  onClick={() => toggleSort('leadLevel')}
                >
                  <div className="flex items-center">Level <SortIcon field="leadLevel" /></div>
                </TableHead>
                <TableHead
                  className="font-semibold text-slate-500 px-4 py-3 min-w-[175px] cursor-pointer hover:text-blue-600 select-none"
                  onClick={() => toggleSort('status')}
                >
                  <div className="flex items-center">Status <SortIcon field="status" /></div>
                </TableHead>
                <TableHead
                  className="font-semibold text-slate-500 px-4 py-3 min-w-[145px] cursor-pointer hover:text-blue-600 select-none"
                  onClick={() => toggleSort('followUpDate')}
                >
                  <div className="flex items-center">Follow Up <SortIcon field="followUpDate" /></div>
                </TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3 min-w-[130px]">Last Contacted</TableHead>
                <TableHead
                  className="font-semibold text-slate-500 px-4 py-3 min-w-[110px] cursor-pointer hover:text-blue-600 select-none"
                  onClick={() => toggleSort('createdAt')}
                >
                  <div className="flex items-center">Created <SortIcon field="createdAt" /></div>
                </TableHead>
                <TableHead className="font-semibold text-slate-500 px-4 py-3 min-w-[90px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100">
                    {[...Array(isAdmin ? 11 : 10)].map((_, j) => (
                      <TableCell key={j} className="px-4 py-4">
                        <div className="h-4 bg-slate-100 animate-pulse rounded w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 11 : 10} className="h-32 text-center text-slate-400">
                    {error ? 'Failed to load leads.' : 'No leads match your filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map(lead => {
                  const followUp = getFollowUpPriority(lead.followUpDate);
                  return (
                    <TableRow key={lead.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <TableCell className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="font-semibold text-slate-900 leading-tight">{lead.clientName || '—'}</div>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <a href={`tel:${lead.phoneNumber}`} className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="text-xs">{lead.phoneNumber || '—'}</span>
                        </a>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <div className="font-medium text-slate-800 text-xs">{lead.project || '—'}</div>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <span className={`inline-block text-[0.65rem] font-semibold px-1.5 py-0.5 rounded border ${getSourceLabel(lead.leadSource)}`}>
                            {lead.leadSource || 'Unknown'}
                          </span>
                          {/* Campaign Details Table Fields Hidden */}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                          {lead.investmentBudget || 'Not Specified'}
                        </span>
                    </TableCell>

                      {isAdmin && (
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="flex w-full items-center gap-1 text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors border border-transparent hover:border-blue-200 justify-between outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                <span className="truncate">{getUserName(lead.assignedUserId)}</span>
                                <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-[165px]">
                                <DropdownMenuLabel className="text-xs text-slate-500">Assign to</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {telecallers.map(user => (
                                  <DropdownMenuItem
                                    key={user.id}
                                    className={`text-xs cursor-pointer ${lead.assignedUserId === user.id ? 'font-semibold text-blue-600 bg-blue-50' : ''}`}
                                    onClick={() => handleAssign(lead.id, user.id)}
                                  >
                                    {user.name}
                                    {lead.assignedUserId === user.id && <span className="ml-auto text-blue-500">✓</span>}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer text-slate-600"
                                  disabled={!lead.assignedUserId?.trim()}
                                  onClick={() => handleAssign(lead.id, '')}
                                >
                                  Unassign
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {lead.assignedUserId && !lead.lastStatusUpdate && lead.assignmentExpiresAt && (
                              <span className={`text-[0.65rem] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 w-fit ${isAssignmentExpired(lead) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                ⏱ {getTimeRemaining(lead)}
                              </span>
                            )}
                          </div>
                    </TableCell>
                      )}

                      <TableCell className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full cursor-pointer">
                            <Badge variant="secondary" className={`rounded-full text-[0.65rem] font-bold uppercase px-2 py-0.5 border hover:opacity-80 transition-opacity shadow-none pointer-events-none ${getLevelColors(lead.leadLevel)}`}>
                        {lead.leadLevel}
                      </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-[110px]">
                            <DropdownMenuLabel className="text-xs text-slate-500">Set level</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {LEAD_LEVELS.map(lvl => (
                              <DropdownMenuItem
                                key={lvl}
                                className={`text-xs cursor-pointer ${lead.leadLevel === lvl ? 'font-semibold' : ''}`}
                                onClick={() => handleLevelChange(lead.id, lvl)}
                              >
                                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${lvl === 'Hot' ? 'bg-red-500' : lvl === 'Warm' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                                {lvl}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>

                      <TableCell className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full cursor-pointer max-w-full">
                            <Badge variant="secondary" className={`rounded-full text-[0.65rem] font-semibold px-2 py-0.5 hover:opacity-80 border-none shadow-none whitespace-nowrap pointer-events-none ${getStatusColors(lead.status)}`}>
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
                                {lead.status === s && <span className="ml-auto text-blue-500">✓</span>}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                          <div className="text-[0.68rem] text-slate-400">
                            {(() => { try { return format(parseISO(lead.followUpDate), 'h:mm a'); } catch { return ''; } })()}
                          </div>
                        </button>
                    </TableCell>

                      <TableCell className="px-4 py-3">
                        {lead.lastContactedAt ? (
                          <div>
                            <div className="text-xs text-slate-700">{format(parseISO(lead.lastContactedAt), 'MMM d, yyyy')}</div>
                            <div className="text-[0.68rem] text-slate-400 mt-0.5">{formatDistanceToNow(parseISO(lead.lastContactedAt), { addSuffix: true })}</div>
                      </div>
                        ) : <span className="text-xs text-slate-400 italic">Never</span>}
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-800">{format(parseISO(lead.createdAt), 'MMM d, yyyy')}</div>
                          <div className="text-[0.68rem] text-slate-500">{format(parseISO(lead.createdAt), 'h:mm a')}</div>
                          <div className="text-[0.65rem] font-medium text-blue-600 mt-1">{formatDistanceToNow(parseISO(lead.createdAt), { addSuffix: true })}</div>
                      </div>
                    </TableCell>

                      <TableCell className="px-4 py-3 text-right">
                      <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Row actions"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent hover:bg-muted text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[175px]">
                            <DropdownMenuLabel className="text-xs text-slate-500">Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => navigate(`/leads/${lead.id}`)}>
                              <Eye className="w-3.5 h-3.5 mr-2 text-blue-500" />View Lead
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => openEditDialog(lead)}>
                              <Edit className="w-3.5 h-3.5 mr-2 text-slate-500" />Edit Lead
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => openEditDialog(lead)}>
                                <UserPlus className="w-3.5 h-3.5 mr-2 text-slate-500" />Assign Lead
                          </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => openFuDialog(lead)}>
                              <CalendarPlus className="w-3.5 h-3.5 mr-2 text-slate-500" />Add Follow-up
                          </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => openNoteDialog(lead)}>
                              <MessageSquarePlus className="w-3.5 h-3.5 mr-2 text-slate-500" />Add Note
                          </DropdownMenuItem>
                            {isAdmin && (
                              <>
                          <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="cursor-pointer text-xs text-red-600 focus:text-red-600 focus:bg-red-50"
                                  onClick={() => handleDelete(lead.id, lead.clientName)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />Delete Lead
                          </DropdownMenuItem>
                              </>
                            )}
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
        
        <div className="flex items-center justify-between text-xs text-slate-500 px-4 py-3 border-t border-slate-200">
          <div>
            Showing {sorted.length} of {leads.length} leads
            {isTelecaller && ' (your assigned leads)'}
          </div>
        </div>
      </div>}

      {/* ════════════════════════════════════════════════════════════════════════
       *  DIALOGS
       * ════════════════════════════════════════════════════════════════════════ */}

      {/* ── Add Lead Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>Fill in the details to create a new lead.</DialogDescription>
          </DialogHeader>
          <LeadFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleAddLead} disabled={saving}>
              {saving ? 'Creating…' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Lead Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update the lead information below.</DialogDescription>
          </DialogHeader>
          <LeadFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleEditLead} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Note Dialog ──────────────────────────────────────────────────── */}
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

      {/* ── Add Follow-up Dialog ─────────────────────────────────────────────── */}
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

      {/* ── Import CSV Dialog ────────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Leads from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with columns: Client Name, Phone, Email, Project, Lead Source, Campaign, Level, Status, Follow Up Date
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-900 mb-2">📋 Supported CSV Formats:</p>
              <p className="text-xs text-blue-800">
                <strong>Facebook Leads Format:</strong> full_name, phone_number, email, ad_name, adset_name, campaign_name, platform<br/>
                <strong>Custom Format:</strong> Client Name, Phone, Email, Project, Lead Source, Campaign, Level, Status<br/>
                <strong>Note:</strong> Supports both comma and tab-delimited files
              </p>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) handleImportCSV(file);
                }}
                className="cursor-pointer"
                disabled={saving}
              />
        </div>
      </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
