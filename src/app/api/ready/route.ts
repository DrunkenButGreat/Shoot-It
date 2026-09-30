import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { version } from '../../../../package.json'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.user.findFirst({ select: { id: true, isAdmin: true, isOwner: true } })
    return NextResponse.json({ status: 'ok', version }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ status: 'unavailable', version }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
