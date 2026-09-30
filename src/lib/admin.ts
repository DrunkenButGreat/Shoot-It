import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export async function getAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  return prisma.user.findFirst({
    where: { id: session.user.id, isAdmin: true },
    select: { id: true },
  })
}
