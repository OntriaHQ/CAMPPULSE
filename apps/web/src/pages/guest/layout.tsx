import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header className="g-nav">
        <div className="g-nav-left">
          <div className="g-logo-dot" />
          <span className="g-logo-text">CampPulse</span>
          <span className="g-logo-tag">Guest</span>
        </div>
        <div className="g-nav-right">
          <button className="g-theme-btn" onClick={toggle} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <Link to="/login" className="g-admin-link">Admin Login</Link>
        </div>
      </header>
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
}
