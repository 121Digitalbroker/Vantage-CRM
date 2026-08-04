import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Megaphone,
  ArrowUpRight,
  TrendingUp,
  Plus,
  ExternalLink,
  RefreshCw,
  Users,
  Trash2,
  Layers,
  Building2,
  CalendarRange,
  Check,
  X,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchLeads, useDemoLeads } from '@/src/services/leadsService';
import { supabase } from '@/lib/supabaseClient';
import { useRole } from '@/src/contexts/RoleContext';
import type { Lead } from '@/types';
import {
  formatGlobalDateRange,
  leadInGlobalRange,
  useGlobalDateRange,
} from '@/src/services/globalDateRange';
import {
  CAMPAIGN_GROUPS_KEY,
  type CampaignGroup,
  campaignLabel,
  claimedMemberLabels,
  fetchCampaignGroups,
  groupNameForLabel,
  persistCampaignGroups,
} from '@/src/services/campaignGroups';

interface ManualCampaign {
  id: string;
  name: string;
  platform: string;
  spend: number;
}

/** Whether a lead should count toward a manually named campaign in Settings. */
function matchesManualCampaign(manualName: string, lead: Lead): boolean {
  const mn = manualName.trim().toLowerCase();
  if (!mn) return false;
  const c = (lead.campaignName || '').trim().toLowerCase();
  const s = (lead.leadSource || '').trim().toLowerCase();
  if (c === mn || s === mn) return true;
  if (c && (c.includes(mn) || mn.includes(c))) return true;
  if (s && (s.includes(mn) || mn.includes(s))) return true;
  return false;
}

const ALL_PROJECTS = '__all_projects__';
const ALL_CAMPAIGNS = '__all_campaigns__';

function inferPlatform(label: string): string {
  const t = label.toLowerCase();
  if (t.includes('facebook') || t.includes('meta') || t === 'fb' || t.includes('instagram') || t === 'ig')
    return 'Meta / Facebook';
  if (t.includes('google')) return 'Google';
  if (t.includes('linkedin')) return 'LinkedIn';
  if (t.includes('email') || t.includes('newsletter')) return 'Email';
  return 'Other';
}

export default function CampaignSources() {
  const navigate = useNavigate();
  const demoLeads = useDemoLeads();
  const { isAdmin } = useRole();

  const [manualCampaigns, setManualCampaigns] = useState<ManualCampaign[]>([]);
  const [campaignGroups, setCampaignGroups] = useState<CampaignGroup[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [projectScope, setProjectScope] = useState(ALL_PROJECTS);
  const [campaignScope, setCampaignScope] = useState(ALL_CAMPAIGNS);

  // Shared with Leads and stored in Supabase — every user sees the same range.
  const {
    range: dateRange,
    setRange: setDateRangeShared,
    loading: dateRangeLoading,
  } = useGlobalDateRange();
  const { from: dateFrom, to: dateTo } = dateRange;
  const [savingRange, setSavingRange] = useState(false);

  const setDateRange = useCallback(
    async (next: { from: string; to: string }) => {
      setSavingRange(true);
      const ok = await setDateRangeShared(next);
      setSavingRange(false);
      if (ok) {
        const cleared = !next.from && !next.to;
        toast.success(cleared ? 'Date range cleared for everyone' : 'Date range applied for everyone');
      } else {
        toast.error('Could not share the date range — run supabase-crm-app-settings.sql');
      }
    },
    [setDateRangeShared]
  );
  /** Typed but not yet applied — nothing filters until Apply is pressed. */
  const [draftFrom, setDraftFrom] = useState(dateRange.from);
  const [draftTo, setDraftTo] = useState(dateRange.to);

  useEffect(() => {
    setDraftFrom(dateRange.from);
    setDraftTo(dateRange.to);
  }, [dateRange.from, dateRange.to]);

  const draftDiffers = draftFrom !== dateFrom || draftTo !== dateTo;
  const draftInvalid = !!draftFrom && !!draftTo && draftFrom > draftTo;

  const [projectGroupName, setProjectGroupName] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState('');

  const loadCampaignsFromStorage = useCallback(() => {
    const saved = localStorage.getItem('crm_campaigns');
    if (saved) {
      try {
        const parsed: ManualCampaign[] = JSON.parse(saved);
        setManualCampaigns(parsed);
      } catch {
        setManualCampaigns([]);
      }
    } else {
      setManualCampaigns([]);
    }
  }, []);

  const refreshCampaignGroups = useCallback(async () => {
    try {
      const groups = await fetchCampaignGroups();
      setCampaignGroups(groups);
    } catch {
      setCampaignGroups([]);
    }
  }, []);

  const loadLeads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchLeads();
      setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCampaignsFromStorage();
    void refreshCampaignGroups();
    void loadLeads(false);
  }, [loadLeads, loadCampaignsFromStorage, refreshCampaignGroups]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'crm_campaigns' || e.key === null) loadCampaignsFromStorage();
      if (e.key === CAMPAIGN_GROUPS_KEY || e.key === null) void refreshCampaignGroups();
    };
    const onFocus = () => void refreshCampaignGroups();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadCampaignsFromStorage, refreshCampaignGroups]);

  useEffect(() => {
    if (demoLeads) return;

    const channel = supabase
      .channel('campaign-sources-leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          void loadLeads(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demoLeads, loadLeads]);

  const projectOptions = useMemo(() => {
    const names = new Set<string>();
    for (const lead of leads) {
      const name = (lead.project || '').trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [leads]);

  /** Project + date range. Leads outside the range are dropped entirely. */
  const baseLeads = useMemo(() => {
    return leads.filter(lead => {
      if (projectScope !== ALL_PROJECTS && (lead.project || '').trim() !== projectScope) {
        return false;
      }
      return leadInGlobalRange(lead, dateRange);
    });
  }, [leads, projectScope, dateRange]);

  /** Campaign names available for the chosen project and dates, grouped names rolled up. */
  const campaignScopeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const lead of baseLeads) {
      const raw = campaignLabel(lead);
      if (!raw || raw === 'Not specified') continue;
      names.add(groupNameForLabel(raw, campaignGroups) ?? raw);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [baseLeads, campaignGroups]);

  useEffect(() => {
    if (campaignScope !== ALL_CAMPAIGNS && !campaignScopeOptions.includes(campaignScope)) {
      setCampaignScope(ALL_CAMPAIGNS);
    }
  }, [campaignScopeOptions, campaignScope]);

  /** KPIs and the performance table read from this — project, dates and campaign applied. */
  const scopedLeads = useMemo(() => {
    if (campaignScope === ALL_CAMPAIGNS) return baseLeads;
    return baseLeads.filter(lead => {
      const raw = campaignLabel(lead);
      return (groupNameForLabel(raw, campaignGroups) ?? raw) === campaignScope;
    });
  }, [baseLeads, campaignScope, campaignGroups]);

  const dateRangeLabel = useMemo(() => formatGlobalDateRange(dateRange), [dateRange]);

  const applyDraftRange = () => {
    if (draftInvalid) return;
    void setDateRange({ from: draftFrom, to: draftTo });
  };

  const applyLastDays = (days: number) => {
    const today = new Date();
    void setDateRange({
      from: format(subDays(today, days - 1), 'yyyy-MM-dd'),
      to: format(today, 'yyyy-MM-dd'),
    });
  };

  const clearFilters = () => {
    setProjectScope(ALL_PROJECTS);
    setCampaignScope(ALL_CAMPAIGNS);
    void setDateRange({ from: '', to: '' });
  };

  const hasFilters =
    projectScope !== ALL_PROJECTS || campaignScope !== ALL_CAMPAIGNS || !!dateFrom || !!dateTo;

  const scopeSummary = useMemo(() => {
    const parts: string[] = [];
    if (projectScope !== ALL_PROJECTS) parts.push(projectScope);
    if (campaignScope !== ALL_CAMPAIGNS) parts.push(campaignScope);
    if (dateRangeLabel) parts.push(dateRangeLabel);
    return parts.join(' · ');
  }, [projectScope, campaignScope, dateRangeLabel]);

  useEffect(() => {
    if (projectScope !== ALL_PROJECTS && !projectOptions.includes(projectScope)) {
      setProjectScope(ALL_PROJECTS);
    }
  }, [projectOptions, projectScope]);

  /** Campaign names only — projects are grouped in their own section below. */
  const campaignChoices = useMemo(() => {
    const campaigns = new Set<string>();
    for (const lead of baseLeads) {
      const label = (lead.campaignName || '').trim() || (lead.leadSource || '').trim();
      if (label) campaigns.add(label);
    }
    return [...campaigns].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [baseLeads]);

  /** Project names, always from every lead — a project group spans projects by nature. */
  const projectChoices = useMemo(() => {
    const projects = new Set<string>();
    for (const lead of leads) {
      const project = (lead.project || '').trim();
      if (project) projects.add(project);
    }
    return [...projects].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [leads]);

  const claimed = useMemo(() => claimedMemberLabels(campaignGroups), [campaignGroups]);

  const selectableLabels = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return campaignChoices.filter(label => {
      if (claimed.has(label.trim().toLowerCase())) return false;
      if (!q) return true;
      return label.toLowerCase().includes(q);
    });
  }, [campaignChoices, claimed, memberSearch]);

  const selectableProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return projectChoices.filter(label => {
      if (claimed.has(label.trim().toLowerCase())) return false;
      if (!q) return true;
      return label.toLowerCase().includes(q);
    });
  }, [projectChoices, claimed, projectSearch]);

  /** Picks made under one project scope shouldn't linger once that scope changes. */
  useEffect(() => {
    const visible = new Set(campaignChoices);
    setSelectedMembers(prev => {
      const next = prev.filter(m => visible.has(m));
      if (next.length === prev.length) return prev;
      return next;
    });
  }, [campaignChoices]);

  const toggleMember = (label: string) => {
    setSelectedMembers(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  const toggleProject = (label: string) => {
    setSelectedProjects(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  /** Campaign and project groups share one store — only the picker differs. */
  const saveGroup = async (
    rawName: string,
    members: string[],
    kindLabel: 'campaigns' | 'projects',
    onDone: () => void
  ) => {
    const name = rawName.trim();
    if (!name) {
      toast.error('Enter a group name (e.g. previous campaign name)');
      return;
    }
    if (members.length < 2) {
      toast.error(`Select at least 2 ${kindLabel} to group`);
      return;
    }
    const nameTaken = campaignGroups.some(g => g.name.trim().toLowerCase() === name.toLowerCase());
    if (nameTaken) {
      toast.error('A group with this name already exists');
      return;
    }
    const next: CampaignGroup[] = [
      ...campaignGroups,
      { id: `grp-${Date.now()}`, name, members: [...members] },
    ];
    try {
      await persistCampaignGroups(next);
      setCampaignGroups(next);
      onDone();
      toast.success(`Grouped ${members.length} ${kindLabel} as “${name}” — visible to all users`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save group');
    }
  };

  const createGroup = () =>
    saveGroup(groupName, selectedMembers, 'campaigns', () => {
      setGroupName('');
      setSelectedMembers([]);
      setMemberSearch('');
    });

  const createProjectGroup = () =>
    saveGroup(projectGroupName, selectedProjects, 'projects', () => {
      setProjectGroupName('');
      setSelectedProjects([]);
      setProjectSearch('');
    });

  const deleteGroup = async (id: string) => {
    const next = campaignGroups.filter(g => g.id !== id);
    try {
      await persistCampaignGroups(next);
      setCampaignGroups(next);
      toast.success('Campaign group removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove campaign group');
    }
  };

  const totalSpend = useMemo(
    () => manualCampaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0),
    [manualCampaigns]
  );

  const totalLeads = scopedLeads.length;

  const avgCpl =
    totalLeads > 0 && totalSpend > 0 ? Math.round(totalSpend / totalLeads) : 0;

  type TableRow = {
    key: string;
    name: string;
    platform: string;
    spend: number;
    leadCount: number;
    cpl: number;
    fromSettings: boolean;
    isGroup?: boolean;
    memberCount?: number;
  };

  const tableRows = useMemo((): TableRow[] => {
    const matchedManualId = new Map<string, string>();
    for (const lead of scopedLeads) {
      let id: string | null = null;
      for (const mc of manualCampaigns) {
        if (matchesManualCampaign(mc.name, lead)) {
          id = mc.id;
          break;
        }
      }
      matchedManualId.set(lead.id, id ?? '');
    }

    const unmatchedByLabel = new Map<string, number>();
    for (const lead of scopedLeads) {
      const mid = matchedManualId.get(lead.id);
      if (mid) continue;
      const raw = campaignLabel(lead);
      const grouped = groupNameForLabel(raw, campaignGroups);
      const label = grouped ?? raw;
      unmatchedByLabel.set(label, (unmatchedByLabel.get(label) ?? 0) + 1);
    }

    const groupByName = new Map(campaignGroups.map(g => [g.name, g]));

    const rows: TableRow[] = [];

    for (const mc of manualCampaigns) {
      const leadCount = scopedLeads.filter(l => matchedManualId.get(l.id) === mc.id).length;
      // Inside a narrowed view, a Settings campaign with no leads is just noise.
      if (leadCount === 0 && hasFilters) continue;
      const spend = Number(mc.spend) || 0;
      rows.push({
        key: `manual-${mc.id}`,
        name: mc.name,
        platform: mc.platform || '—',
        spend,
        leadCount,
        cpl: leadCount > 0 && spend > 0 ? Math.round(spend / leadCount) : 0,
        fromSettings: true,
      });
    }

    const manualNamesLower = new Set(manualCampaigns.map(m => m.name.trim().toLowerCase()));
    for (const [label, count] of unmatchedByLabel) {
      if (count === 0) continue;
      const ll = label.trim().toLowerCase();
      if (manualNamesLower.has(ll)) continue;
      const group = groupByName.get(label);
      rows.push({
        key: `lead-${label}`,
        name: label,
        platform: inferPlatform(label),
        spend: 0,
        leadCount: count,
        cpl: 0,
        fromSettings: false,
        isGroup: !!group,
        memberCount: group?.members.length,
      });
    }

    rows.sort((a, b) => {
      if (a.fromSettings !== b.fromSettings) return a.fromSettings ? -1 : 1;
      return b.leadCount - a.leadCount;
    });

    return rows;
  }, [scopedLeads, manualCampaigns, campaignGroups, hasFilters]);

  const formatMoney = (n: number) =>
    `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campaign Sources</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ad spend from Settings, lead counts synced from your CRM in real time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={loading || refreshing}
            onClick={() => {
              loadCampaignsFromStorage();
              void refreshCampaignGroups();
              void loadLeads(true);
            }}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Sync now
          </Button>
          <Button onClick={() => navigate('/settings')} className="bg-blue-500 text-white hover:bg-blue-600 h-9">
            <Plus className="w-4 h-4 mr-2" />
            Manage Campaigns
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-medium">Project</Label>
            <Select value={projectScope} onValueChange={setProjectScope}>
              <SelectTrigger className="h-9 w-[200px] border-blue-200 bg-blue-50/60 text-sm">
                <Building2 className="w-3.5 h-3.5 mr-1.5 shrink-0 text-blue-500" />
                <SelectValue>
                  {(value: string) => (value === ALL_PROJECTS ? 'All projects' : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                {projectOptions.map(p => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-medium">Campaign</Label>
            <Select value={campaignScope} onValueChange={setCampaignScope}>
              <SelectTrigger className="h-9 w-[220px] border-emerald-200 bg-emerald-50/60 text-sm">
                <Megaphone className="w-3.5 h-3.5 mr-1.5 shrink-0 text-emerald-600" />
                <SelectValue>
                  {(value: string) => (value === ALL_CAMPAIGNS ? 'All campaigns' : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CAMPAIGNS}>All campaigns</SelectItem>
                {campaignScopeOptions.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cs_date_from" className="text-xs text-slate-500 font-medium">
              Leads from
            </Label>
            <Input
              id="cs_date_from"
              type="date"
              value={draftFrom}
              onChange={e => setDraftFrom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyDraftRange()}
              className="h-9 w-[160px] border-slate-200 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cs_date_to" className="text-xs text-slate-500 font-medium">
              To
            </Label>
            <Input
              id="cs_date_to"
              type="date"
              value={draftTo}
              onChange={e => setDraftTo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyDraftRange()}
              className="h-9 w-[160px] border-slate-200 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              className="h-9 text-xs bg-blue-500 hover:bg-blue-600 text-white"
              onClick={applyDraftRange}
              disabled={!draftDiffers || draftInvalid || savingRange || dateRangeLoading}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {savingRange ? 'Applying…' : 'Apply'}
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => applyLastDays(7)}>
              Last 7 days
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => applyLastDays(30)}>
              Last 30 days
            </Button>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-slate-500 hover:text-slate-700"
                onClick={clearFilters}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <p className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
            {dateRangeLabel || 'All time'}
            <span className="text-slate-300">·</span>
            {loading ? '…' : `${scopedLeads.length.toLocaleString('en-IN')} of ${leads.length.toLocaleString('en-IN')} leads`}
          </p>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {draftInvalid
            ? 'The “from” date is after the “to” date.'
            : draftDiffers
              ? 'Press Apply to use these dates.'
              : 'The date range is shared with every user and applies on the Leads page too.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Ad Spend</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(totalSpend)}</p>
                <p className="text-xs text-slate-400 mt-1">From Settings campaigns</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Leads</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {loading ? '…' : totalLeads.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {scopeSummary || 'Synced from Leads'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">Avg. Cost Per Lead</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {loading ? '…' : totalLeads === 0 ? formatMoney(0) : formatMoney(avgCpl)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {hasFilters ? 'Spend ÷ leads in view' : 'Spend ÷ all leads'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              Group Campaigns
            </CardTitle>
            <CardDescription>
              Admin only — combine several Meta/CSV campaign names under one previous-campaign name
              (e.g. “Gaur Chrysalis_26 July…” + “Gaur Chrysalis_27 July…” → “Gaur Chrysalis”).
              Project names are grouped separately below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-1">
                  <Label htmlFor="group_name" className="text-xs text-slate-700 font-medium">
                    Group name (previous campaign)
                  </Label>
                  <Input
                    id="group_name"
                    placeholder="e.g. Gaur Chrysalis"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    className="bg-white border-slate-200 focus-visible:ring-blue-500 text-sm"
                  />
                </div>
                <Button
                  onClick={createGroup}
                  className="bg-blue-500 hover:bg-blue-600 text-white h-9"
                  disabled={selectedMembers.length < 2 || !groupName.trim()}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create group ({selectedMembers.length})
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-xs text-slate-700 font-medium">
                    Select campaigns to include (min 2)
                    {scopeSummary && (
                      <span className="ml-1 font-normal text-blue-600">in {scopeSummary}</span>
                    )}
                  </Label>
                  <Input
                    placeholder="Search campaigns…"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="bg-white border-slate-200 h-8 text-sm sm:max-w-[220px]"
                  />
                </div>
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMembers.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMember(m)}
                        className="text-[0.7rem] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200"
                        title="Remove"
                      >
                        {m} ×
                      </button>
                    ))}
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
                  {selectableLabels.length === 0 ? (
                    <p className="text-sm text-slate-500 p-3 text-center">
                      {campaignChoices.length === 0
                        ? scopeSummary
                          ? `No campaigns on leads in ${scopeSummary}.`
                          : 'No campaign names on leads yet.'
                        : 'No ungrouped campaigns match your search.'}
                    </p>
                  ) : (
                    selectableLabels.map(label => {
                      const checked = selectedMembers.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleMember(label)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${
                            checked ? 'bg-blue-50/80' : ''
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[0.65rem] ${
                              checked
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-slate-300 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="truncate text-slate-800" title={label}>
                            {label}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              Group Projects
            </CardTitle>
            <CardDescription>
              Separate from campaigns — combine several project names under one previous-project name
              (e.g. “Arihant Pre Launch Final” + “arihant yxp” → “Arihant”).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-1">
                  <Label htmlFor="project_group_name" className="text-xs text-slate-700 font-medium">
                    Group name (previous project)
                  </Label>
                  <Input
                    id="project_group_name"
                    placeholder="e.g. Arihant"
                    value={projectGroupName}
                    onChange={e => setProjectGroupName(e.target.value)}
                    className="bg-white border-slate-200 focus-visible:ring-emerald-500 text-sm"
                  />
                </div>
                <Button
                  onClick={createProjectGroup}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                  disabled={selectedProjects.length < 2 || !projectGroupName.trim()}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create group ({selectedProjects.length})
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-xs text-slate-700 font-medium">
                    Select projects to include (min 2)
                  </Label>
                  <Input
                    placeholder="Search projects…"
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    className="bg-white border-slate-200 h-8 text-sm sm:max-w-[220px]"
                  />
                </div>
                {selectedProjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProjects.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleProject(m)}
                        className="text-[0.7rem] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200"
                        title="Remove"
                      >
                        {m} ×
                      </button>
                    ))}
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
                  {selectableProjects.length === 0 ? (
                    <p className="text-sm text-slate-500 p-3 text-center">
                      {projectChoices.length === 0
                        ? 'No project names on leads yet.'
                        : 'No ungrouped projects match your search.'}
                    </p>
                  ) : (
                    selectableProjects.map(label => {
                      const checked = selectedProjects.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleProject(label)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${
                            checked ? 'bg-emerald-50/80' : ''
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[0.65rem] ${
                              checked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="truncate text-slate-800" title={label}>
                            {label}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Active groups</CardTitle>
            <CardDescription>
              Campaign and project groups both show up as “Previous” in Leads and Reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {campaignGroups.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <p className="text-sm text-slate-500">No groups yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {campaignGroups.map(g => (
                  <div
                    key={g.id}
                    className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{g.name}</p>
                      <p className="text-xs text-slate-500 mt-1 break-words">
                        {g.members.join(' · ')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => deleteGroup(g.id)}
                      aria-label={`Delete group ${g.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            Campaign performance
            {scopeSummary && (
              <span className="ml-1.5 font-normal text-blue-600">· {scopeSummary}</span>
            )}
          </p>
          <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-8" onClick={() => navigate('/leads')}>
            <Users className="w-3.5 h-3.5 mr-1" />
            View all leads
          </Button>
        </div>
        <Table className="min-w-full text-[0.8125rem]">
          <TableHeader>
            <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
              <TableHead className="font-semibold text-slate-500 px-6 py-3">Campaign / source</TableHead>
              <TableHead className="font-semibold text-slate-500 px-6 py-3">Platform</TableHead>
              <TableHead className="font-semibold text-slate-500 px-6 py-3 text-right">Leads</TableHead>
              <TableHead className="font-semibold text-slate-500 px-6 py-3 text-right">Spend</TableHead>
              <TableHead className="font-semibold text-slate-500 px-6 py-3 text-right">CPL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                  Loading leads…
                </TableCell>
              </TableRow>
            ) : tableRows.length === 0 && hasFilters ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No campaigns for leads in {scopeSummary}.
                  <Button
                    variant="link"
                    onClick={clearFilters}
                    className="ml-2 text-blue-500 p-0 h-auto font-medium"
                  >
                    Clear filters
                  </Button>
                </TableCell>
              </TableRow>
            ) : tableRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No campaigns in Settings and no leads with a campaign or source yet.
                  <Button variant="link" onClick={() => navigate('/settings')} className="ml-2 text-blue-500 p-0 h-auto font-medium">
                    Add ad spend in Settings
                  </Button>
                  <span className="mx-1">or</span>
                  <Button variant="link" onClick={() => navigate('/leads')} className="text-blue-500 p-0 h-auto font-medium">
                    import leads
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              tableRows.map(row => (
                <TableRow key={row.key} className="border-b border-slate-200">
                  <TableCell className="px-6 py-4">
                    <span className="font-medium text-slate-900">{row.name}</span>
                    {row.fromSettings && (
                      <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-slate-400">settings</span>
                    )}
                    {row.isGroup && (
                      <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-blue-500">
                        group{row.memberCount ? ` · ${row.memberCount}` : ''}
                      </span>
                    )}
                    {!row.fromSettings && !row.isGroup && (
                      <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-slate-400">from leads</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-600">{row.platform}</TableCell>
                  <TableCell className="px-6 py-4 text-right font-semibold text-slate-900 tabular-nums">
                    {row.leadCount.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right text-slate-700 tabular-nums">
                    {row.spend > 0 ? formatMoney(row.spend) : '—'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right text-slate-700 tabular-nums">
                    {row.leadCount > 0 && row.spend > 0 ? formatMoney(row.cpl) : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
          Leads match Settings campaigns by name. Admin groups combine multiple campaign names under one label.
          {!demoLeads && ' Updates automatically when leads change in Supabase.'}
        </div>
      </div>
    </div>
  );
}
