// Common types
export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
}

export interface Project {
  id: string
  name: string
  description: string | null
  date: Date
  location: string
  address: string | null
  shortCode: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
  ownerId: string
}

export enum ProjectRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum MoodboardStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum RatingColor {
  RED = 'RED',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}
