import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { 
  ArrowLeft, Phone, Mail, CalendarDays, Clock, MessageSquare,
  CheckCircle2, Flame, RefreshCw, Edit, Save, X, Plus, Trash2, Check, Users, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lead, LeadStatus, LeadLevel } from '@/types';
import {
  fetchLead, updateLead, getNotes, addNote, getFollowUps, addFollowUp, deleteFollowUp, completeFollowUp, getAssignmentHistory,
} from '@/src/services/leadsService';
import type { DemoNote, DemoFollowUp, AssignmentHistory } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';

const LEAD_STATUSES: LeadStatus[] = [
  'New', 'Contacted', 'Interested', 'Site Visit Scheduled', 'Visit Completed',
  'Negotiation', 'Booked', 'Not Interested', 'Wrong Number', 'Low Budget',
];
const LEAD_LEVELS: LeadLevel[] = ['Hot', 'Warm', 'Cold'];

const getLevelIcon = (level: LeadLevel) => {
  switch (level) {
    case 'Hot':  return 'text-red-500';
    case 'Warm': return 'text-amber-500';
    case 'Cold': return 'text-blue-400';
  }
};

const getStatusBadgeColor = (status: LeadStatus) => {
  switch (status) {
    case 'Negotiation': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Booked':      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'New':         return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Contacted':   return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'Interested':  return 'bg-purple-100 text-purple-800 border-purple-200';
    default:            return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function LeadDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, allUsers, telecallers } = useRole();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<DemoNote[]>([]);
  const [followUps, setFollowUps] = useState<DemoFollowUp[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ status: '' as LeadStatus, leadLevel: '' as LeadLevel });
  const [savingEdit, setSavingEdit] = useState(false);

  const [fuForm, setFuForm] = useState({ type: 'Call', date: '', notes: '' });
  const [showFuForm, setShowFuForm] = useState(false);
  const [savingFu, setSavingFu] = useState(false);

  const getUserName = (userId: string) => {
    if (!userId?.trim()) return 'Unassigned';
    return allUsers.find(u => u.id === userId)?.name ?? telecallers.find(u => u.id === userId)?.name ?? userId;
  };

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [leadData, notesData, fuData, historyData] = await Promise.all([
        fetchLead(id),
        getNotes(id),
        getFollowUps(id),
        getAssignmentHistory(id),
      ]);
      if (!leadData) { toast.error('Lead not found'); navigate('/leads'); return; }
      setLead(leadData);
      setEditData({ status: leadData.status, leadLevel: leadData.leadLevel });
      setNotes(notesData);
      setFollowUps(fuData);
      setAssignmentHistory(historyData);
    } catch {
      toast.error('Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddNote = async () => {
    if (!id || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const n = await addNote(id, noteText.trim(), currentUser.name);
      setNotes(prev => [n, ...prev]);
      setNoteText('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id || !lead) return;
    setSavingEdit(true);
    try {
      const updated = await updateLead(id, { status: editData.status, leadLevel: editData.leadLevel });
      setLead(updated);
      setEditing(false);
      toast.success('Lead updated');
    } catch {
      toast.error('Failed to update');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!id || !fuForm.date) { toast.error('Select a date'); return; }
    setSavingFu(true);
    try {
      const fu = await addFollowUp(id, {
        type: fuForm.type,
        date: new Date(fuForm.date).toISOString(),
        notes: fuForm.notes.trim(),
      }, currentUser.name);
      setFollowUps(prev => [...prev, fu]);
      setShowFuForm(false);
      setFuForm({ type: 'Call', date: '', notes: '' });
      if (lead) setLead({ ...lead, followUpDate: fu.date });
      toast.success('Follow-up scheduled');
    } catch {
      toast.error('Failed to schedule');
    } finally {
      setSavingFu(false);
    }
  };

  const handleDeleteFollowUp = async (followUpId: string) => {
    try {
      await deleteFollowUp(followUpId);
      setFollowUps(prev => prev.filter(fu => fu.id !== followUpId));
      toast.success('Follow-up deleted');
    } catch {
      toast.error('Failed to delete follow-up');
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    if (!id) return;
    try {
      await completeFollowUp(followUpId, id);
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

  const isAdmin = currentUser.role === 'Admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mr-2" />
        <span className="text-sm text-slate-500">Loading lead…</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Lead not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/leads')}>Back to Leads</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/leads')} className="border-slate-200">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{lead.clientName}</h1>
            <div className="flex items-center gap-2 mt-1">
              {editing ? (
                <>
                  <Select value={editData.status} onValueChange={v => setEditData(d => ({ ...d, status: v as LeadStatus }))}>
                    <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={editData.leadLevel} onValueChange={v => setEditData(d => ({ ...d, leadLevel: v as LeadLevel }))}>
                    <SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{LEAD_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" className="h-7 bg-blue-500 text-white hover:bg-blue-600 text-xs" onClick={handleSaveEdit} disabled={savingEdit}>
                    <Save className="w-3 h-3 mr-1" />{savingEdit ? '…' : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </>
              ) : (
                <>
              <Badge variant="outline" className={`rounded-full text-[0.7rem] font-semibold px-2 ${getStatusBadgeColor(lead.status)}`}>
                {lead.status}
              </Badge>
              <span className="text-sm text-slate-500 flex items-center gap-1 font-medium">
                    <Flame className={`w-3.5 h-3.5 ${getLevelIcon(lead.leadLevel)}`} />
                {lead.leadLevel} Lead
              </span>
                </>
              )}
            </div>
          </div>
          {!editing && (
          <div className="flex gap-2">
              <Button variant="outline" className="border-slate-200" onClick={() => { setShowFuForm(true); }}>
                <CalendarDays className="w-4 h-4 mr-2" /> Schedule Follow-up
              </Button>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={() => setEditing(true)}>
                <Edit className="w-4 h-4 mr-2" /> Edit Lead
              </Button>
          </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Left: Contact + Details ─────────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="uppercase text-xs font-semibold text-slate-500 mb-0 pb-2 tracking-wider border-b border-slate-100">
              Contact Information
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50 shrink-0">
                  <Phone className="w-4 h-4 text-slate-500" />
                </div>
                <div className="overflow-hidden">
                  <a href={`tel:${lead.phoneNumber}`} className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600 block">
                    {lead.phoneNumber}
                  </a>
                  <p className="text-xs text-slate-500">Mobile</p>
                </div>
              </div>
              {lead.email && (
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50 shrink-0">
                  <Mail className="w-4 h-4 text-slate-500" />
                </div>
                <div className="overflow-hidden">
                    <a href={`mailto:${lead.email}`} className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600 block">
                      {lead.email}
                    </a>
                    <p className="text-xs text-slate-500">Email</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="uppercase text-xs font-semibold text-slate-500 mb-0 pb-2 tracking-wider border-b border-slate-100">
              Lead Details
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <p className="text-xs text-slate-500">Project / Form</p>
                <p className="text-sm font-semibold text-slate-900">{lead.project}</p>
              </div>
              <Separator className="bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500">Source</p>
                <p className="text-sm font-semibold text-slate-900">{lead.leadSource}</p>
                {lead.campaignName && <p className="text-xs text-slate-500 mt-0.5">{lead.campaignName}</p>}
              </div>
              {(lead.city) && (
                <>
                  <Separator className="bg-slate-200" />
                  <div>
                    <p className="text-xs text-slate-500">City</p>
                    <p className="text-sm font-semibold text-slate-900">{lead.city}</p>
                  </div>
                </>
              )}
              {lead.investmentBudget && lead.investmentBudget !== 'Not Specified' && (
                <>
                  <Separator className="bg-slate-200" />
                  <div>
                    <p className="text-xs text-slate-500">Investment Budget</p>
                    <p className="text-sm font-semibold text-emerald-700">{lead.investmentBudget}</p>
                  </div>
                </>
              )}
              {lead.bestTimeToContact && (
                <>
                  <Separator className="bg-slate-200" />
                  <div>
                    <p className="text-xs text-slate-500">Best Time to Contact</p>
                    <p className="text-sm font-semibold text-slate-900">{lead.bestTimeToContact}</p>
                  </div>
                </>
              )}
              {lead.planningToBuy && (
                <>
                  <Separator className="bg-slate-200" />
                  <div>
                    <p className="text-xs text-slate-500">Planning to Buy</p>
                    <p className="text-sm font-semibold text-slate-900">{lead.planningToBuy}</p>
                  </div>
                </>
              )}
              <Separator className="bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500">Assigned To</p>
                <p className="text-sm font-semibold text-slate-900">{getUserName(lead.assignedUserId)}</p>
              </div>
              <Separator className="bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500">Follow Up</p>
                <p className="text-sm font-semibold text-slate-900">
                  {(() => { try { return format(parseISO(lead.followUpDate), 'MMM d, yyyy h:mm a'); } catch { return '—'; } })()}
                </p>
              </div>
              <Separator className="bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500">Created</p>
                <p className="text-sm font-semibold text-slate-900">
                  {format(parseISO(lead.createdAt), 'MMM d, yyyy h:mm a')}
                </p>
                <p className="text-xs text-slate-400">{formatDistanceToNow(parseISO(lead.createdAt), { addSuffix: true })}</p>
              </div>
            </CardContent>
          </Card>

          {/* Campaign Details Card Hidden */}
        </div>

        {/* ── Right: Tabs ─────────────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <Card className="h-full bg-white border-slate-200 shadow-sm rounded-xl">
            <Tabs defaultValue="activity" className="h-full flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100">
                <TabsList className="bg-slate-100/50">
                  <TabsTrigger value="activity">Notes & Activity</TabsTrigger>
                  <TabsTrigger value="followups">Follow-ups ({followUps.length})</TabsTrigger>
                  <TabsTrigger value="history">Assignment History ({assignmentHistory.length})</TabsTrigger>
                </TabsList>
              </div>
              
              {/* ── Notes tab ──────────────────────────────────────────────── */}
              <TabsContent value="activity" className="flex-1 p-0 m-0">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Add a Note</h3>
                  <div className="space-y-3">
                    <Textarea 
                      placeholder="Type your notes here..." 
                      className="min-h-[100px] bg-white resize-none border-slate-200 focus-visible:ring-blue-500"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAddNote(); }}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-500">Press Cmd+Enter to save</p>
                      <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleAddNote} disabled={savingNote || !noteText.trim()}>
                        {savingNote ? 'Saving…' : 'Add Note'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {notes.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-8">No notes yet. Add your first note above.</p>
                  ) : (
                    <div className="space-y-4">
                      {notes.map(n => (
                        <div key={n.id} className="bg-white border border-slate-100 rounded-lg p-4 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                              <span className="font-semibold text-sm text-slate-900">Note</span>
                              <span className="text-xs text-slate-500">by {n.createdBy}</span>
                            </div>
                            <span className="text-xs text-slate-400">
                              {format(parseISO(n.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{n.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Follow-ups tab ────────────────────────────────────────── */}
              <TabsContent value="followups" className="p-6 m-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-900">Scheduled Follow-ups</h3>
                  <Button size="sm" variant="outline" className="border-slate-200" onClick={() => setShowFuForm(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>

                {showFuForm && (
                  <div className="border border-blue-200 rounded-lg p-4 mb-4 bg-blue-50/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Type</Label>
                        <Select value={fuForm.type} onValueChange={v => setFuForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Call', 'Meeting', 'Site Visit', 'Email', 'WhatsApp', 'Closure'].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Date & Time</Label>
                        <Input
                          type="datetime-local"
                          value={fuForm.date}
                          onChange={e => setFuForm(f => ({ ...f, date: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Notes</Label>
                      <Input
                        placeholder="Brief description"
                        value={fuForm.notes}
                        onChange={e => setFuForm(f => ({ ...f, notes: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowFuForm(false)}>Cancel</Button>
                      <Button size="sm" className="h-7 text-xs bg-blue-500 text-white hover:bg-blue-600" onClick={handleAddFollowUp} disabled={savingFu || !fuForm.date}>
                        {savingFu ? '…' : 'Schedule'}
                      </Button>
                    </div>
                  </div>
                )}

                {followUps.length === 0 && !showFuForm ? (
                  <p className="text-center text-sm text-slate-400 py-8">No follow-ups scheduled.</p>
                ) : (
                  <div className="space-y-3">
                    {followUps.map(fu => (
                      <div key={fu.id} className={`border rounded-lg p-4 flex gap-4 items-start ${fu.completed ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/50 border-amber-200'}`}>
                        <CalendarDays className={`w-5 h-5 mt-1 ${fu.completed ? 'text-slate-400' : 'text-amber-500'}`} />
                        <div className="flex-1">
                          <h4 className={`font-semibold text-sm ${fu.completed ? 'text-slate-600 line-through' : 'text-amber-900'}`}>
                            {fu.type}
                          </h4>
                          {fu.notes && <p className="text-sm text-amber-800 mt-1">{fu.notes}</p>}
                          <div className="flex items-center gap-4 mt-2 text-sm text-amber-700">
                            <span className="flex items-center gap-1 font-medium text-xs">
                              <Clock className="w-3.5 h-3.5" />
                              {format(parseISO(fu.date), 'MMM d, yyyy h:mm a')}
                            </span>
                            <span className="text-xs text-slate-500">by {fu.createdBy}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!fu.completed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 font-medium"
                              onClick={() => handleCompleteFollowUp(fu.id)}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Done
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteFollowUp(fu.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Assignment History tab ────────────────────────────────── */}
              <TabsContent value="history" className="p-6 m-0">
                <h3 className="font-semibold text-slate-900 mb-4">Assignment History</h3>
                {assignmentHistory.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">No assignment history yet.</p>
                ) : (
                  <div className="space-y-3">
                    {assignmentHistory.map((record, idx) => (
                      <div key={record.id} className="relative border border-slate-200 rounded-lg p-4 bg-white">
                        {idx < assignmentHistory.length - 1 && (
                          <div className="absolute left-8 top-full h-3 w-0.5 bg-slate-200"></div>
                        )}
                        <div className="flex gap-3 items-start">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-blue-600" />
                              </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-slate-700">
                                {record.fromUserId ? getUserName(record.fromUserId) : 'Unassigned'}
                              </span>
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-semibold text-blue-600">
                                {getUserName(record.toUserId)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Assigned by <span className="font-medium">{getUserName(record.assignedBy)}</span>
                              {record.reason && ` • ${record.reason}`}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {format(parseISO(record.createdAt), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
