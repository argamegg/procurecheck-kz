import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Search, Building2 } from 'lucide-react';
import { logout, getAuthUser } from '@/utils/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  const navigate = useNavigate();
  const user = getAuthUser();
  const roleLabel = user?.role === 'user' ? 'Пользователь' : 'Администратор';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = () => {
    navigate('/');
  };

  const handleCompanies = () => {
    navigate('/companies');
  };

  return (
    <nav
      data-testid="navbar"
      className="fixed w-full h-16 bg-[#0f0f10] text-white z-50 flex items-center px-6 shadow-md"
    >
      <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <button
            onClick={() => navigate('/')}
            data-testid="navbar-logo"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-sm">
              PC
            </div>
            <span className="text-lg font-semibold">ProcureCheck KZ</span>
          </button>
          
          <Button
            onClick={handleSearch}
            data-testid="navbar-search-btn"
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <Search className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Поиск
          </Button>

          <Button
            onClick={handleCompanies}
            data-testid="navbar-companies-btn"
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <Building2 className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Участники
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid="navbar-user-menu"
              variant="ghost"
              className="flex items-center gap-2 text-white hover:bg-white/10"
            >
              <User className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-sm">{user?.full_name || user?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user?.full_name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <p className="text-xs text-slate-500">Роль: {roleLabel}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} data-testid="navbar-logout-btn">
              <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};
