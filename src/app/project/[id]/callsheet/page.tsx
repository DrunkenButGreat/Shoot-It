import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import Link from 'next/link';
import { CallsheetContent } from '@/components/callsheet/CallsheetContent';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function CallsheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
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

  const callsheet = await prisma.callsheet.findUnique({
    where: { projectId: id },
    include: {
      scheduleItems: {
        orderBy: { time: 'asc' },
      },
    },
  });

  // Transform callsheet data to match component props (Date -> string)
  const transformedCallsheet = callsheet ? {
    ...callsheet,
    scheduleItems: callsheet.scheduleItems.map(item => ({
      ...item,
      time: item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }))
  } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/project/${id}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Zurück zum Projekt
              </Button>
            </Link>
            <h1 className="text-xl font-semibold text-gray-900 line-clamp-1">
              Callsheet - {project.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">Lädt...</div>}>
          <CallsheetContent
            projectId={id}
            initialCallsheet={transformedCallsheet}
          />
        </Suspense>
      </main>
    </div>
  );
}
