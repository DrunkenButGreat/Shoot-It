import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { canAccessProject, canEditProject } from "@/lib/permissions"
import { AppointmentCalendar } from "@/components/appointments/AppointmentCalendar"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function AppointmentsPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
        redirect(`/login?callbackUrl=/project/${id}/appointments`)
    }

    const hasAccess = await canAccessProject(session.user.id, id)
    if (!hasAccess) {
        notFound()
    }

    const isOwner = await canEditProject(session.user.id, id)

    const project = await prisma.project.findUnique({
        where: { id },
        select: { name: true }
    })

    if (!project) {
        notFound()
    }

    return (
        <div className="flex-1 bg-gray-50/50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/project/${id}`}
                        className="p-2 rounded-full bg-white shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{project.name}</h1>
                        <p className="text-gray-500">Terminfindung & Verfügbarkeiten</p>
                    </div>
                </div>

                <AppointmentCalendar 
                    projectId={id} 
                    isOwner={isOwner} 
                    currentUserId={session.user.id} 
                />
            </div>
        </div>
    )
}
