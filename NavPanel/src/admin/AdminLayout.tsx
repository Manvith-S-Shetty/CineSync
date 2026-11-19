import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import './admin.css';

const PAGE_META: Record<string, { title: string; description: string }> = {
  '/admin': {
    title: 'Overview',
    description: 'Live platform metrics from persisted CineSync data.',
  },
  '/admin/users': {
    title: 'Users',
    description: 'Registered accounts and engagement signals.',
  },
  '/admin/analytics': {
    title: 'Analytics',
    description: 'Room participation and watch-session trends.',
  },
  '/admin/activity': {
    title: 'Activity',
    description: 'Recent events reconstructed from persisted timestamps.',
  },
};

function resolvePageMeta(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/admin';
  return PAGE_META[normalized] ?? PAGE_META['/admin'];
}

export default function AdminLayout() {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  const meta = resolvePageMeta(pathname);
  const closeNav = () => setNavOpen(false);

  return (
    <div className="admin-root">
      <AdminSidebar open={navOpen} onNavigate={closeNav} onClose={closeNav} />
      <div className="admin-main">
        <AdminHeader
          title={meta.title}
          description={meta.description}
          onOpenNav={() => setNavOpen(true)}
        />
        <main className="admin-content" id="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
