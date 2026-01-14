import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { rm } from 'fs/promises'
import path from 'path'

export async function GET() {
  // Background cleanup for old applications
  try {
    const oldApplications = await prisma.projectApplication.findMany({
      where: {
        deletedAt: {
          lt: new Date()
        }
      },
      include: {
        images: true
      }
    })

    if (oldApplications.length > 0) {
      for (const app of oldApplications) {
        // Delete images from disk
        const appDir = path.join(process.cwd(), 'uploads', 'applications', app.projectId, app.id)
        try {
          await rm(appDir, { recursive: true, force: true })
        } catch (e) {
          console.error(`Failed to delete application images for ${app.id}:`, e)
        }

        // Delete from database (cascade handles images)
        await prisma.projectApplication.delete({
          where: { id: app.id }
        })
      }
      console.log(`Cleaned up ${oldApplications.length} expired applications.`)
    }
  } catch (error) {
    console.error('Cleanup error:', error)
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    cleanup: 'done'
  })
}
