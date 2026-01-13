import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { sendMail } from '@/lib/mail'
import { rm } from 'fs/promises'
import path from 'path'

// PATCH /api/projects/[id]/applications/[applicationId] - Manage application
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; applicationId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, applicationId } = await params
    const body = await request.json()
    const { status } = body // ACCEPTED, REJECTED, WITHDRAWN

    // Fetch the application and project to check ownership
    const application = await prisma.projectApplication.findUnique({
      where: { id: applicationId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          }
        },
        user: true,
      }
    })

    if (!application || application.projectId !== projectId) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const isOwner = application.project.ownerId === session.user.id
    const isApplicant = application.userId === session.user.id

    // Only owner can accept/reject. Applicant can withdraw.
    if (status === 'WITHDRAWN') {
        if (!isApplicant && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    } else {
        if (!isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    const updated = await prisma.projectApplication.update({
      where: { id: applicationId },
      data: { 
          status,
          ...(status === 'REJECTED' && { deletedAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }) // 30 days cleanup
      }
    })

    // If accepted, create a Participant
    if (status === 'ACCEPTED') {
      const existingParticipant = await prisma.participant.findFirst({
        where: {
          projectId,
          OR: [
            { userId: application.userId || undefined },
            { email: application.email || (application.user?.email || undefined) }
          ]
        }
      })

      if (!existingParticipant) {
        await prisma.participant.create({
          data: {
            projectId,
            userId: application.userId,
            name: application.name || application.user?.name || 'Unknown',
            email: application.email || application.user?.email,
            role: application.role || 'Participant',
            notes: `Accepted application: ${application.message}`,
          }
        })
      }
    }

    // Send Email to Applicant
    const applicantEmail = application.email || application.user?.email
    if (applicantEmail) {
        const statusText = status === 'ACCEPTED' ? 'Akzeptiert' : 'Abgelehnt'
        await sendMail({
            to: applicantEmail,
            subject: `Update deiner Bewerbung für ${application.project.name}`,
            text: `Deine Bewerbung für das Projekt "${application.project.name}" wurde ${statusText.toLowerCase()}.`,
            html: `
                <h1>Bewerbung Update</h1>
                <p>Status deiner Bewerbung für <strong>${application.project.name}</strong>:</p>
                <h2 style="color: ${status === 'ACCEPTED' ? 'green' : 'red'}">${statusText}</h2>
                ${status === 'ACCEPTED' ? '<p>Willkommen im Team! Du kannst das Projekt nun in deinem Dashboard sehen.</p>' : '<p>Vielen Dank für dein Interesse. Vielleicht klappt es beim nächsten Mal.</p>'}
            `
        })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/applications/[applicationId] - Withdraw application
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; applicationId: string }> }
) {
  try {
    const session = await auth()
    const { id: projectId, applicationId } = await params

    const application = await prisma.projectApplication.findUnique({
      where: { id: applicationId },
      select: { 
          id: true, 
          projectId: true, 
          userId: true,
          project: { select: { ownerId: true } }
      }
    })

    if (!application || application.projectId !== projectId) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Only applicant or project owner can delete
    const isOwner = session?.user?.id === application.project.ownerId
    const isApplicant = session?.user?.id && session?.user?.id === application.userId

    if (!isOwner && !isApplicant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Physically delete images
    const uploadDir = path.join(process.cwd(), 'uploads', 'applications', projectId, applicationId)
    try {
        await rm(uploadDir, { recursive: true, force: true })
    } catch (e) {
        console.warn('Could not delete application folder:', e)
    }

    await prisma.projectApplication.delete({
      where: { id: applicationId }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
