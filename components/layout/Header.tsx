import { Menu, Search, User, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/src/contexts/RoleContext';
import NotificationBell from '@/src/components/NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
}

const avatarColors: Record<string, string> = {
  Admin:      'bg-blue-500',
  Manager:    'bg-purple-500',
  Telecaller: 'bg-emerald-500',
};

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { currentUser, logout } = useRole();

  if (!currentUser) return null;

  return (
    <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex relative w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 opacity-50" />
          <Input
            type="search"
            placeholder="Search leads, projects…"
            className="pl-9 bg-slate-100 border-slate-200 rounded-md focus-visible:ring-blue-500 focus-visible:bg-white text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Position badge (if set by admin) */}
        {currentUser.position?.trim() && (
          <span className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {currentUser.position}
          </span>
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* User avatar — single trigger button (no asChild + Button nested buttons) */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-9 w-9 rounded-full p-0 overflow-hidden inline-flex items-center justify-center border-0 bg-transparent cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className={`text-white text-sm font-semibold ${avatarColors[currentUser.role] ?? 'bg-slate-400'}`}>
                {currentUser.initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">{currentUser.name}</p>
                <p className="text-xs leading-none text-slate-500">{currentUser.email}</p>
                {currentUser.position?.trim() && (
                  <span className="mt-1 text-[0.65rem] font-semibold px-1.5 py-0.5 rounded-full w-fit bg-slate-100 text-slate-600">
                    {currentUser.position}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-sm gap-2"
              onClick={() => navigate('/profile')}
            >
              <User className="w-4 h-4 text-slate-400" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-sm gap-2"
              onClick={() => navigate('/settings')}
            >
              <SettingsIcon className="w-4 h-4 text-slate-400" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer text-sm gap-2"
              onClick={() => { logout(); navigate('/login'); }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
