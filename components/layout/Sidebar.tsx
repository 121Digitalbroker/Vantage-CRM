import { NavLink } from 'react-router-dom';
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
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/src/contexts/RoleContext';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { currentUser, allUsers, switchUser, logout, isAdmin, isTelecaller } = useRole();

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

  const navItems = isTelecaller ? telecallerNav : adminNav;

  const roleColor: Record<string, string> = {
    Admin:      'bg-blue-500',
    Manager:    'bg-purple-500',
    Telecaller: 'bg-emerald-500',
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-sm">
      {/* Logo */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
            EF
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight">EstatesCRM</span>
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
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400 px-4 mb-1">
              Preview as
            </p>
            <NavLink
              to="/my-dashboard"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-600 font-semibold'
                    : 'text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Phone className="h-4 w-4" />
              Telecaller View
            </NavLink>
          </div>
        )}
      </ScrollArea>

      {/* User switcher */}
      {/* Logout button */}
      <div className="px-3 pb-1">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      <div className="p-3 border-t border-slate-200">
        <DropdownMenu>
          {/* Trigger renders a single <button>; do not nest another <button> inside (invalid HTML + hydration warning). */}
          <DropdownMenuTrigger className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${roleColor[currentUser.role] ?? 'bg-slate-400'}`}>
              {currentUser.initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</div>
              <div className="text-xs text-slate-400">{currentUser.role}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-[220px] mb-1">
            <DropdownMenuLabel className="text-xs text-slate-400 font-normal">
              Switch user (demo)
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allUsers.map(user => (
              <DropdownMenuItem
                key={user.id}
                className={`cursor-pointer text-xs ${currentUser.id === user.id ? 'font-semibold text-blue-600 bg-blue-50' : ''}`}
                onClick={() => switchUser(user.id)}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[0.6rem] font-bold mr-2 shrink-0 ${roleColor[user.role] ?? 'bg-slate-400'}`}>
                  {user.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{user.name}</div>
                  <div className="text-slate-400">{user.role}</div>
                </div>
                {currentUser.id === user.id && <span className="ml-auto text-blue-500">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
