import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Megaphone,
  UserCog,
  BarChart3,
  Settings,
  X,
  Phone,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRole } from '@/src/contexts/RoleContext';

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { currentUser, logout, isManager, isTelecaller, isDigitalMarketer } = useRole();

  if (!currentUser) return null;

  const adminNav = [
    { name: 'Dashboard',        path: '/dashboard',      icon: LayoutDashboard },
    { name: 'Leads',            path: '/leads',           icon: Users },
    { name: 'Follow-ups',       path: '/follow-ups',      icon: CalendarDays },
    { name: 'Campaign Sources', path: '/campaigns',       icon: Megaphone },
    { name: 'Users',            path: '/users',           icon: UserCog },
    { name: 'Reports',          path: '/reports',         icon: BarChart3 },
    { name: 'Settings',         path: '/settings',        icon: Settings },
  ];

  const telecallerNav = [
    { name: 'My Dashboard', path: '/my-dashboard', icon: LayoutDashboard },
    { name: 'My Leads',     path: '/leads',         icon: Phone },
    { name: 'Follow-ups',   path: '/follow-ups',    icon: CalendarDays },
  ];

  const managerNav = [
    { name: 'Manager Dashboard', path: '/manager-dashboard', icon: LayoutDashboard },
    { name: 'Leads', path: '/leads', icon: Users },
  ];

  const digitalMarketerNav = [
    { name: 'Leads', path: '/leads', icon: Users },
  ];

  const navItems = isTelecaller
    ? telecallerNav
    : isManager
      ? managerNav
      : isDigitalMarketer
        ? digitalMarketerNav
        : adminNav;

  const roleColor: Record<string, string> = {
    Admin:      'bg-blue-500',
    Manager:    'bg-purple-500',
    'Digital Marketer': 'bg-orange-500',
    Telecaller: 'bg-emerald-500',
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-sm">
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="Vantage CRM" className="w-8 h-8 rounded-lg shadow-sm shadow-blue-500/20" />
          <span className="font-bold text-lg text-slate-900 tracking-tight">Vantage CRM</span>
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 p-3">
        <nav className="space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-500 font-semibold'
                    : 'text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Quick-switch link for admin to view telecaller dashboard */}
      </ScrollArea>

      {/* User info + Logout */}
      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 mb-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${roleColor[currentUser.role] ?? 'bg-slate-400'}`}>
            {currentUser.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</div>
            {currentUser.position?.trim() && (
              <div className="text-xs text-slate-400 truncate">{currentUser.position}</div>
            )}
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
