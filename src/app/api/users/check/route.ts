import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const email = request.nextUrl.searchParams.get('email')
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                phone: true,
                role: true,
                bio: true,
            },
        })

        if (!user) {
            return NextResponse.json({ found: false })
        }

        return NextResponse.json({ found: true, user })
    } catch (error) {
        console.error('Error checking user:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
