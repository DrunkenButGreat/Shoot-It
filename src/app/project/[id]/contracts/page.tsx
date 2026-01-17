import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import Link from 'next/link';
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractsContent } from '@/components/contracts/ContractsContent';

export default async function ContractsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login")
  }

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project || !(await canAccessProject(session.user.id, id))) {
    redirect('/dashboard');
  }

  const [contracts, participants] = await Promise.all([
    prisma.contract.findMany({
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
    }),
    prisma.participant.findMany({
      where: { projectId: id },
      select: {
        id: true,
        name: true,
      },
    })
  ]);

  return (
    <div className="flex-1 bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href={`/project/${id}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Zurück zum Projekt
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">Contracts</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div>Loading...</div>}>
          <ContractsContent
            projectId={id}
            initialContracts={contracts as any}
            participants={participants}
          />
        </Suspense>
      </main>
    </div>
  );
}
