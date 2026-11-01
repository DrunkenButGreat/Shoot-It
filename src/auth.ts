import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { createRegisteredUser, getRegistrationMode } from "@/lib/registration"
import { getPocketIdConfig, PocketIdError, provisionPocketIdAccount, verifyPocketIdToken } from "@/lib/pocket-id"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, signIn, signOut, auth } = NextAuth(async () => {
  const pocketId = await getPocketIdConfig()
  return {
    adapter: {
      ...PrismaAdapter(prisma),
      // Enforce the policy at the OAuth creation boundary as well as the form API.
      createUser: ({ id, ...data }) => createRegisteredUser(data),
    },
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: "/login",
    },
    providers: [
      ...(pocketId ? [{
        id: "pocket-id",
        name: "Pocket ID",
        type: "oidc" as const,
        issuer: pocketId.issuer,
        clientId: pocketId.clientId,
        clientSecret: pocketId.secret,
        authorization: { params: { scope: "openid profile email" } },
        checks: ["pkce", "state", "nonce"] as ("pkce" | "state" | "nonce")[],
        allowDangerousEmailAccountLinking: true,
      }] : []),
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          try {
            const { email, password } = loginSchema.parse(credentials)

            const user = await prisma.user.findUnique({
              where: { email },
            })

            if (!user || !user.password) {
              return null
            }

            const isPasswordValid = await bcrypt.compare(password, user.password)

            if (!isPasswordValid) {
              return null
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
            }
          } catch (error) {
            return null
          }
        },
      }),
    ],
    callbacks: {
      async signIn({ account }) {
        if (account?.provider === "pocket-id") {
          if (!pocketId) return "/login?error=pocketIdUnavailable"
          try {
            const profile = await verifyPocketIdToken(account.id_token, pocketId)
            if (profile.sub !== account.providerAccountId) return "/login?error=pocketId&reason=accountConflict"
            await provisionPocketIdAccount(profile, pocketId)
            return true
          } catch (error) {
            const code = error instanceof PocketIdError ? error.code : "errorOccurred"
            return `/login?error=pocketId&reason=${encodeURIComponent(code)}`
          }
        }
        if (!account || account.type === "credentials") return true
        const linked = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
          select: { id: true },
        })
        if (linked) return true
        const mode = await getRegistrationMode()
        if (mode !== "OPEN") return `/login?error=${mode === "CLOSED" ? "registrationClosed" : "oauthInviteRequired"}`
        return true
      },
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id
        }
        return token
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string
        }
        return session
      },
    },
    events: {
      async createUser({ user }) {
        if (user.email) {
          await prisma.participant.updateMany({
            where: { email: user.email },
            data: { userId: user.id }
          })
        }
      }
    }
  }
})
