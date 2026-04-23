import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  platform: string;
  spend: number;
}

export default function Settings() {
  const [goal, setGoal] = useState('50000000');
  const [avgValue, setAvgValue] = useState('5000000');
  const [assignmentTimerMinutes, setAssignmentTimerMinutes] = useState('60');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [newCampaign, setNewCampaign] = useState({ name: '', platform: 'Google Ads', spend: '' });

  useEffect(() => {
    setGoal(localStorage.getItem('crm_revenue_goal') || '50000000');
    setAvgValue(localStorage.getItem('crm_avg_deal_value') || '5000000');
    setAssignmentTimerMinutes(localStorage.getItem('crm_assignment_timer_minutes') || '60');
    const saved = localStorage.getItem('crm_campaigns');
    if (saved) setCampaigns(JSON.parse(saved));
  }, []);

  const saveBusinessSettings = () => {
    localStorage.setItem('crm_revenue_goal', goal);
    localStorage.setItem('crm_avg_deal_value', avgValue);
    localStorage.setItem('crm_assignment_timer_minutes', assignmentTimerMinutes);
    toast.success('Business settings saved');
  };

  const addCampaign = () => {
    if (!newCampaign.name.trim() || !newCampaign.spend) {
      toast.error('Please fill in campaign name and spend');
      return;
    }
    const campaign: Campaign = {
      id: Date.now().toString(),
      name: newCampaign.name,
      platform: newCampaign.platform,
      spend: parseFloat(newCampaign.spend),
    };
    const updated = [...campaigns, campaign];
    setCampaigns(updated);
    localStorage.setItem('crm_campaigns', JSON.stringify(updated));
    setNewCampaign({ name: '', platform: 'Google Ads', spend: '' });
    toast.success('Campaign added');
  };

  const deleteCampaign = (id: string) => {
    const updated = campaigns.filter(c => c.id !== id);
    setCampaigns(updated);
    localStorage.setItem('crm_campaigns', JSON.stringify(updated));
    toast.success('Campaign deleted');
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account settings and preferences.</p>
      </div>

      <div className="grid gap-6">
        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Profile Information</CardTitle>
            <CardDescription>Update your personal information and contact details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-slate-700 font-medium">First name</Label>
                <Input id="firstName" defaultValue="Admin" className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-slate-700 font-medium">Last name</Label>
                <Input id="lastName" defaultValue="User" className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
              <Input id="email" type="email" defaultValue="admin@estatescrm.com" className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-700 font-medium">Phone number</Label>
              <Input id="phone" type="tel" defaultValue="+1 (555) 000-0000" className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" />
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-200 px-6 py-4 bg-slate-50/50 rounded-b-xl justify-end">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white">Save Changes</Button>
          </CardFooter>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Change Password</CardTitle>
            <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="current_password" className="text-slate-700 font-medium">Current password</Label>
              <Input id="current_password" type="password" className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" />
            </div>
            <Separator className="bg-slate-200" />
            <div className="space-y-2">
              <Label htmlFor="new_password" className="text-slate-700 font-medium">New password</Label>
              <Input id="new_password" type="password" className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password" className="text-slate-700 font-medium">Confirm new password</Label>
              <Input id="confirm_password" type="password" className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" />
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-200 px-6 py-4 bg-slate-50/50 rounded-b-xl justify-end">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white">Update Password</Button>
          </CardFooter>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Business Settings</CardTitle>
            <CardDescription>Configure goals and defaults for the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="revenue_goal" className="text-slate-700 font-medium">Monthly Revenue Goal (₹)</Label>
              <Input 
                id="revenue_goal" 
                type="number" 
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avg_deal_value" className="text-slate-700 font-medium">Average Deal Value (₹)</Label>
              <Input 
                id="avg_deal_value" 
                type="number" 
                value={avgValue}
                onChange={(e) => setAvgValue(e.target.value)}
                className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" 
              />
            </div>
            <Separator className="bg-slate-200" />
            <div className="space-y-2">
              <Label htmlFor="assignment_timer" className="text-slate-700 font-medium">Lead Assignment Timer (Minutes)</Label>
              <Input 
                id="assignment_timer" 
                type="number" 
                min="5"
                max="1440"
                value={assignmentTimerMinutes}
                onChange={(e) => setAssignmentTimerMinutes(e.target.value)}
                className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500" 
              />
              <p className="text-xs text-slate-500">How long can a telecaller hold a lead before it auto-reassigns? (5 min - 24 hours)</p>
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-200 px-6 py-4 bg-slate-50/50 rounded-b-xl justify-end">
            <Button onClick={saveBusinessSettings} className="bg-blue-500 hover:bg-blue-600 text-white">Save Business Settings</Button>
          </CardFooter>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold">Campaign Ad Spend</CardTitle>
            <CardDescription>Manually track advertising spend for each campaign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900">Add New Campaign</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="campaign_name" className="text-xs text-slate-700 font-medium">Campaign Name</Label>
                  <Input 
                    id="campaign_name"
                    placeholder="e.g., Google Ads Q1"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign(c => ({ ...c, name: e.target.value }))}
                    className="bg-white border-slate-200 focus-visible:ring-blue-500 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="campaign_platform" className="text-xs text-slate-700 font-medium">Platform</Label>
                  <select
                    id="campaign_platform"
                    value={newCampaign.platform}
                    onChange={(e) => setNewCampaign(c => ({ ...c, platform: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <option>Google Ads</option>
                    <option>Facebook Ads</option>
                    <option>LinkedIn</option>
                    <option>Instagram</option>
                    <option>Email</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="campaign_spend" className="text-xs text-slate-700 font-medium">Spend (₹)</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="campaign_spend"
                      type="number"
                      placeholder="Amount"
                      value={newCampaign.spend}
                      onChange={(e) => setNewCampaign(c => ({ ...c, spend: e.target.value }))}
                      className="bg-white border-slate-200 focus-visible:ring-blue-500 text-sm"
                    />
                    <Button onClick={addCampaign} className="bg-blue-500 hover:bg-blue-600 text-white px-3 h-9">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Active Campaigns</h4>
              {campaigns.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <p className="text-sm text-slate-500">No campaigns added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {campaigns.map(campaign => (
                    <div key={campaign.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{campaign.name}</p>
                        <p className="text-xs text-slate-500">{campaign.platform}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">₹{campaign.spend.toLocaleString('en-IN')}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteCampaign(campaign.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900">
                  Total Ad Spend: ₹{campaigns.reduce((sum, c) => sum + c.spend, 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
