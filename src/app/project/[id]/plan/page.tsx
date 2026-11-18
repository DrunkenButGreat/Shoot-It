import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { canAccessProject, canEditProject } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/lib/i18n";
import { ShootingPlan } from "@/components/projects/ShootingPlan";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params,
    user = (await auth())?.user?.id;
  if (!user || !(await canAccessProject(user, id))) notFound();
  const page = Math.min(
    100000,
    Math.max(1, Number.parseInt((await searchParams).page || "1", 10) || 1),
  );
  const paging = {
    skip: (page - 1) * 40,
    take: 41,
    orderBy: { id: "asc" as const },
  };
  const [project, editor, dict] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id },
      select: {
        name: true,
        planItems: { orderBy: { createdAt: "asc" } },
        selectionImages: {
          ...paging,
          select: { id: true, filename: true, editStatus: true },
        },
        resultImages: {
          ...paging,
          select: {
            id: true,
            filename: true,
            isVideo: true,
            delivery: { select: { expires: true } },
          },
        },
      },
    }),
    canEditProject(user, id),
    getDictionary(getLocale(await cookies())),
  ]);
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
      <Link href={"/project/" + id}>← {project.name}</Link>
      <h1 className="studio-page-title">{dict.plan.title}</h1>
      <ShootingPlan
        id={id}
        editor={editor}
        items={project.planItems.map((i) => ({
          ...i,
          due: i.due?.toISOString().slice(0, 10) ?? null,
        }))}
        images={project.selectionImages.slice(0, 40)}
        files={project.resultImages
          .slice(0, 40)
          .map((f) => ({
            ...f,
            expires: f.delivery?.expires.toISOString() ?? null,
          }))}
      />
      <nav className="flex gap-4">
        {page > 1 && (
          <Link href={"?page=" + (page - 1)}>← {dict.plan.prev}</Link>
        )}
        {Math.max(project.selectionImages.length, project.resultImages.length) >
          40 && <Link href={"?page=" + (page + 1)}>{dict.plan.next} →</Link>}
      </nav>
    </main>
  );
}
