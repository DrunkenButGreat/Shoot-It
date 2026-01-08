"use client"

import { useRouter } from "next/navigation"
import { ProjectForm } from "./ProjectForm"

interface ProjectActionsProps {
    project: {
        id: string
        name: string
        description: string | null
        date: Date | null
        location: string | null
        address: string | null
        isPublic: boolean
        showMoodboardPublicly: boolean
        showParticipantsPublicly: boolean
        showContractsPublicly: boolean
        showSelectionPublicly: boolean
        showCallsheetPublicly: boolean
        showResultsPublicly: boolean
    }
}

export function ProjectActions({ project }: ProjectActionsProps) {
    const router = useRouter()

    return (
        <ProjectForm
            initialData={project}
            onSuccess={() => router.refresh()}
        />
    )
}
