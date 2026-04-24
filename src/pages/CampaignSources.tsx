import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Megaphone,
  ArrowUpRight,
  TrendingUp,
  Plus,
  ExternalLink,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { fetchLeads, useDemoLeads } from '@/src/services/leadsService';
import { supabase } from '@/lib/supabaseClient';
import type { Lead } from '@/types';

interface ManualCampaign {
  id: string;
  name: string;
  platform: string;
  spend: number;
}

/** Display label from a lead (Facebook / CSV campaign or source). */
function campaignLabel(lead: Lead): string {
  const c = (lead.campaignName || '').trim();
  const s = (lead.leadSource || '').trim();
  if (c) return c;
  if (s) return s;
  return 'Not specified';
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

  const [manualCampaigns, setManualCampaigns] = useState<ManualCampaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (e.key === 'crm_campaigns' || e.key === null) loadCampaignsFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadCampaignsFromStorage]);

  // Supabase: keep campaign metrics in sync when leads change
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
      const label = campaignLabel(lead);
      unmatchedByLabel.set(label, (unmatchedByLabel.get(label) ?? 0) + 1);
    }

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
      rows.push({
        key: `lead-${label}`,
        name: label,
        platform: inferPlatform(label),
        spend: 0,
        leadCount: count,
        cpl: 0,
        fromSettings: false,
      });
    }

    rows.sort((a, b) => {
      if (a.fromSettings !== b.fromSettings) return a.fromSettings ? -1 : 1;
      return b.leadCount - a.leadCount;
    });

    return rows;
  }, [leads, manualCampaigns]);

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
                    {!row.fromSettings && (
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
                    {row.leadCount > 0 && row.spend > 0 ? formatMoney(row.cpl) : row.leadCount > 0 ? '—' : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
          Leads are matched to Settings campaigns by name (campaign or source). Unmatched leads appear as separate rows.
          {!demoLeads && ' Updates automatically when leads change in Supabase.'}
        </div>
      </div>
    </div>
  );
}
