import { useMemo, useState } from 'react';
import { Outlet } from 'react-router';

import { MobileNav } from './MobileNav';
import { ProfileContext } from './ProfileContext';
import { ProfileModal } from './ProfileModal';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [isProfileOpen, setProfileOpen] = useState(false);
  const profile = useMemo(() => ({ open: () => setProfileOpen(true) }), []);

  return (
    <ProfileContext value={profile}>
      <div className="flex h-screen bg-background">
        <Sidebar />
        {/* Bottom padding clears the fixed mobile nav so the last row stays reachable. */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
        <MobileNav />
        <ProfileModal isOpen={isProfileOpen} onClose={() => setProfileOpen(false)} />
      </div>
    </ProfileContext>
  );
}
