import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "guard";
      name: string;
      phone: string | null;
      email: string | null;
      nameConfirmed: boolean;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier || "").trim();
        const password = String(credentials?.password || "");
        if (!identifier || !password) return null;

        const normalizedPhone = identifier.replace(/[^\d+]/g, "");
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier.toLowerCase() },
              ...(normalizedPhone.length >= 7
                ? [{ phone: normalizedPhone }]
                : []),
            ],
          },
        });
        if (!user || !user.approved) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      const uid = token.uid as string | undefined;
      if (uid) {
        // Fresh read so role/name/phone changes apply without re-login.
        const dbUser = await prisma.user.findUnique({ where: { id: uid } });
        if (dbUser) {
          Object.assign(session.user, {
            id: dbUser.id,
            role: dbUser.role,
            name: dbUser.name,
            phone: dbUser.phone,
            email: dbUser.email,
            nameConfirmed: dbUser.nameConfirmed,
          });
        }
      }
      return session;
    },
  },
});

/** Require a signed-in user; returns the session or null. */
export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Normalize a phone number to digits (keeps leading +). */
export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[^\d+]/g, "");
}

/** True if the name has at least two words of 2+ letters each. */
export function isFullName(name: string): boolean {
  const parts = name.trim().split(/\s+/).filter((p) => p.length >= 2);
  return parts.length >= 2;
}
