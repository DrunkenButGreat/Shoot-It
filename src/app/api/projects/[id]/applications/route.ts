import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { sendMail } from '@/lib/mail'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { generateSecureFilename, validateUpload } from '@/lib/file-utils'

// GET /api/projects/[id]/applications - List applications for the project owner
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Check if user is the project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    })

    if (!project || project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const applications = await prisma.projectApplication.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        },
        images: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(applications)
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/applications - Submit a new application
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const session = await auth()

    // 1. Check if project exists and allows applications
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { 
        id: true, 
        name: true, 
        allowApplications: true,
        owner: { select: { email: true, name: true } }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.allowApplications) {
      return NextResponse.json({ error: 'Applications are closed for this project' }, { status: 400 })
    }

    const formData = await request.formData()
    const token = formData.get('recaptchaToken') as string
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const role = formData.get('role') as string
    const message = formData.get('message') as string
    const portfolioUrl = formData.get('portfolioUrl') as string
    const instagramUrl = formData.get('instagramUrl') as string
    const files = formData.getAll('images') as File[]

    // 2. Verify ReCAPTCHA (only for non-logged in users or as extra security)
    if (!session?.user && !token) {
        return NextResponse.json({ error: 'ReCAPTCHA token is required for guests' }, { status: 400 })
    }
    
    if (token) {
        const isValid = await verifyRecaptcha(token)
        if (!isValid) {
            return NextResponse.json({ error: 'Bot detected or invalid ReCAPTCHA' }, { status: 403 })
        }
    }

    // 3. Validate Guest Fields
    if (!session?.user) {
        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required for guests' }, { status: 400 })
        }
    }

    // 4. Create Application record
    const application = await prisma.projectApplication.create({
      data: {
        projectId,
        userId: session?.user?.id || null,
        name: session?.user ? null : name,
        email: session?.user ? null : email,
        role,
        message,
        portfolioUrl,
        instagramUrl,
      }
    })

    // 5. Handle Image Uploads
    const maxImages = parseInt(process.env.MAX_APPLICATION_IMAGES || '10')
    const imagesToUpload = files.slice(0, maxImages)

    const uploadDir = path.join(process.cwd(), 'uploads', 'applications', projectId, application.id)
    await mkdir(uploadDir, { recursive: true })

    const uploadedImages = []
    for (const file of imagesToUpload) {
        const validation = validateUpload(file)
        if (!validation.valid) continue

        const secureFilename = generateSecureFilename(file.name)
        const filePath = path.join(uploadDir, secureFilename)
        const relativePath = `/api/uploads/applications/${projectId}/${application.id}/${secureFilename}`
        
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(filePath, buffer)

        const img = await prisma.applicationImage.create({
            data: {
                applicationId: application.id,
                filename: file.name,
                path: relativePath,
            }
        })
        uploadedImages.push(img)
    }

    // 6. Send Email Notifications
    // To Owner
    await sendMail({
        to: project.owner.email,
        subject: `Neue Bewerbung für ${project.name}`,
        text: `Es ist eine neue Bewerbung für dein Projekt "${project.name}" eingegangen von ${session?.user?.name || name}.`,
        html: `
            <h1>Neue Bewerbung</h1>
            <p>Es ist eine neue Bewerbung für dein Projekt <strong>${project.name}</strong> eingegangen.</p>
            <p><strong>Bewerber:</strong> ${session?.user?.name || name}</p>
            <p><strong>Nachricht:</strong><br/>${message || 'Keine Nachricht hinterlassen.'}</p>
            <p><a href="${process.env.AUTH_URL}/project/${projectId}">Projekt ansehen</a></p>
        `
    })

    // To Applicant
    const applicantEmail = session?.user?.email || email
    if (applicantEmail) {
        await sendMail({
            to: applicantEmail,
            subject: `Bewerbung eingegangen: ${project.name}`,
            text: `Deine Bewerbung für "${project.name}" wurde erfolgreich übermittelt.`,
            html: `
                <h1>Bewerbung bestätigt</h1>
                <p>Deine Bewerbung für das Projekt <strong>${project.name}</strong> wurde erfolgreich übermittelt.</p>
                <p>Der Projektbesitzer wird deine Bewerbung prüfen.</p>
            `
        })
    }

    return NextResponse.json({ ...application, images: uploadedImages }, { status: 201 })
  } catch (error) {
    console.error('Error submitting application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
