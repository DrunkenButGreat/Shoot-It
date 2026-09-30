import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { notFound, redirect } from "next/navigation"
import { Calendar, MapPin, Image as ImageIcon, Users, Clock, CheckSquare } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PublicGallery } from "@/components/public/PublicGallery"
import { PublicResults } from "@/components/public/PublicResults"
import { PublicSelection } from "@/components/public/PublicSelection"
import { ApplicationForm } from "@/components/projects/ApplicationForm"
import { AppointmentPublicList } from "@/components/appointments/AppointmentPublicList"
import { ModuleBox } from "@/components/public/ModuleBox"
import { TeamLoginBox } from "@/components/public/TeamLoginBox"
import { getLocale, getDictionary } from "@/lib/i18n"
import { cookies } from "next/headers"
import { BrandMark } from "@/components/layout/BrandMark"

export default async function PublicProjectPage({
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
            moodboardLinks: {
                include: {
                    group: {
                        include: {
                            images: {
                                orderBy: { createdAt: 'desc' }
                            }
                        }
                    }
                },
                orderBy: { order: 'asc' }
            },
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        }
                    }
                },
                orderBy: { name: 'asc' }
            },
            selectionImages: {
                include: {
                    ratings: true
                },
                orderBy: { importedAt: 'desc' }
            },
            selectionFolders: {
                include: {
                    images: {
                        include: { ratings: true }
                    },
                    _count: { select: { images: true } }
                }
            },
            resultFolders: true,
            appointmentSlots: {
                include: {
                    responses: true
                },
                orderBy: { startTime: 'asc' }
            },
            callsheet: {
                include: {
                    scheduleItems: {
                        orderBy: { time: 'asc' }
                    }
                }
            },
            _count: {
                select: {
                    moodboardLinks: true,
                    participants: true,
                    contracts: true,
                    selectionImages: true,
                    appointmentSlots: true,
                },
            },
        },
    }) as any

    if (!project) {
        notFound()
    }

    const moodboardGroups = (project.moodboardLinks || []).map((link: any) => ({
        ...link.group,
        status: link.status,
        order: link.order
    }))

    // Does the logged-in user have project access (owner/editor/viewer/participant)?
    // This — not merely being logged in — decides whether ratings go through the
    // authenticated path or the guest path.
    const userHasAccess = session?.user?.id
        ? await canAccessProject(session.user.id, project.id)
        : false

    // If project is not public, check if user has access
    if (!project.isPublic) {
        if (!session?.user?.id) {
            redirect(`/login?callbackUrl=/p/${shortCode}`)
        }

        if (!userHasAccess) {
            return (
                <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
                    <Card className="max-w-md w-full text-center p-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">{dict.publicProject.privateProject}</h1>
                        <p className="text-gray-600 mb-6">{dict.publicProject.noProjectAccess}</p>
                        <Link href="/dashboard">
                            <Button className="w-full">{dict.publicProject.goToDashboard}</Button>
                        </Link>
                    </Card>
                </div>
            )
        }
    }

    const projectDate = project.date ? new Date(project.date) : null
    const brandingImage = project.brandingImage || project.owner.brandingImage || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=85&w=2200'
    const brandColor = project.brandingColor || project.owner.brandingColor

    return (
        <div className="flex-1 bg-[#f5f6f8] pb-12" style={brandColor ? { '--brand-color': brandColor } as React.CSSProperties : undefined}>
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <BrandMark />
                    {!session && (
                        <Link href={`/login?callbackUrl=/p/${shortCode}`} className="text-sm font-semibold text-slate-600 hover:text-slate-950">
                            {dict.publicProject.areYouTeam}
                        </Link>
                    )}
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
                <div className="h-64 overflow-hidden rounded-xl bg-slate-200 sm:h-80">
                    <img src={brandingImage} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col gap-6 border-b border-slate-200 bg-white px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                            {project.isPublic ? dict.projectForm.public : dict.projectForm.private} · {dict.publicProject.showcase}
                        </p>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{project.name}</h1>
                        <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-600">
                            {projectDate && <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{projectDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                            {project.location && <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{project.location}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {project.owner.image ? (
                            <img src={project.owner.image} alt={project.owner.name || ''} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600">{project.owner.name?.[0] || 'O'}</div>
                        )}
                        <div>
                            <p className="text-xs text-slate-500">{dict.publicProject.organizedBy}</p>
                            <p className="text-sm font-semibold text-slate-900">{project.owner.name || project.owner.email}</p>
                        </div>
                    </div>
                </div>
                <nav className="flex gap-6 overflow-x-auto border-b border-slate-200 bg-white px-5 sm:px-8" aria-label={dict.publicProject.overview}>
                    <a href="#overview" className="border-b-2 border-blue-600 py-4 text-sm font-semibold text-blue-600">{dict.publicProject.overview}</a>
                    {project.showMoodboardPublicly && <a href="#moodboard" className="py-4 text-sm font-medium text-slate-600">{dict.project.moodboard}</a>}
                    {project.showParticipantsPublicly && <a href="#participants" className="py-4 text-sm font-medium text-slate-600">{dict.project.participants}</a>}
                    {project.showSelectionPublicly && <a href="#selection" className="py-4 text-sm font-medium text-slate-600">{dict.project.selection}</a>}
                    {project.showResultsPublicly && <a href="#results" className="py-4 text-sm font-medium text-slate-600">{dict.project.results}</a>}
                </nav>
            </div>

            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Modules */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card id="overview" className="overflow-hidden bg-white">
                            <CardHeader className="pb-0">
                                <CardTitle className="text-2xl">{dict.publicProject.overview}</CardTitle>
                                {project.description && (
                                    <CardDescription className="mt-4 text-base leading-relaxed text-slate-600">
                                        {project.description}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="pt-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <ModuleBox
                                        title={dict.project.moodboard}
                                        icon={<ImageIcon className="h-6 w-6" />}
                                        count={moodboardGroups.length}
                                        label={dict.project.groups.replace('{count}', '').trim()}
                                        href={session ? `/project/${project.id}/moodboard` : (project.showMoodboardPublicly ? '#moodboard' : '#')}
                                        disabled={!session && !project.showMoodboardPublicly}
                                        dict={dict}
                                        brandColor={brandColor}
                                    />
                                    <ModuleBox
                                        title={dict.project.participants}
                                        icon={<Users className="h-6 w-6" />}
                                        count={project._count.participants}
                                        label={dict.project.people.replace('{count}', '').trim()}
                                        href={session ? `/project/${project.id}/participants` : (project.showParticipantsPublicly ? '#participants' : '#')}
                                        disabled={!session && !project.showParticipantsPublicly}
                                        dict={dict}
                                        brandColor={brandColor}
                                    />
                                    <ModuleBox
                                        title={dict.project.selection}
                                        icon={<CheckSquare className="h-6 w-6" />}
                                        count={project._count.selectionImages}
                                        label={dict.project.imagesCount.replace('{count}', '').trim()}
                                        href={session ? `/project/${project.id}/selection` : (project.showSelectionPublicly ? '#selection' : '#')}
                                        disabled={!session && !project.showSelectionPublicly}
                                        dict={dict}
                                        brandColor={brandColor}
                                    />
                                    <ModuleBox
                                        title={dict.project.callsheet}
                                        icon={<Clock className="h-6 w-6" />}
                                        count={project.callsheet ? 1 : 0}
                                        label={dict.project.callsheet}
                                        href={session ? `/project/${project.id}/callsheet` : (project.showCallsheetPublicly ? '#callsheet' : '#')}
                                        disabled={!session && !project.showCallsheetPublicly}
                                        dict={dict}
                                        brandColor={brandColor}
                                    />
                                    <ModuleBox
                                        title={dict.project.results}
                                        icon={<ImageIcon className="h-6 w-6" />}
                                        count={project.resultFolders.length}
                                        label={dict.project.foldersCount.replace('{count}', '').trim()}
                                        href={session ? `/project/${project.id}/results` : (project.showResultsPublicly ? '#results' : '#')}
                                        disabled={!session && !project.showResultsPublicly}
                                        dict={dict}
                                        brandColor={brandColor}
                                    />
                                    <ModuleBox
                                        title={dict.project.appointments || 'Termine'}
                                        icon={<Calendar className="h-6 w-6" />}
                                        count={project._count.appointmentSlots}
                                        label={dict.project.appointmentsLabel || 'Optionen'}
                                        href={session ? `/project/${project.id}/appointments` : (project.showAppointmentsPublicly ? '#appointments' : '#')}
                                        disabled={!session && !project.showAppointmentsPublicly}
                                        dict={dict}
                                        brandColor={brandColor}
                                    />
                                </div>

                                {!session && (
                                    <TeamLoginBox 
                                        shortCode={shortCode}
                                        dict={dict}
                                        brandColor={brandColor}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Public Modules Content */}
                        {project.showMoodboardPublicly && moodboardGroups.length > 0 && (
                            <section id="moodboard" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-slate-100 p-2 text-slate-600" style={brandColor ? { color: brandColor } : undefined}>
                                        <ImageIcon className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{dict.project.moodboard}</h2>
                                </div>
                                <div className="space-y-8">
                                    {moodboardGroups.map((group: any) => (
                                        <Card key={group.id} className="overflow-hidden bg-white">
                                            <CardHeader>
                                                <CardTitle className="text-xl">{group.name}</CardTitle>
                                                {group.description && <CardDescription>{group.description}</CardDescription>}
                                            </CardHeader>
                                            <CardContent>
                                                <PublicGallery
                                                    images={group.images}
                                                    layout={project.galleryLayout as any}
                                                />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {project.showResultsPublicly && (
                            <section id="results" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-slate-100 p-2 text-slate-600" style={brandColor ? { color: brandColor } : undefined}>
                                        <ImageIcon className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{dict.project.results}</h2>
                                </div>
                                <PublicResults projectId={project.id} />
                            </section>
                        )}

                        {project.showParticipantsPublicly && project.participants.length > 0 && (
                            <section id="participants" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-slate-100 p-2 text-slate-600" style={brandColor ? { color: brandColor } : undefined}>
                                        <Users className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{dict.project.participants}</h2>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {project.participants.map((participant: any) => (
                                        <Card key={participant.id} className="group overflow-hidden bg-white">
                                            <div className="p-4 flex items-center gap-4">
                                                <div className="relative">
                                                    {participant.user?.image ? (
                                                        <img src={participant.user.image} alt={participant.name} className="h-16 w-16 rounded-lg object-cover" />
                                                    ) : (
                                                        <div 
                                                            className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-500"
                                                            style={brandColor ? { color: brandColor } : undefined}
                                                        >
                                                            {participant.name[0]}
                                                        </div>
                                                    )}
                                                    {participant.userId && (
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full" title="Verified Account" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className={`font-bold text-gray-900 transition-colors ${brandColor ? 'group-hover:text-[var(--brand-color)]' : 'group-hover:text-indigo-600'}`}>
                                                        {participant.name}
                                                    </h3>
                                                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-0.5" style={brandColor ? { color: brandColor } : undefined}>{participant.role || 'Contributor'}</p>
                                                    {participant.notes && <p className="text-xs text-gray-500 mt-2 line-clamp-1 italic">{participant.notes}</p>}
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {project.showSelectionPublicly && project.selectionImages.length > 0 && (
                            <section id="selection" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-slate-100 p-2 text-slate-600" style={brandColor ? { color: brandColor } : undefined}>
                                        <ImageIcon className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{dict.project.selection}</h2>
                                </div>
                                <Card className="overflow-hidden bg-white">
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
                            </section>
                        )}

                        {project.showCallsheetPublicly && project.callsheet && (
                            <section id="callsheet" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-slate-100 p-2 text-slate-600" style={brandColor ? { color: brandColor } : undefined}>
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{dict.project.callsheet}</h2>
                                </div>
                                <Card className="overflow-hidden bg-white">
                                    <CardContent className="p-0">
                                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                                            <div className="p-6 space-y-4">
                                                <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs">{dict.publicProject.essentialTimes}</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <TimeItem label={dict.callsheet.call} time={project.callsheet.callTime} color="blue" />
                                                    <TimeItem label={dict.callsheet.start} time={project.callsheet.startTime} color="green" />
                                                    <TimeItem label={dict.callsheet.end} time={project.callsheet.endTime} color="orange" />
                                                    <TimeItem label={dict.callsheet.wrap} time={project.callsheet.wrapTime} color="rose" />
                                                </div>
                                            </div>
                                            <div className="p-6 space-y-4">
                                                <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs">{dict.publicProject.locationDetails}</h3>
                                                <div className="space-y-2">
                                                    <p className="font-bold text-gray-900">{project.callsheet.locationName || project.location}</p>
                                                    <p className="text-sm text-gray-600 leading-relaxed">{project.callsheet.locationAddress || project.address}</p>
                                                    {project.callsheet.locationNotes && (
                                                        <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500 italic">
                                                            {project.callsheet.locationNotes}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {project.callsheet.scheduleItems?.length > 0 && (
                                            <div className="border-t border-gray-100 p-6">
                                                <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs mb-6">{dict.publicProject.schedule}</h3>
                                                <div className="space-y-4">
                                                    {project.callsheet.scheduleItems.map((item: any) => (
                                                        <div key={item.id} className="flex items-start gap-4 group">
                                                            <div className="shrink-0 w-16 pt-1 text-sm font-black text-gray-400 tabular-nums group-hover:text-blue-600 transition-colors">
                                                                {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            <div className="flex-1 pb-4 border-b border-gray-50 group-last:border-0">
                                                                <p className="font-bold text-gray-900">{item.activity}</p>
                                                                {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </section>
                        )}

                        {project.showAppointmentsPublicly && project.appointmentSlots?.length > 0 && (
                            <section id="appointments" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-slate-100 p-2 text-slate-600" style={brandColor ? { color: brandColor } : undefined}>
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{dict.project.appointments || 'Terminfindung'}</h2>
                                </div>
                                <AppointmentPublicList 
                                    slots={project.appointmentSlots} 
                                    locale={locale} 
                                />
                            </section>
                        )}
                    </div>

                    {/* Right Column: Info & Actions */}
                    <div className="space-y-6">
                        {project.allowApplications && (
                            <Card className="overflow-hidden bg-white">
                                <CardHeader>
                                    <CardTitle className="text-xl text-slate-950">{dict.applications.sectionTitle}</CardTitle>
                                    <CardDescription className="text-slate-600">
                                        {dict.applications.sectionDescription}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ApplicationForm 
                                        projectId={project.id} 
                                        projectName={project.name}
                                        initialData={{
                                            name: session?.user?.name || undefined,
                                            email: session?.user?.email || undefined
                                        }}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        <Card className="bg-white">
                            <CardHeader>
                                <CardTitle className="text-lg">{dict.publicProject.projectInfo}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{dict.projectForm.location}</p>
                                        <p className="text-sm text-gray-600">{project.location || dict.common.tbd}</p>
                                        {project.address && <p className="text-xs text-gray-400 mt-1">{project.address}</p>}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{dict.projectForm.date}</p>
                                        <p className="text-sm text-gray-600">
                                            {projectDate ? projectDate.toLocaleDateString(locale) : dict.common.tbd}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {session?.user?.id === project.ownerId && (
                            <Link href={`/project/${project.id}`} className="block">
                                <Button className="h-auto w-full bg-slate-900 py-5 text-white hover:bg-slate-800">
                                    {dict.publicProject.goToDashboard}
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

function TimeItem({ label, time, color }: { label: string, time: any, color: string }) {
    if (!time) return null

    const colors: any = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
    }

    return (
        <div className={`flex flex-col justify-center rounded-lg border p-3 ${colors[color]}`}>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
            <span className="text-lg font-black">{new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    )
}
