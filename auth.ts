import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { pool } from '@/app/lib/db';
import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.user_id = (user as any).id;
        token.dealer_id = (user as any).dealerId ?? null;
        token.customer_id = (user as any).customerId ?? null;
        token.technician_id = (user as any).technicianId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = (token as any).user_id;
        (session.user as any).dealer_id = (token as any).dealer_id ?? null;
        (session.user as any).customer_id = (token as any).customer_id ?? null;
        (session.user as any).technician_id = (token as any).technician_id ?? null;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        if (!email || !password) return null;

        const [rows]: any = await pool.query(
          `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.role, u.is_active,
                  u.dealer_id, u.customer_id, t.technician_id
           FROM users u
           LEFT JOIN technicians t ON t.user_id = u.user_id AND t.deleted_at IS NULL
           WHERE u.email = ? AND u.deleted_at IS NULL`,
          [email]
        );

        const user = rows[0];
        if (!user) return null;
        if (!user.is_active) return null;

        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) return null;

        return {
          id: String(user.user_id),
          name: user.full_name,
          email: user.email,
          role: user.role,
          dealerId: user.dealer_id,
          customerId: user.customer_id,
          technicianId: user.technician_id,
        };
      },
    }),
  ],
});