import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { AppointmentStatus } from "@prisma/client"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string, slotId: string }> }
) {
    const session = await auth()
    const { id, slotId } = await params

    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!(await canAccessProject(session.user.id, id))) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    try {
        const body = await request.json()
        const { status } = body as { status: AppointmentStatus }

        if (!status || !Object.values(AppointmentStatus).includes(status)) {
            return new NextResponse("Invalid status", { status: 400 })
        }

        const response = await prisma.appointmentResponse.upsert({
            where: {
                slotId_userId: {
                    slotId,
                    userId: session.user.id,
                },
            },
            update: {
                status,
            },
            create: {
                slotId,
                userId: session.user.id,
                status,
            },
        })

        return NextResponse.json(response)
    } catch (error) {
        console.error("[APPOINTMENT_RESPOND_POST]", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
