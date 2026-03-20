import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, AppNotification } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Wallet, 
  LogOut, 
  Bell,
  Search,
  Menu,
  X,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';

interface LayoutProps {
  children: ReactNode;
  user: User;
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('lingua-theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('theme-dark');
      localStorage.setItem('lingua-theme', 'dark');
    } else {
      root.classList.remove('theme-dark');
      localStorage.setItem('lingua-theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let isMounted = true;
    dataService.getNotifications(user.role)
      .then((data) => {
        if (!isMounted) return;
        setNotifications(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setNotifications([]);
      });
    return () => {
      isMounted = false;
    };
  }, [user.role]);

  const openNotifications = async () => {
    const nextOpen = !showNotifications;
    setShowNotifications(nextOpen);
    if (!nextOpen) return;

    try {
      setNotificationsLoading(true);
      setNotificationsError(null);
      const data = await dataService.getNotifications(user.role);
      setNotifications(data);
    } catch (error: any) {
      setNotificationsError(error?.message || 'Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const adminNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Students', path: '/students', icon: Users },
    { name: 'Programs', path: '/programs', icon: BookOpen },
    { name: 'Teachers', path: '/teachers', icon: GraduationCap },
    { name: 'Financials', path: '/financials', icon: Wallet },
  ];

  const teacherNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'My Students', path: '/students', icon: Users },
  ];

  const navItems = user.role === 'ADMIN' ? adminNav : teacherNav;
  const hasNotifications = notifications.length > 0;

  const handleMenuToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileSidebarOpen(prev => !prev);
      return;
    }
    setIsSidebarOpen(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-ivory flex">
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.button
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-charcoal/45 lg:hidden"
            aria-label="Close sidebar"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'lg:w-64' : 'lg:w-20'
        } w-64 bg-navy text-white transition-all duration-300 flex flex-col fixed h-full z-50 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-navy rounded flex items-center justify-center font-serif font-bold text-xl">
            L
          </div>
          {isSidebarOpen && (
            <span className="font-serif text-xl tracking-tight">Lingua Center</span>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive 
                  ? 'bg-white/10 text-white shadow-inner' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={20} />
                {isSidebarOpen && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={() => {
              setIsMobileSidebarOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ml-0 overflow-x-hidden ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Header */}
        <header className="h-20 bg-white/50 backdrop-blur-md border-b border-charcoal/5 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleMenuToggle}
              className="p-2 hover:bg-charcoal/5 rounded-lg text-charcoal/60"
            >
              <Menu size={20} />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" size={18} />
              <input 
                type="text" 
                placeholder="Search records..." 
                className="pl-10 pr-4 py-2 bg-charcoal/5 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-sage/20 focus:border-sage w-64 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
            <button
              onClick={() => setIsDarkMode(prev => !prev)}
              className="p-2 text-charcoal/60 hover:bg-charcoal/5 rounded-lg"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="relative">
              <button onClick={openNotifications} className="relative p-2 text-charcoal/60 hover:bg-charcoal/5 rounded-lg">
              <Bell size={20} />
              {hasNotifications && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-danger-muted rounded-full border-2 border-white"></span>
              )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-[90vw] max-w-sm sm:w-96 popover-surface shadow-2xl rounded-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-charcoal/10 flex items-center justify-between">
                    <p className="text-sm font-semibold text-charcoal">Notifications</p>
                    <button onClick={() => setShowNotifications(false)} className="p-1 text-charcoal/40 hover:text-charcoal">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notificationsLoading && (
                      <p className="p-4 text-xs text-charcoal/40">Loading notifications...</p>
                    )}
                    {notificationsError && (
                      <p className="p-4 text-xs text-danger-muted">{notificationsError}</p>
                    )}
                    {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                      <p className="p-4 text-xs text-charcoal/40">No notifications available.</p>
                    )}
                    {!notificationsLoading && !notificationsError && notifications.map(notification => (
                      <div key={notification.id} className="p-4 border-b border-charcoal/5 last:border-b-0">
                        <p className="text-sm font-semibold text-charcoal">{notification.title}</p>
                        <p className="text-xs text-charcoal/60 mt-1">{notification.message}</p>
                        <p className="text-[10px] text-charcoal/40 mt-2">{notification.createdAt?.slice(0, 10)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 lg:pl-6 border-l border-charcoal/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-charcoal">{user.name}</p>
                <p className="text-xs text-charcoal/50 capitalize">{user.role.toLowerCase()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center text-sage font-bold">
                {user.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
