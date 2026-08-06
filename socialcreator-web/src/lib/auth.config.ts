import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration used by the middleware.
 *
 * The middleware runs on the edge runtime where Prisma is not available,
 * so this config MUST NOT import Prisma, bcrypt, or any node-only module.
 * The full config (providers, adapter, DB role refresh) lives in `auth.ts`
 * and is used by API routes which run on the Node.js runtime.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id ?? "";
        token.cguAccepted = user.cguAccepted ?? false;
        token.role = user.role ?? "USER";
        token.roles = [user.role ?? "USER"];
      }

      // Pass CGU status to session
      if (trigger === "update" && session) {
        token.cguAccepted = session.cguAccepted;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.cguAccepted = token.cguAccepted;
        session.user.role = token.role;
        session.user.roles = token.roles;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
