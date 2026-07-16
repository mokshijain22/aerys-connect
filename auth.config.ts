import type { NextAuthConfig } from 'next-auth';

import { isAllowed } from '@/app/lib/role-access';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const publicPaths = ['/login'];
      if (publicPaths.some((p) => pathname.startsWith(p))) return true;

      if (!isLoggedIn) return false;

      const role = (auth?.user as any)?.role;
      if (!role) return false;

      if (!isAllowed(role, pathname)) {
        return Response.redirect(new URL('/', request.nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = (user as any).id;
        token.dealerId = (user as any).dealerId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).dealerId = token.dealerId;
      }
      return session;
    },
  },
  providers: [],
};