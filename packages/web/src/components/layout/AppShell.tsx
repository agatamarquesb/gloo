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
        {/* No page ever scrolls sideways: `min-w-0` lets the column shrink inside
            the shell's flex row rather than being held open by its widest child,
            and `overflow-x-hidden` catches what is left — a control that
            deliberately overhangs its column by a few pixels (the property rows'
            chevrons) or a value that refuses to wrap. Vertical scrolling is
            unaffected. */}
        <main className="gloo-thin-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
        <MobileNav />
        <ProfileModal isOpen={isProfileOpen} onClose={() => setProfileOpen(false)} />
      </div>
    </ProfileContext>
  );
}
