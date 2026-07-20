export const ROLE_ACCESS: Record<string, string[]> = {
  super_admin: ['/', '/vehicles', '/jobcards', '/warranty-claims', '/warranty-check', '/reports', '/dealers', '/technicians', '/inventory', '/analytics', '/settings', '/account-settings', '/live-map', '/pan-india'],
  dealer: ['/', '/vehicles', '/jobcards', '/warranty-claims', '/warranty-check', '/technicians', '/inventory', '/live-map', '/account-settings', '/whatsapp-inbox'],
  technician: ['/', '/jobcards', '/warranty-claims', '/inventory', '/account-settings'],
  customer: ['/', '/vehicles', '/jobcards', '/warranty-claims', '/account-settings'],
};

export function isAllowed(role: string, pathname: string): boolean {
  const allowedPaths = ROLE_ACCESS[role] || [];
  return allowedPaths.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
}