import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PublicSelection } from "@/components/public/PublicSelection"
import { getLocale, getDictionary } from "@/lib/i18n"
import { cookies } from "next/headers"

export default async function PublicSelectionPage({
    params,
}: {
    params: Promise<{ shortCode: string }>
}) {
    const { shortCode } = await params
    const session = await auth()
    const cookieStore = await cookies()
    const locale = getLocale(cookieStore)
    const dict = await getDictionary(locale)

    const project = await prisma.project.findUnique({
        where: { shortCode },
        include: {
            owner: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    brandingColor: true,
                    brandingImage: true,
                },
            },
            selectionImages: {
                include: {
                    ratings: true,
                },
                orderBy: { importedAt: "desc" },
            },
            selectionFolders: {
                include: {
                    images: {
                        include: {
                            ratings: true,
                        },
                    },
                },
            },
        },
    }) as any

    if (!project) {
        notFound()
    }

    const userHasAccess = session?.user?.id
        ? await canAccessProject(session.user.id, project.id)
        : false

    if (!project.isPublic) {
        if (!session?.user?.id) {
            redirect(`/login?callbackUrl=/p/${shortCode}/selection`)
        }

        if (!userHasAccess) {
            return (
                <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
                    <Card className="max-w-md w-full text-center p-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            {dict.publicProject.privateProject}
                        </h1>
                        <p className="text-gray-600 mb-6">
                            {dict.publicProject.noProjectAccess}
                        </p>
                        <Link href="/dashboard">
                            <Button className="w-full">{dict.publicProject.goToDashboard}</Button>
                        </Link>
                    </Card>
                </div>
            )
        }
    }

    if (!project.showSelectionPublicly && !userHasAccess) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
                <Card className="max-w-md w-full text-center p-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {dict.project.selection}
                    </h1>
                    <p className="text-gray-600 mb-6">
                        {dict.publicProject.loginRequired}
                    </p>
                    <Link href={`/p/${shortCode}`}>
                        <Button className="w-full">{dict.publicProject.overview}</Button>
                    </Link>
                </Card>
            </div>
        )
    }

    const brandColor = project.brandingColor || project.owner.brandingColor

    return (
        <div
            className="flex-1 bg-gray-50 pb-12"
            style={brandColor ? { "--brand-color": brandColor } as React.CSSProperties : undefined}
        >
            <div
                className="relative h-48 bg-slate-900 overflow-hidden"
                style={brandColor ? { backgroundColor: brandColor } : undefined}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/60 z-10" />
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-30"
                    style={{ backgroundImage: project.coverHidden ? undefined : `url('${project.brandingImage || project.owner.brandingImage || ""}')`, backgroundPosition: `${project.coverPositionX}% ${project.coverPositionY}%` }}
                />

                <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-6">
                    <Link
                        href={`/p/${shortCode}`}
                        className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4 w-fit"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {dict.publicProject.overview}
                    </Link>

                    <div className="flex items-center gap-3 text-white">
                        <CheckSquare className="h-7 w-7" />
                        <h1 className="text-3xl font-bold">
                            {dict.project.selection}
                        </h1>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-30">
                <Card className="border-none shadow-xl overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardContent className="pt-6">
                        <PublicSelection
                            projectId={project.id}
                            images={project.selectionImages}
                            folders={project.selectionFolders}
                            layout={project.galleryLayout as any}
                            userHasAccess={userHasAccess}
                            isAuthenticated={!!session?.user?.id}
                            allowGuestSelection={project.allowGuestSelection}
                            showFolders={project.showSelectionFolders}
                            allowDownload={project.allowSelectionDownload}
                            brandColor={brandColor}
                        />
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
