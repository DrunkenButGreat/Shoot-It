import { getParticipantPortrait } from "@/lib/participant-portrait";
import { auth } from "@/auth";
import { ProjectActions } from "@/components/projects/ProjectActions";
import { ProjectCover } from "@/components/projects/ProjectCover";
import { PublicLinkCard } from "@/components/projects/PublicLinkCard";
import { getDictionary, getLocale } from "@/lib/i18n";
import { canAccessProject } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FolderKanban,
  Images,
  MapPin,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  if (!(await canAccessProject(session.user.id, id))) redirect("/dashboard");
  const cookieStore = await cookies();
  const locale = getLocale(cookieStore);
  const [dict, project] = await Promise.all([
    getDictionary(locale),
    prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        _count: {
          select: {
            moodboardLinks: true,
            participants: true,
            contracts: true,
            selectionImages: true,
            resultFolders: true,
            applications: true,
            appointmentSlots: true,
          },
        },
        participants: {
          take: 5,
          select: {
            id: true,
            name: true,
            user: { select: { image: true } },
            images: { take: 1, orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
          },
        },
        selectionImages: { take: 3, select: { path: true, thumbnail: true } },
        resultImages: { take: 3, select: { path: true, thumbnail: true } },
        moodboardLinks: {
          take: 1,
          orderBy: { order: "asc" },
          include: {
            group: {
              include: { images: { take: 3, orderBy: { order: "asc" } } },
            },
          },
        },
      },
    }),
  ]);
  if (!project) redirect("/dashboard");
  const projectDate = project.date ? new Date(project.date) : null;
  const isOwner = project.ownerId === session.user.id;
  const hero =
    project.brandingImage ||
    project.moodboardLinks[0]?.group.images[0]?.thumbnail ||
    project.moodboardLinks[0]?.group.images[0]?.path;
  const modules: Array<[string, string, string, LucideIcon]> = [
    [
      dict.project.moodboard,
      dict.project.groups.replace(
        "{count}",
        String(project._count.moodboardLinks),
      ),
      `/project/${id}/moodboard`,
      Images,
    ],
    [
      dict.project.participants,
      dict.project.people.replace(
        "{count}",
        String(project._count.participants),
      ),
      `/project/${id}/participants`,
      Users,
    ],
    [
      dict.project.selection,
      dict.project.imagesCount.replace(
        "{count}",
        String(project._count.selectionImages),
      ),
      `/project/${id}/selection`,
      UserRoundSearch,
    ],
    [
      dict.project.contracts,
      dict.project.contractsCount.replace(
        "{count}",
        String(project._count.contracts),
      ),
      `/project/${id}/contracts`,
      FileSignature,
    ],
    [
      dict.project.callsheet,
      dict.callsheet.subtitle,
      `/project/${id}/callsheet`,
      ClipboardList,
    ],
    [
      dict.project.results,
      dict.project.foldersCount.replace(
        "{count}",
        String(project._count.resultFolders),
      ),
      `/project/${id}/results`,
      FolderKanban,
    ],
  ];
  if (project.allowAppointments)
    modules.push([
      dict.project.appointments,
      `${project._count.appointmentSlots} ${dict.project.appointmentSuggestions}`,
      `/project/${id}/appointments`,
      CalendarDays,
    ]);
  if (isOwner && (project.allowApplications || project._count.applications > 0))
    modules.push([
      dict.applications.manageApplications,
      `${project._count.applications} ${dict.applications.pending}`,
      `/project/${id}/applications`,
      Users,
    ]);

  return (
    <main className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="studio-page-title">{project.name}</h1>
          {project.description && (
            <p className="studio-page-subtitle">{project.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-500">
            {projectDate && (
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {projectDate.toLocaleDateString(locale)}
              </span>
            )}
            {project.location && (
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {project.location}
              </span>
            )}
          </div>
        </div>
        {isOwner && <ProjectActions project={project} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-4">
          <ProjectCover projectId={id} image={hero} editable={isOwner} />
          <section aria-label={dict.project.projectModules}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map(([title, subtitle, href, Icon]) => (
                <Link
                  href={href}
                  key={href}
                  className="studio-panel group flex min-h-32 flex-col p-4 transition-colors hover:border-slate-300"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-blue-600">→</span>
                  </div>
                  <h3 className="font-semibold text-slate-950">{title}</h3>
                  {(() => {
                    const previews = href.endsWith("/moodboard")
                      ? project.moodboardLinks.flatMap((link) =>
                          link.group.images.map(
                            (img) => img.thumbnail || img.path,
                          ),
                        )
                      : href.endsWith("/selection")
                        ? project.selectionImages.map(
                            (img) => img.thumbnail || img.path,
                          )
                        : href.endsWith("/results")
                          ? project.resultImages.map(
                              (img) => img.thumbnail || img.path,
                            )
                          : href.endsWith("/participants")
                            ? project.participants
                                .map(
                                  (person) =>
                                    getParticipantPortrait(person),
                                )
                                .filter((src): src is string => !!src)
                            : [];
                    return (
                      previews.length > 0 && (
                        <div className="my-3 flex h-20 gap-1 overflow-hidden rounded-md">
                          {previews.map((src, i) => (
                            <img
                              key={i}
                              src={src}
                              alt=""
                              className="min-w-0 flex-1 object-cover"
                            />
                          ))}
                        </div>
                      )
                    );
                  })()}
                  <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="studio-panel p-5">
            <h2 className="mb-4 text-lg font-bold text-slate-950">
              {dict.project.shootingDetails}
            </h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">
                  {dict.projectForm.date}
                </dt>
                <dd className="mt-1 font-medium">
                  {projectDate
                    ? projectDate.toLocaleDateString(locale)
                    : dict.common.tbd}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">
                  {dict.projectForm.location}
                </dt>
                <dd className="mt-1 font-medium">
                  {project.location || dict.common.tbd}
                </dd>
                {project.address && (
                  <dd className="text-xs text-slate-500">{project.address}</dd>
                )}
              </div>
              <div>
                <dt className="text-xs text-slate-500">{dict.common.owner}</dt>
                <dd className="mt-1 font-medium">
                  {project.owner.name || project.owner.email}
                </dd>
              </div>
            </dl>
          </section>
          <PublicLinkCard project={project as any} />
        </aside>
      </div>
    </main>
  );
}
