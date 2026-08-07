import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
  })],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.id = user.id!; token.role = user.role; token.onboardingCompleted = user.onboardingCompleted; }
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
