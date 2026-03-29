import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { MagicLink } from "@/models/MagicLink";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase();
        const password = credentials.password as string;

        await connectDB();

        // Magic link flow: email is "__magic_link__", password is the raw token
        if (email === "__magic_link__") {
          const hashedToken = crypto.createHash("sha256").update(password).digest("hex");
          const magicLink = await MagicLink.findOne({ hashedToken, used: false });

          if (!magicLink) return null;
          if (magicLink.expiresAt < new Date()) return null;

          // Mark token as used
          magicLink.used = true;
          await magicLink.save();

          // Find the user
          const user = await User.findOne({ email: magicLink.email, status: "active" });
          if (!user) return null;

          await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
          };
        }

        // Normal password flow
        const user = await User.findOne({ email }).select("+password");

        if (!user || !user.password) return null;
        if (user.status !== "active") return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "client" | "admin";
      session.user.status = token.status as "pending" | "active" | "suspended";
      return session;
    },
  },
});
