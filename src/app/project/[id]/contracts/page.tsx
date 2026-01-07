import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import Link from 'next/link';
import { ContractsContent } from '@/components/contracts/ContractsContent';

export default async function ContractsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

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

  const contracts = await prisma.contract.findMany({
    where: { projectId: id },
    include: {

      signatures: {
        select: {
          id: true,
          signedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const participants = await prisma.participant.findMany({
    where: { projectId: id },
    select: {
      id: true,
      name: true,
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/project/${id}`} className="text-blue-600 hover:underline">
          ← Back to Project
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Contracts - {project.name}</h1>

      <Suspense fallback={<div>Loading...</div>}>
        <ContractsContent
          projectId={id}
          initialContracts={contracts}
          participants={participants}
        />
      </Suspense>
    </div>
  );
}
