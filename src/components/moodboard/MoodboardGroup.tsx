"use client"

import { useState } from "react"
import { Check, MessageSquare, Trash2, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ImageUpload from "./ImageUpload"

import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

interface MoodboardImage {
  id: string
  filename: string
  path: string
  thumbnail: string | null
  order: number
}

interface Comment {
  id: string
  content: string
  createdAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface Group {
  id: string
  name: string
  description: string | null
  order: number
  status: string
  images: MoodboardImage[]
  comments: Comment[]
}

interface MoodboardGroupProps {
  group: Group
  projectId: string
  onUpdate?: () => void
  onDelete?: () => void
}

export function MoodboardGroup({ group, projectId, onUpdate, onDelete }: MoodboardGroupProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [index, setIndex] = useState(-1)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the group "${group.name}"?`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/moodboard/groups/${group.id}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        onDelete?.()
      } else {
        alert("Failed to delete group")
      }
    } catch (error) {
      alert("An error occurred")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/moodboard/groups/${group.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      )

      if (response.ok) {
        onUpdate?.()
      } else {
        alert("Failed to update status")
      }
    } catch (error) {
      alert("An error occurred")
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsAddingComment(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/moodboard/groups/${group.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newComment }),
        }
      )

      if (response.ok) {
        setNewComment("")
        onUpdate?.()
      } else {
        alert("Failed to add comment")
      }
    } catch (error) {
      alert("An error occurred")
    } finally {
      setIsAddingComment(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "bg-green-100 text-green-800 border-green-300"
      case "REJECTED":
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "Accepted"
      case "REJECTED":
        return "Rejected"
      default:
        return "Pending"
    }
  }

  return (
    <ImageUpload
      uploadUrl={`/api/projects/${projectId}/moodboard/groups/${group.id}/images`}
      onSuccess={() => onUpdate?.()}
      className="block"
    >
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle>{group.name}</CardTitle>
                <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(group.status)}`}>
                  {getStatusLabel(group.status)}
                </span>
              </div>
              {group.description && (
                <CardDescription>{group.description}</CardDescription>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChange("ACCEPTED")}
                disabled={group.status === "ACCEPTED"}
              >
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChange("REJECTED")}
                disabled={group.status === "REJECTED"}
              >
                <X className="h-4 w-4 text-red-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageSquare className="h-4 w-4" />
                {group.comments.length > 0 && (
                  <span className="ml-1 text-xs">{group.comments.length}</span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Images placeholder */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {group.images.map((image, i) => (
              <div
                key={image.id}
                className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => setIndex(i)}
              >
                <img
                  src={image.path}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            <div className="aspect-square">
              <ImageUpload
                uploadUrl={`/api/projects/${projectId}/moodboard/groups/${group.id}/images`}
                onSuccess={() => onUpdate?.()}
                className="h-full border-none bg-gray-50/50"
              />
            </div>
          </div>

          <Lightbox
            index={index}
            open={index >= 0}
            close={() => setIndex(-1)}
            slides={group.images.map((img) => ({ src: img.path }))}
          />

          {/* Comments section */}
          {showComments && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">Comments ({group.comments.length})</h4>
              <div className="space-y-3 mb-4">
                {group.comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded p-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm">
                        {comment.user.name || comment.user.email}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  disabled={isAddingComment}
                />
                <Button type="submit" disabled={isAddingComment || !newComment.trim()}>
                  {isAddingComment ? "Adding..." : "Add"}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </ImageUpload>
  )
}
