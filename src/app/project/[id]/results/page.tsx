import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import Link from 'next/link';
import { ResultsContent } from '@/components/results/ResultsContent';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocale, getDictionary } from '@/lib/i18n';
import { cookies } from 'next/headers';

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const cookieStore = await cookies();
  const locale = getLocale(cookieStore);
  const dict = await getDictionary(locale);

  if (!session?.user?.id) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect('/login');
  }

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project || !(await canAccessProject(user.id, project.id))) {
    redirect('/dashboard');
  }

  const folders = await prisma.resultFolder.findMany({
    where: { projectId: id },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          images: true,
        },
      },
      images: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rootImages = await prisma.resultFile.findMany({
    where: { 
      projectId: id,
      folderId: null
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="flex-1 bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/project/${id}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {dict.common.backToProject}
              </Button>
            </Link>
            <h1 className="text-xl font-semibold text-gray-900 line-clamp-1">
              {dict.project.results} - {project.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">{dict.common.loading}</div>}>
          <ResultsContent
            projectId={id}
            initialFolders={folders}
            rootImages={rootImages}
            layout={project.galleryLayout}
          />
        </Suspense>
      </main>
    </div>
  );
}
