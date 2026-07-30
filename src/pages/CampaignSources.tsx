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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  CAMPAIGN_GROUPS_KEY,
  type CampaignGroup,
  campaignLabel,
  claimedMemberLabels,
  distinctCampaignLabels,
  groupNameForLabel,
  loadCampaignGroups,
  saveCampaignGroups,
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
    setCampaignGroups(loadCampaignGroups());
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
    void loadLeads(false);
  }, [loadLeads, loadCampaignsFromStorage]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'crm_campaigns' || e.key === CAMPAIGN_GROUPS_KEY || e.key === null) {
        loadCampaignsFromStorage();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadCampaignsFromStorage]);

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

  const availableLabels = useMemo(() => distinctCampaignLabels(leads), [leads]);
  const claimed = useMemo(() => claimedMemberLabels(campaignGroups), [campaignGroups]);

  const selectableLabels = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return availableLabels.filter(label => {
      if (claimed.has(label.trim().toLowerCase())) return false;
      if (!q) return true;
      return label.toLowerCase().includes(q);
    });
  }, [availableLabels, claimed, memberSearch]);

  const toggleMember = (label: string) => {
    setSelectedMembers(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  const createGroup = () => {
    const name = groupName.trim();
    if (!name) {
      toast.error('Enter a group name (e.g. previous campaign name)');
      return;
    }
    if (selectedMembers.length < 2) {
      toast.error('Select at least 2 campaigns to group');
      return;
    }
    const nameTaken = campaignGroups.some(g => g.name.trim().toLowerCase() === name.toLowerCase());
    if (nameTaken) {
      toast.error('A group with this name already exists');
      return;
    }
    const next: CampaignGroup[] = [
      ...campaignGroups,
      { id: `grp-${Date.now()}`, name, members: [...selectedMembers] },
    ];
    saveCampaignGroups(next);
    setCampaignGroups(next);
    setGroupName('');
    setSelectedMembers([]);
    setMemberSearch('');
    toast.success(`Grouped ${selectedMembers.length} campaigns as “${name}”`);
  };

  const deleteGroup = (id: string) => {
    const next = campaignGroups.filter(g => g.id !== id);
    saveCampaignGroups(next);
    setCampaignGroups(next);
    toast.success('Campaign group removed');
  };

  const totalSpend = useMemo(
    () => manualCampaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0),
    [manualCampaigns]
  );

  const totalLeads = leads.length;

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
    for (const lead of leads) {
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
    for (const lead of leads) {
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
      const leadCount = leads.filter(l => matchedManualId.get(l.id) === mc.id).length;
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
  }, [leads, manualCampaigns, campaignGroups]);

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
                <p className="text-xs text-slate-400 mt-1">Synced from Leads</p>
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
                <p className="text-xs text-slate-400 mt-1">Spend ÷ all leads</p>
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
                      {availableLabels.length === 0
                        ? 'No campaign names on leads yet.'
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

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Active groups</h4>
              {campaignGroups.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <p className="text-sm text-slate-500">No campaign groups yet</p>
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
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Campaign performance</p>
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
