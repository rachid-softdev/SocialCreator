import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.cguAccepted = user.cguAccepted ?? false;
        token.role = user.role ?? 'USER';
        token.roles = user.roles ?? [user.role ?? 'USER'];
      }

      // Fetch roles from DB on token refresh (subsequent requests)
      if (!user && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            include: { userRoles: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.roles = dbUser.userRoles.map((ur) => ur.role);
          }
        } catch (error) {
          console.error('[Auth] Failed to fetch user roles on token refresh:', error);
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