import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import Link from 'next/link';
import { CallsheetContent } from '@/components/callsheet/CallsheetContent';

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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/project/${id}`} className="text-blue-600 hover:underline">
          ← Back to Project
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Callsheet - {project.name}</h1>

      <Suspense fallback={<div>Loading...</div>}>
        <CallsheetContent
          projectId={id}
          initialCallsheet={transformedCallsheet}
        />
      </Suspense>
    </div>
  );
}
