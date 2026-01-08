import { z } from 'zod'

export const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  date: z.string().datetime().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional(),
  isArchived: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  showMoodboardPublicly: z.boolean().optional(),
  showParticipantsPublicly: z.boolean().optional(),
  showContractsPublicly: z.boolean().optional(),
  showSelectionPublicly: z.boolean().optional(),
  showCallsheetPublicly: z.boolean().optional(),
  showResultsPublicly: z.boolean().optional(),
  galleryLayout: z.string().optional(),
})

export const participantSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  role: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
})

export const contractSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
})

export const signatureSchema = z.object({
  signature: z.string().min(1), // Base64
  name: z.string().min(1).max(100),
  email: z.string().email(),
})

export const ratingSchema = z.object({
  stars: z.number().min(1).max(5).optional().nullable(),
  color: z.enum(['RED', 'YELLOW', 'GREEN']).optional().nullable(),
})

export const callsheetSchema = z.object({
  callTime: z.string().datetime().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  wrapTime: z.string().datetime().optional(),
  locationName: z.string().max(200).optional(),
  locationAddress: z.string().max(500).optional(),
  locationNotes: z.string().max(5000).optional(),
  parkingInfo: z.string().max(2000).optional(),
  emergencyContact: z.string().max(100).optional(),
  emergencyPhone: z.string().max(50).optional(),
  weatherInfo: z.string().max(500).optional(),
  dresscode: z.string().max(500).optional(),
  equipmentList: z.string().max(5000).optional(),
  additionalNotes: z.string().max(5000).optional(),
})

export const moodboardGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
})

export const commentSchema = z.object({
  content: z.string().min(1).max(5000),
})

export const scheduleItemSchema = z.object({
  time: z.string().datetime(),
  duration: z.number().int().optional(),
  activity: z.string().min(1).max(200),
  notes: z.string().max(1000).optional(),
  order: z.number().int().default(0),
})

export const resultFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().optional(),
})

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
})
