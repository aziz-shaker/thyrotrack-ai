import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { rateLimit } from "./rate-limit";

const credsSchema = z.object({ email: z.string().email(), password: z.string().min(6).max(128) });

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8h clinical shift
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Brute-force protection: 5 attempts / 15 min per email
        if (!rateLimit(`login:${email}`, 5, 15 * 60_000)) throw new Error("RATE_LIMIT");

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user || !user.isActive || user.deletedAt) return null;
        if (!(await bcrypt.compare(password, user.passwordHash))) {
          await audit({ actorId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id });
          return null;
        }
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await audit({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
};

export const getSession = () => getServerSession(authOptions);

/** Where each role lands after login */
export const HOME_BY_ROLE: Record<Role, string> = {
  ADMIN: "/doctor",
  DOCTOR: "/doctor",
  RADIOLOGIST: "/doctor",
  LAB_TECH: "/doctor",
  PATIENT: "/patient",
};
