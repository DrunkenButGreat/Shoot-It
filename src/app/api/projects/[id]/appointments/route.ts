import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canAccessProject, canEditProject } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await canAccessProject(session.user.id, id))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    const slots = await prisma.appointmentSlot.findMany({
        where: { projectId: id },
        include: {
            responses: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                        },
                    },
                },
            },
        },
        orderBy: { startTime: 'asc' },
    })

    return NextResponse.json(slots)
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await canEditProject(session.user.id, id))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    try {
        const body = await request.json()
        const { startTime, endTime, color } = body

        if (!startTime || !endTime) {
            return new NextResponse("Missing required fields", { status: 400 })
        }

        const slot = await prisma.appointmentSlot.create({
            data: {
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                color,
                projectId: id,
            },
        })

        return NextResponse.json(slot)
    } catch (error) {
        console.error("[APPOINTMENTS_POST]", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
