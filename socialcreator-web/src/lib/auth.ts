import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

// Pre-computed at module level (runs once on first import)
// Used as a dummy hash for constant-time bcrypt comparison when user is not found,
// preventing timing-based user enumeration attacks
const DUMMY_HASH = bcrypt.hashSync("constant-time-fallback", 10);

import NextAuth, { type NextAuthResult } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";
import logger from "./logger";
import { prisma } from "./prisma";

// Validate critical auth configuration at module load
if (!process.env.AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET environment variable is required. " +
      "Generate one with: npx auth secret (NextAuth v5) or a random 32-char string.",
  );
}

const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!googleId || !googleSecret) {
  throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required.");
}

const nextAuthResult: NextAuthResult = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify",
  },
  providers: [
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, _request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        // ALWAYS perform bcrypt.compare for constant-time verification
        // Prevents timing-based user enumeration even when user doesn't exist
        const passwordHash = user?.password ?? DUMMY_HASH;
        const isValid = await bcrypt.compare(credentials.password as string, passwordHash);

        if (!user || !isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id ?? "";
        token.cguAccepted = user.cguAccepted ?? false;
        token.role = user.role ?? "USER";
        token.roles = [user.role ?? "USER"];
      }

      // Fetch roles from DB on token refresh (subsequent requests)
      if (!user && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.roles = [dbUser.role];
          }
        } catch (error) {
          logger.error({ err: error }, "Failed to fetch user roles on token refresh");
        }
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
});

export const { handlers, auth, signIn, signOut } = nextAuthResult;
