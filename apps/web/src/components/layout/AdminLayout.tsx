import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Map, BarChart2, Megaphone, Users, Bell, Settings, CalendarDays, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const NAV = [
  { to: '/admin',           label: 'Overview',      Icon: LayoutDashboard, exact: true },
  { to: '/admin/incidents', label: 'Reports',        Icon: FileText,        badge: '8'  },
  { to: '/admin/map',       label: 'Camp Map',       Icon: Map                          },
  { to: '/admin/analytics', label: 'Analytics',      Icon: BarChart2                    },
  { to: '/admin/events',    label: 'Events',         Icon: CalendarDays                 },
  { to: '/admin/broadcast', label: 'Announcements',  Icon: Megaphone                    },
  { to: '/admin/drivers',   label: 'Response Teams', Icon: Users                        },
];

interface Props { title: string; subtitle?: string; children: React.ReactNode; }

export function AdminLayout({ title, subtitle, children }: Props) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'A';

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-dot" />
          <span className="sidebar-logo-text">CampPulse</span>
          <span className="sidebar-logo-badge">Admin</span>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Navigation</div>
          <nav className="sidebar-nav">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <item.Icon size={16} style={{ flexShrink: 0 }} />
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout} title="Click to sign out">
            <div className="avatar">{initials}</div>
            <div>
              <div className="avatar-name">{user?.full_name ?? 'Admin'}</div>
              <div className="avatar-role">Sign out</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-area">
        <header className="topbar">
          <div>
            <div className="topbar-title">{title}</div>
            {subtitle && <div className="topbar-sub">{subtitle}</div>}
          </div>
          <div className="topbar-right">
            <div className="icon-btn" title="Notifications">
              <Bell size={16} />
              <span className="notif-dot" />
            </div>
            <div className="icon-btn" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </div>
            <div className="icon-btn" title="Settings">
              <Settings size={16} />
            </div>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}
