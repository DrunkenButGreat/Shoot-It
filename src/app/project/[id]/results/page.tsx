import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import Link from 'next/link';
import { ResultsContent } from '@/components/results/ResultsContent';

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    redirect('/login');
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
  });

  if (!project || !(await canAccessProject(user.id, project.id))) {
    redirect('/dashboard');
  }

  const folders = await prisma.resultsFolder.findMany({
    where: { projectId: params.id },
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
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/project/${params.id}`} className="text-blue-600 hover:underline">
          ← Back to Project
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Results - {project.name}</h1>

      <Suspense fallback={<div>Loading...</div>}>
        <ResultsContent 
          projectId={params.id} 
          initialFolders={folders}
        />
      </Suspense>
    </div>
  );
}
