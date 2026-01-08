import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const profileSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    bio: z.string().optional().nullable(),
})

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                name: true,
                email: true,
                phone: true,
                role: true,
                bio: true,
            },
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json(user)
    } catch (error) {
        console.error('Error fetching profile:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const validatedData = profileSchema.parse(body)

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: validatedData.name,
                phone: validatedData.phone,
                role: validatedData.role,
                bio: validatedData.bio,
            },
        })

        // Also update all Participant entries for this user if they exist
        await prisma.participant.updateMany({
            where: { userId: session.user.id },
            data: {
                name: validatedData.name,
                phone: validatedData.phone,
                role: validatedData.role,
            },
        })

        return NextResponse.json(user)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 })
        }
        console.error('Error updating profile:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
