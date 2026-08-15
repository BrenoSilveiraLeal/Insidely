import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/entrar" },
  providers: [Credentials({
    credentials: { email: { label: "E-mail", type: "email" }, password: { label: "Senha", type: "password" } },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, onboardingCompleted: user.onboardingCompleted };
    },
  }), ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })] : []), ...(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET ? [LinkedIn({ clientId: process.env.AUTH_LINKEDIN_ID, clientSecret: process.env.AUTH_LINKEDIN_SECRET })] : [])],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "credentials") {
        if (!user.email) return false;
        await prisma.user.upsert({ where: { email: user.email.toLowerCase() }, update: { name: user.name?.trim() || "Pessoa Insidely", image: user.image }, create: { name: user.name?.trim() || "Pessoa Insidely", email: user.email.toLowerCase(), image: user.image, role: Role.USER } });
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (token.email) {
        const stored = await prisma.user.findUnique({ where: { email: token.email.toLowerCase() } });
        if (stored) { token.id = stored.id; token.role = stored.role; token.onboardingCompleted = stored.onboardingCompleted; }
      } else if (user) { token.id = user.id!; token.role = user.role; token.onboardingCompleted = user.onboardingCompleted; }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.id);
      session.user.role = token.role as Role;
      session.user.onboardingCompleted = Boolean(token.onboardingCompleted);
      return session;
    },
  },
});
