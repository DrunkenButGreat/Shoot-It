"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail } from "lucide-react";
import { useState } from "react";

interface ApplicationsContentProps {
  projectId: string;
  applications: any[];
  dict: any;
  locale: string;
}

export function ApplicationsContent({
  projectId,
  applications: initialApplications,
  dict,
  locale,
}: ApplicationsContentProps) {
  const [tab, setTab] = useState("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applications, setApplications] = useState(initialApplications);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleUpdateStatus = async (applicationId: string, status: string) => {
    setIsLoading(applicationId);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/applications/${applicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (response.ok) {
        setApplications((apps) =>
          apps.map((app) =>
            app.id === applicationId ? { ...app, status } : app,
          ),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(null);
    }
  };

  const handleDelete = async (applicationId: string) => {
    if (!confirm(dict.common.areYouSure)) return;

    setIsLoading(applicationId);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/applications/${applicationId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        setApplications((apps) =>
          apps.filter((app) => app.id !== applicationId),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            {dict.applications.pending}
          </Badge>
        );
      case "ACCEPTED":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            {dict.applications.accepted}
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            {dict.applications.rejected}
          </Badge>
        );
      case "WITHDRAWN":
        return (
          <Badge
            variant="outline"
            className="bg-gray-50 text-gray-700 border-gray-200"
          >
            {dict.applications.withdrawn}
          </Badge>
        );
      default:
        return null;
    }
  };

  const filtered = applications.filter((app) => app.status === tab);
  const current = filtered.find((app) => app.id === selectedId) || filtered[0];
  return (
    <main className="space-y-6">
      <div>
        <h1 className="studio-page-title">
          {dict.applications.manageApplications}
        </h1>
        <p className="studio-page-subtitle">
          {dict.applications.retentionNote}
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b">
        {[
          ["PENDING", dict.applications.pending],
          ["ACCEPTED", dict.applications.accepted],
          ["REJECTED", dict.applications.rejected],
          ["WITHDRAWN", dict.applications.withdrawn],
        ].map(([status, label]) => (
          <button
            key={status}
            onClick={() => {
              setTab(status);
              setSelectedId(null);
            }}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm ${tab === status ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}
          >
            {label}{" "}
            <span className="ml-1 rounded bg-slate-100 px-1.5 text-xs">
              {applications.filter((app) => app.status === status).length}
            </span>
          </button>
        ))}
      </div>
      {!current ? (
        <div className="studio-panel p-12 text-center text-sm text-slate-500">
          {dict.applications.noApplications}
        </div>
      ) : (
        <div className="grid items-start gap-5 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-2">
            {filtered.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedId(app.id)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${current.id === app.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
              >
                {app.user?.image || app.images?.[0]?.path ? (
                  <img
                    src={
                      app.user?.image ||
                      app.images?.[0]?.thumbnail ||
                      app.images[0].path
                    }
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-sm">
                    {(app.user?.name || app.name || "?").slice(0, 1)}
                  </div>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {app.user?.name || app.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {app.role}
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    {new Date(app.createdAt).toLocaleDateString(locale)}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <article className="studio-panel overflow-hidden">
            {current.images?.[0] && (
              <a href={current.images[0].path} target="_blank" rel="noreferrer">
                <img
                  src={current.images[0].path}
                  alt=""
                  className="aspect-[16/7] w-full object-cover"
                />
              </a>
            )}
            {current.images?.length > 1 && (
              <div className="flex gap-2 px-4 pt-3">
                {current.images.slice(1).map((img: any) => (
                  <a
                    key={img.id}
                    href={img.path}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1"
                  >
                    <img
                      src={img.thumbnail || img.path}
                      alt=""
                      className="aspect-[4/3] w-full rounded object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
            <div className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {current.user?.name || current.name}
                  </h2>
                  <p className="text-sm text-slate-500">{current.role}</p>
                </div>
                {getStatusBadge(current.status)}
              </div>
              <a
                href={`mailto:${current.user?.email || current.email}`}
                className="flex items-center gap-2 text-sm text-slate-500"
              >
                <Mail className="h-4 w-4" />
                {current.user?.email || current.email}
              </a>
              <section>
                <h3 className="mb-2 text-xs font-semibold">
                  {dict.applications.message}
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {current.message}
                </p>
              </section>
              <div className="flex flex-wrap gap-4">
                {current.portfolioUrl && (
                  <a
                    href={current.portfolioUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600"
                  >
                    {dict.applications.viewPortfolio}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {current.instagramUrl && (
                  <a
                    href={`https://instagram.com/${current.instagramUrl.replace("@", "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600"
                  >
                    {current.instagramUrl}
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {current.status !== "WITHDRAWN" && (
                  <>
                    {current.status !== "ACCEPTED" && (
                      <Button
                        className="flex-1"
                        onClick={() =>
                          handleUpdateStatus(current.id, "ACCEPTED")
                        }
                        disabled={isLoading === current.id}
                      >
                        {dict.applications.accept}
                      </Button>
                    )}
                    {current.status !== "REJECTED" && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          handleUpdateStatus(current.id, "REJECTED")
                        }
                        disabled={isLoading === current.id}
                      >
                        {dict.applications.reject}
                      </Button>
                    )}
                  </>
                )}
                {current.status !== "PENDING" && (
                  <Button
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => handleDelete(current.id)}
                    disabled={isLoading === current.id}
                  >
                    {dict.applications.delete}
                  </Button>
                )}
              </div>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
