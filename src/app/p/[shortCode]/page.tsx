import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Calendar, MapPin, User, FileText, Image as ImageIcon, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import { PublicGallery } from "@/components/public/PublicGallery"

export default async function PublicProjectPage({
    params,
}: {
    params: Promise<{ shortCode: string }>
}) {
    const { shortCode } = await params
    const session = await auth()

    const project = await prisma.project.findUnique({
        where: { shortCode },
        include: {
            owner: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                },
            },
            moodboardGroups: {
                include: {
                    images: {
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'asc' }
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
                orderBy: { importedAt: 'desc' }
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
                    moodboardGroups: true,
                    participants: true,
                    contracts: true,
                    selectionImages: true,
                },
            },
        },
    }) as any

    if (!project) {
        notFound()
    }

    // If project is not public, check if user has access
    if (!project.isPublic) {
        if (!session?.user?.id) {
            redirect(`/login?callbackUrl=/p/${shortCode}`)
        }

        // Check if user has access (owner or via ProjectAccess or Participant)
        const hasAccess = await prisma.project.findFirst({
            where: {
                id: project.id,
                OR: [
                    { ownerId: session.user.id },
                    { access: { some: { userId: session.user.id } } },
                    { participants: { some: { email: session.user.email || undefined } } }
                ]
            }
        })

        if (!hasAccess) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <Card className="max-w-md w-full text-center p-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Private Project</h1>
                        <p className="text-gray-600 mb-6">You do not have permission to view this project. Please contact the owner for access.</p>
                        <Link href="/dashboard">
                            <Button className="w-full">Go to Dashboard</Button>
                        </Link>
                    </Card>
                </div>
            )
        }
    }

    const projectDate = project.date ? new Date(project.date) : null

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Premium Public Header */}
            <div className="relative h-64 bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-indigo-900/40 z-10" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492691523567-617025285ede?q=80&w=2070')] bg-cover bg-center opacity-30" />

                <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-8">
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        <div className="space-y-4">
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-500/30 backdrop-blur-md">
                                Public Showcase
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                                {project.name}
                            </h1>
                            <div className="flex flex-wrap gap-6 text-slate-300">
                                {projectDate && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-blue-400" />
                                        <span className="font-medium">{projectDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    </div>
                                )}
                                {project.location && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-5 w-5 text-blue-400" />
                                        <span className="font-medium">{project.location}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                            {project.owner.image ? (
                                <img src={project.owner.image} alt={project.owner.name || ''} className="w-12 h-12 rounded-full border-2 border-white/20" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                    {project.owner.name?.[0] || 'O'}
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-slate-400 font-medium">Project Owner</p>
                                <p className="text-sm text-white font-bold">{project.owner.name || project.owner.email}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-30">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Modules */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="border-none shadow-xl shadow-blue-900/5 overflow-hidden bg-white/80 backdrop-blur-md">
                            <CardHeader className="pb-0">
                                <CardTitle className="text-2xl">Overview</CardTitle>
                                {project.description && (
                                    <CardDescription className="text-base text-gray-600 mt-4 leading-relaxed">
                                        {project.description}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="pt-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <ModuleBox
                                        title="Moodboard"
                                        icon={<ImageIcon className="h-6 w-6" />}
                                        count={project._count.moodboardGroups}
                                        label="Groups"
                                        href={session ? `/project/${project.id}/moodboard` : (project.showMoodboardPublicly ? '#moodboard' : '#')}
                                        disabled={!session && !project.showMoodboardPublicly}
                                    />
                                    <ModuleBox
                                        title="Participants"
                                        icon={<Users className="h-6 w-6" />}
                                        count={project._count.participants}
                                        label="Team Members"
                                        href={session ? `/project/${project.id}/participants` : (project.showParticipantsPublicly ? '#participants' : '#')}
                                        disabled={!session && !project.showParticipantsPublicly}
                                    />
                                    <ModuleBox
                                        title="Selection"
                                        icon={<ImageIcon className="h-6 w-6" />}
                                        count={project._count.selectionImages}
                                        label="Images"
                                        href={session ? `/project/${project.id}/selection` : (project.showSelectionPublicly ? '#selection' : '#')}
                                        disabled={!session && !project.showSelectionPublicly}
                                    />
                                    <ModuleBox
                                        title="Callsheet"
                                        icon={<Clock className="h-6 w-6" />}
                                        count={project.callsheet ? 1 : 0}
                                        label="Details"
                                        href={session ? `/project/${project.id}/callsheet` : (project.showCallsheetPublicly ? '#callsheet' : '#')}
                                        disabled={!session && !project.showCallsheetPublicly}
                                    />
                                </div>

                                {!session && (
                                    <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-blue-900 text-lg">Are you part of the team?</h4>
                                            <p className="text-blue-700 text-sm">Login to access detailed documents, high-res images and the callsheet.</p>
                                        </div>
                                        <Link href={`/login?callbackUrl=/p/${shortCode}`}>
                                            <Button className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                                                Sign In to Access
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Public Modules Content */}
                        {project.showMoodboardPublicly && project.moodboardGroups.length > 0 && (
                            <section id="moodboard" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                                        <ImageIcon className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Moodboard</h2>
                                </div>
                                <div className="space-y-8">
                                    {project.moodboardGroups.map((group: any) => (
                                        <Card key={group.id} className="border-none shadow-lg overflow-hidden bg-white/60 backdrop-blur-md">
                                            <CardHeader>
                                                <CardTitle className="text-xl">{group.name}</CardTitle>
                                                {group.description && <CardDescription>{group.description}</CardDescription>}
                                            </CardHeader>
                                            <CardContent>
                                                <PublicGallery images={group.images} />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {project.showParticipantsPublicly && project.participants.length > 0 && (
                            <section id="participants" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                                        <Users className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Team Members</h2>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {project.participants.map((participant: any) => (
                                        <Card key={participant.id} className="border-none shadow-md bg-white/80 backdrop-blur-sm overflow-hidden hover:shadow-lg transition-all group">
                                            <div className="p-4 flex items-center gap-4">
                                                <div className="relative">
                                                    {participant.user?.image ? (
                                                        <img src={participant.user.image} alt={participant.name} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white" />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-indigo-400 font-bold text-xl">
                                                            {participant.name[0]}
                                                        </div>
                                                    )}
                                                    {participant.userId && (
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full" title="Verified Account" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{participant.name}</h3>
                                                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{participant.role || 'Contributor'}</p>
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
                                    <div className="p-2 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                                        <ImageIcon className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Selection Gallery</h2>
                                </div>
                                <Card className="border-none shadow-xl overflow-hidden bg-white/60 backdrop-blur-md">
                                    <CardContent className="pt-6">
                                        <PublicGallery images={project.selectionImages} aspectRatio="portrait" columns={5} />
                                    </CardContent>
                                </Card>
                            </section>
                        )}

                        {project.showCallsheetPublicly && project.callsheet && (
                            <section id="callsheet" className="space-y-6 scroll-mt-20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Callsheet Overview</h2>
                                </div>
                                <Card className="border-none shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                                    <CardContent className="p-0">
                                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                                            <div className="p-6 space-y-4">
                                                <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs">Essential Times</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <TimeItem label="Call" time={project.callsheet.callTime} color="blue" />
                                                    <TimeItem label="Start" time={project.callsheet.startTime} color="green" />
                                                    <TimeItem label="End" time={project.callsheet.endTime} color="orange" />
                                                    <TimeItem label="Wrap" time={project.callsheet.wrapTime} color="rose" />
                                                </div>
                                            </div>
                                            <div className="p-6 space-y-4">
                                                <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs">Location Details</h3>
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
                                                <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs mb-6">Schedule</h3>
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
                    </div>

                    {/* Right Column: Info & Actions */}
                    <div className="space-y-6">
                        <Card className="border-none shadow-lg bg-white/90 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Project Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Location</p>
                                        <p className="text-sm text-gray-600">{project.location || 'Not set'}</p>
                                        {project.address && <p className="text-xs text-gray-400 mt-1">{project.address}</p>}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Shoot Date</p>
                                        <p className="text-sm text-gray-600">
                                            {projectDate ? projectDate.toLocaleDateString() : 'TBD'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {session?.user?.id === project.ownerId && (
                            <Link href={`/project/${project.id}`} className="block">
                                <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-6 h-auto transition-all shadow-lg hover:shadow-slate-900/20">
                                    Go to Project Management
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

function ModuleBox({ title, icon, count, label, href, disabled }: any) {
    const content = (
        <div className={`p-4 rounded-2xl border transition-all ${disabled ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-lg hover:-translate-y-1'}`}>
            <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-xl ${disabled ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>
                    {icon}
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-gray-900">{count}</p>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{label}</p>
                </div>
            </div>
            <h3 className="font-bold text-gray-800">{title}</h3>
            {disabled && <p className="text-[10px] text-gray-400 mt-1 italic">Login required</p>}
        </div>
    )

    if (disabled) return content
    return <Link href={href}>{content}</Link>
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
        <div className={`p-3 rounded-2xl border ${colors[color]} flex flex-col justify-center`}>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
            <span className="text-lg font-black">{new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    )
}
