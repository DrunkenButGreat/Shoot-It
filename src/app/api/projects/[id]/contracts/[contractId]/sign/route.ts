import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { signatureSchema } from '@/lib/validations'
import { canAccessProject } from '@/lib/permissions'

// POST /api/projects/[id]/contracts/[contractId]/sign - Sign a contract
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; contractId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, contractId } = params

    // Check if user has access to this project
    const hasAccess = await canAccessProject(session.user.id, id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = signatureSchema.parse(body)

    // Get IP and user agent from request
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    const signature = await prisma.contractSignature.create({
      data: {
        ...validatedData,
        contractId,
        userId: session.user.id,
        ipAddress: ip,
        userAgent,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(signature, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('Error signing contract:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
