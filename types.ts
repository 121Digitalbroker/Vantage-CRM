export type Role = 'Admin' | 'Manager' | 'Sales';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'Active' | 'Inactive';
  lastLogin: string;
  avatar?: string;
}

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Site Visit Scheduled'
  | 'Visit Completed'
  | 'Negotiation'
  | 'Booked'
  | 'Not Interested'
  | 'Wrong Number'
  | 'Low Budget';

export type LeadLevel = 'Hot' | 'Warm' | 'Cold';

export type InvestmentBudget = 'Below ₹50L' | '₹50L - ₹1Cr' | 'Above ₹1Cr' | 'Not Specified';

export interface Lead {
  id: string;
  clientName: string;
  phoneNumber: string;
  email?: string;
  project: string;
  leadSource: string;
  campaignName?: string;
  campaignId?: string;
  adsetName?: string;
  adsetId?: string;
  adName?: string;
  adId?: string;
  formName?: string;
  formId?: string;
  isOrganic?: boolean;
  assignedUserId: string;
  leadLevel: LeadLevel;
  status: LeadStatus;
  followUpDate: string;
  lastContactedAt?: string;
  createdAt: string;
  investmentBudget?: InvestmentBudget;
  city?: string;
  bestTimeToContact?: string;
  planningToBuy?: string;
  facebookLeadId?: string;
  // Assignment timer fields
  assignedAt?: string;
  lastStatusUpdate?: string;
  assignmentExpiresAt?: string;
}

export type FollowUpType = 'Call' | 'Meeting' | 'Site Visit' | 'Closure';

export interface FollowUp {
  id: string;
  leadId: string;
  type: FollowUpType;
  date: string;
  notes: string;
  completed: boolean;
}

export interface Note {
  id: string;
  leadId: string;
  content: string;
  createdAt: string;
  createdBy: string;
}
