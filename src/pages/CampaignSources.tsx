import { Megaphone, ArrowUpRight, TrendingUp, TrendingDown, Plus } from 'lucide-react';
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

const MOCK_CAMPAIGNS = [
  { id: 1, name: 'Google Search Ads - Q1', platform: 'Google Ads', spend: '$4,500', leads: 145, costPerLead: '$31.03', status: 'Active', trend: 'up' },
  { id: 2, name: 'FB Retargeting - Villas', platform: 'Facebook', spend: '$2,100', leads: 86, costPerLead: '$24.41', status: 'Active', trend: 'up' },
  { id: 3, name: 'LinkedIn Professionals', platform: 'LinkedIn', spend: '$3,200', leads: 42, costPerLead: '$76.19', status: 'Paused', trend: 'down' },
  { id: 4, name: 'Spring Newsletter', platform: 'Email', spend: '$150', leads: 28, costPerLead: '$5.35', status: 'Completed', trend: 'up' },
];

export default function CampaignSources() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campaign Sources</h1>
          <p className="text-sm text-slate-500 mt-1">Track marketing campaigns, ad spend, and lead generation performance.</p>
        </div>
        <Button className="bg-blue-500 text-white hover:bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
           <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Ad Spend</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">$9,950</p>
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
                  <p className="text-sm font-medium text-slate-500">Total Leads Generated</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">301</p>
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
                  <p className="text-2xl font-bold text-slate-900 mt-1">$33.05</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
              </div>
           </CardContent>
         </Card>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
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
            {MOCK_CAMPAIGNS.map((campaign) => (
              <TableRow key={campaign.id} className="border-b border-slate-200">
                <TableCell className="px-6 py-4 font-medium text-slate-900">{campaign.name}</TableCell>
                <TableCell className="px-6 py-4 text-slate-500">{campaign.platform}</TableCell>
                <TableCell className="px-6 py-4 text-slate-900">{campaign.spend}</TableCell>
                <TableCell className="px-6 py-4 text-slate-900">
                  <div className="flex items-center gap-2">
                    {campaign.leads}
                    {campaign.trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-slate-900">{campaign.costPerLead}</TableCell>
                <TableCell className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                    campaign.status === 'Active' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                    campaign.status === 'Paused' ? 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/20' :
                    'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10'
                  }`}>
                    {campaign.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
