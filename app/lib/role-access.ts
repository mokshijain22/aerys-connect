export const ROLE_ACCESS: Record<string, string[]> = {
  super_admin: ['/', '/vehicles', '/jobcards', '/warranty-claims', '/warranty-check', '/dealers', '/technicians', '/inventory', '/analytics', '/settings', '/account-settings', '/live-map', '/pan-india', '/fraud-alerts'],
  dealer: ['/', '/vehicles', '/jobcards', '/warranty-claims', '/warranty-check', '/technicians', '/inventory', '/live-map', '/account-settings', '/whatsapp-inbox', '/fraud-alerts'],
  technician: ['/', '/jobcards', '/warranty-claims', '/inventory', '/account-settings'],
  customer: ['/', '/vehicles', '/jobcards', '/warranty-claims', '/account-settings'],
};

export function isAllowed(role: string, pathname: string): boolean {
  const allowedPaths = ROLE_ACCESS[role] || [];
  return allowedPaths.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
}