const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const [action, email] = process.argv.slice(2)

async function main() {
  if (!['grant', 'revoke'].includes(action) || !email) {
    throw new Error('Usage: node --env-file=.env scripts/admin.cjs <grant|revoke> <existing-account-email>')
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isOwner: true } })
  if (!user) throw new Error('No existing account with this exact email address.')
  if (action === 'revoke' && user.isOwner) throw new Error('The instance owner must retain admin access.')
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: action === 'grant' } })
  console.log(`Admin access ${action === 'grant' ? 'granted' : 'revoked'} for ${email}.`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
