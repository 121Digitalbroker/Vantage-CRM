import { useState, useEffect } from 'react';
import { Megaphone, ArrowUpRight, TrendingUp, TrendingDown, Plus, ExternalLink } from 'lucide-react';
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

interface Campaign {
  id: string;
  name: string;
  platform: string;
  spend: number;
}

export default function CampaignSources() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('crm_campaigns');
    if (saved) {
      const parsedCampaigns: Campaign[] = JSON.parse(saved);
      setCampaigns(parsedCampaigns);
      setTotalSpend(parsedCampaigns.reduce((sum, c) => sum + c.spend, 0));
    }
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campaign Sources</h1>
          <p className="text-sm text-slate-500 mt-1">Track marketing campaigns, ad spend, and lead generation performance.</p>
        </div>
        <Button onClick={() => navigate('/settings')} className="bg-blue-500 text-white hover:bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Manage Campaigns
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
           <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Ad Spend</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">₹{totalSpend.toLocaleString('en-IN')}</p>
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
                  <p className="text-2xl font-bold text-slate-900 mt-1">0</p>
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
                  <p className="text-2xl font-bold text-slate-900 mt-1">₹0</p>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                  No active campaigns found. Add campaigns in Settings to track ad spend.
                  <Button variant="link" onClick={() => navigate('/settings')} className="ml-2 text-blue-500 p-0 h-auto font-medium">
                    Go to Settings <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id} className="border-b border-slate-200">
                  <TableCell className="px-6 py-4 font-medium text-slate-900">{campaign.name}</TableCell>
                  <TableCell className="px-6 py-4 text-slate-500">{campaign.platform}</TableCell>
                  <TableCell className="px-6 py-4 font-medium text-slate-900">₹{campaign.spend.toLocaleString('en-IN')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
