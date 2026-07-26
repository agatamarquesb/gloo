import { createContext, use } from 'react';

/**
 * Lets any descendant (sidebar, mobile nav, page header avatar) open the
 * profile modal without threading a callback through every layer.
 */
export const ProfileContext = createContext<{ open: () => void }>({ open: () => {} });

export const useProfileModal = () => use(ProfileContext);
