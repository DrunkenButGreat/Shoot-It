import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string, slotId: string }> }
) {
    const session = await auth()
    const { id, slotId } = await params

    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await canEditProject(session.user.id, id))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    try {
        const body = await request.json()
        const { startTime, endTime, color } = body

        const slot = await prisma.appointmentSlot.update({
            where: {
                id: slotId,
                projectId: id,
            },
            data: {
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                color,
            },
        })

        return NextResponse.json(slot)
    } catch (error) {
        console.error("[APPOINTMENT_PATCH]", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string, slotId: string }> }
) {
    const session = await auth()
    const { id, slotId } = await params

    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await canEditProject(session.user.id, id))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    try {
        await prisma.appointmentSlot.delete({
            where: {
                id: slotId,
                projectId: id,
            },
        })

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("[APPOINTMENT_DELETE]", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
