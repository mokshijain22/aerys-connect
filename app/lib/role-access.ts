export const ROLE_ACCESS: Record<string, string[]> = {
  super_admin: ['/', '/vehicles', '/jobcards', '/warranty-claims', '/warranty-check', '/reports', '/dealers', '/technicians', '/inventory', '/analytics', '/settings', '/live-map', '/pan-india'],
  dealer: ['/', '/vehicles', '/jobcards', '/warranty-claims', '/warranty-check', '/technicians', '/inventory', '/live-map'],
  technician: ['/', '/jobcards', '/warranty-claims', '/inventory'],
  customer: ['/', '/vehicles', '/jobcards', '/warranty-claims'],
};

export function isAllowed(role: string, pathname: string): boolean {
  const allowedPaths = ROLE_ACCESS[role] || [];
  return allowedPaths.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
}