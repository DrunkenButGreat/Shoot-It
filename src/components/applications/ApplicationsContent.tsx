"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft, 
  ExternalLink, 
  Check, 
  X, 
  Trash2, 
  Instagram, 
  Mail, 
  FileText, 
  Calendar,
  Image as ImageIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ApplicationsContentProps {
  projectId: string
  applications: any[]
  dict: any
  locale: string
}

export function ApplicationsContent({ projectId, applications: initialApplications, dict, locale }: ApplicationsContentProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const handleUpdateStatus = async (applicationId: string, status: string) => {
    setIsLoading(applicationId)
    try {
      const response = await fetch(`/api/projects/${projectId}/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        setApplications(apps => apps.map(app => 
          app.id === applicationId ? { ...app, status } : app
        ))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(null)
    }
  }

  const handleDelete = async (applicationId: string) => {
    if (!confirm(dict.common.areYouSure)) return
    
    setIsLoading(applicationId)
    try {
      const response = await fetch(`/api/projects/${projectId}/applications/${applicationId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setApplications(apps => apps.filter(app => app.id !== applicationId))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{dict.applications.pending}</Badge>
      case 'ACCEPTED':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{dict.applications.accepted}</Badge>
      case 'REJECTED':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{dict.applications.rejected}</Badge>
      case 'WITHDRAWN':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">{dict.applications.withdrawn}</Badge>
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/project/${projectId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {dict.common.back}
              </Button>
            </Link>
            <h1 className="text-lg font-bold">{dict.applications.manageApplications}</h1>
            <div className="w-20" /> {/* Spacer */}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-sm text-gray-500">{dict.applications.retentionNote}</p>
        </div>

        {applications.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{dict.applications.noApplications}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {applications.map((app) => {
              const displayName = app.user?.name || app.name || "Anonymous";
              const displayEmail = app.user?.email || app.email || "";
              const initials = displayName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

              return (
                <Card key={app.id} className={`overflow-hidden transition-all ${app.status === 'REJECTED' ? 'opacity-60 hover:opacity-100' : ''}`}>
                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    {/* Left: Applicant Info */}
                    <div className="p-6 md:w-1/3 lg:w-1/4">
                      <div className="flex items-center gap-3 mb-4">
                        {app.user?.image ? (
                          <img src={app.user.image} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {initials || "?"}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-gray-900 leading-none">{displayName}</h3>
                          <p className="text-xs text-blue-600 font-medium mt-1">{app.role}</p>
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-gray-500">
                            <Mail className="h-3.5 w-3.5" />
                            <span>{displayEmail}</span>
                          </div>
                        </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(app.createdAt).toLocaleDateString(locale)}</span>
                        </div>
                      </div>
                      <div className="pt-2 flex flex-wrap gap-2">
                        {app.portfolioUrl && (
                          <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2">
                              <ExternalLink className="h-3 w-3" />
                              {dict.applications.viewPortfolio}
                            </Button>
                          </a>
                        )}
                        {app.instagramUrl && (
                          <a href={`https://instagram.com/${app.instagramUrl.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 border-pink-100 hover:bg-pink-50 text-pink-600">
                              <Instagram className="h-3 w-3" />
                              {app.instagramUrl}
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{dict.applications.status}</span>
                        {getStatusBadge(app.status)}
                      </div>
                      
                      {app.status === 'PENDING' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            className="bg-green-600 hover:bg-green-700 h-9" 
                            size="sm"
                            disabled={isLoading === app.id}
                            onClick={() => handleUpdateStatus(app.id, 'ACCEPTED')}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {dict.applications.accept}
                          </Button>
                          <Button 
                            variant="outline" 
                            className="text-red-600 border-red-100 hover:bg-red-50 h-9" 
                            size="sm"
                            disabled={isLoading === app.id}
                            onClick={() => handleUpdateStatus(app.id, 'REJECTED')}
                          >
                            <X className="h-4 w-4 mr-1" />
                            {dict.applications.reject}
                          </Button>
                        </div>
                      )}

                      {app.status !== 'PENDING' && (
                        <div className="flex items-center justify-between mt-2">
                           <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[10px] h-7 text-gray-400 hover:text-red-600"
                            onClick={() => handleDelete(app.id)}
                            disabled={isLoading === app.id}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            {dict.applications.delete}
                          </Button>
                          {app.status === 'REJECTED' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[10px] h-7 text-green-600"
                              onClick={() => handleUpdateStatus(app.id, 'ACCEPTED')}
                            >
                              {dict.applications.accept}
                            </Button>
                          )}
                           {app.status === 'ACCEPTED' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[10px] h-7 text-red-600"
                              onClick={() => handleUpdateStatus(app.id, 'REJECTED')}
                            >
                              {dict.applications.reject}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Message */}
                  <div className="p-6 md:flex-1 bg-white">
                     <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{dict.applications.message}</h4>
                     <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                       {app.message}
                     </p>
                  </div>

                  {/* Right: Portfolio Images */}
                  <div className="p-6 md:w-1/3 lg:w-1/4 bg-gray-50/50">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{dict.applications.portfolioImages}</h4>
                    {app.images?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {app.images.map((img: any) => (
                          <a key={img.id} href={img.path} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden group border border-gray-100 hover:border-blue-300 transition-all">
                            <img src={img.path} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <ExternalLink className="h-4 w-4 text-white" />
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <ImageIcon className="h-8 w-8 mb-2 opacity-20" />
                        <span className="text-[10px] italic">{dict.common.noResults}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          </div>
        )}
      </main>
    </div>
  )
}
