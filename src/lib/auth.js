import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import FacebookProvider from "next-auth/providers/facebook";
import TwitterProvider from "next-auth/providers/twitter";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
async authorize(credentials) {
  try {
    if (
      !credentials?.email ||
      !credentials?.password
    ) {
      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          email: credentials.email,
        },
      });

    if (!user) {
      return null;
    }

    if (!user.password) {
      console.error(
        "User has no password:",
        user.email
      );
      return null;
    }

    const valid =
      await bcrypt.compare(
        credentials.password,
        user.password
      );

    if (!valid) {
      return null;
    }
    const now = new Date();

await prisma.user.update({
  where: { id: user.id },
  data: {
    lastLoginAt: now,
    lastSeenAt: now,
  },
});

await prisma.loginHistory.create({
  data: {
    userId: user.id,
    email: user.email,
    name: user.name || user.email,
    loginAt: now,
  },
});
return {
  id: String(user.id),
  email: user.email,
  name: user.name || user.email,
};

  } catch (error) {
    console.error(
      "Authorize error:",
      error
    );

    return null;
  }
}
    }),
/*    GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  }),

  GitHubProvider({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET
  }),

  FacebookProvider({
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET
  }),

  TwitterProvider({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    version: "2.0"
  }),

    DiscordProvider({
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    version: "2.0"
  })*/
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login" 
  },
events: {
  async signIn({ user }) {
    try {
      if (!user?.email) return;

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, email: true, name: true },
      });

      if (!dbUser) return;

      const now = new Date();

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          lastLoginAt: now,
          lastSeenAt: now,
        },
      });

      await prisma.loginHistory.create({
        data: {
          userId: dbUser.id,
          email: dbUser.email,
          name: dbUser.name || dbUser.email,
        },
      });
    } catch (error) {
      console.error("signIn event error:", error);
    }
  },
},
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.email = user.email;
    }

    return token;
  },

  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id;
      session.user.email = token.email || session.user.email;
    }

    return session;
  },
},
  secret: process.env.NEXTAUTH_SECRET
};