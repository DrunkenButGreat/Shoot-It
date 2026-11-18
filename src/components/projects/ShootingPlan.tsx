"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";

type Item = {
  id: string;
  title: string;
  kind: string;
  due: string | null;
  done: boolean;
};
type FileRow = {
  id: string;
  filename: string;
  isVideo: boolean;
  expires: string | null;
};
export function ShootingPlan({
  id,
  editor,
  items,
  images,
  files,
}: {
  id: string;
  editor: boolean;
  items: Item[];
  images: { id: string; filename: string; editStatus: string }[];
  files: FileRow[];
}) {
  const { t, locale } = useI18n(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [links, setLinks] = useState<Record<string, string>>({});
  const tr = (key: string) => t("plan." + key);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  async function send(body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/projects/" + id + "/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error();
      if (body.action === "share") {
        const data = await r.json();
        setLinks((prev) => ({
          ...prev,
          [String(body.id)]: new URL(data.path, window.location.origin).href,
        }));
      }
      if (body.action === "revoke")
        setLinks((prev) => ({ ...prev, [String(body.id)]: "" }));
      router.refresh();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a className="underline" href={"/api/projects/" + id + "/calendar"}>
        {tr("calendar")}
      </a>
      {error && <p role="alert">{tr("error")}</p>}
      {(["shot", "task"] as const).map((kind) => {
        const rows = items.filter((i) => i.kind === kind);
        return (
          <section className="studio-panel space-y-3 p-4" key={kind}>
            <h2 className="text-xl font-bold">
              {tr(kind)} · {rows.filter((i) => i.done).length}/{rows.length}
            </h2>
            {rows.map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center gap-3 border-t py-2"
              >
                <label>
                  <input
                    type="checkbox"
                    checked={i.done}
                    disabled={!editor || busy}
                    onChange={(e) =>
                      send({
                        action: "check",
                        id: i.id,
                        done: e.target.checked,
                      })
                    }
                  />{" "}
                  <span className={i.done ? "line-through" : ""}>
                    {i.title}
                  </span>
                </label>
                {i.due && (
                  <span>
                    {!i.done && new Date(i.due + "T00:00:00") <= today && (
                      <strong>{tr("reminder")}: </strong>
                    )}
                    {new Date(i.due + "T12:00:00").toLocaleDateString(locale)}
                  </span>
                )}
                {editor && (
                  <button
                    className="ml-auto underline"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(tr("confirm")))
                        void send({ action: "remove", id: i.id });
                    }}
                  >
                    {t("common.delete")}
                  </button>
                )}
              </div>
            ))}
            {editor && (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    data = new FormData(form);
                  if (
                    await send({
                      action: "add",
                      kind,
                      title: data.get("title"),
                      due: data.get("due") || null,
                    })
                  )
                    form.reset();
                }}
              >
                <label>
                  {tr("entry")}{" "}
                  <input
                    className="rounded border p-2"
                    name="title"
                    maxLength={240}
                    required
                  />
                </label>
                <label>
                  {tr("due")}{" "}
                  <input
                    className="rounded border p-2"
                    name="due"
                    type="date"
                  />
                </label>
                <Button disabled={busy}>{tr("add")}</Button>
              </form>
            )}
          </section>
        );
      })}
      <section className="studio-panel space-y-3 p-4">
        <h2 className="text-xl font-bold">{tr("processing")}</h2>
        {!images.length && <p>{tr("empty")}</p>}
        {images.map((i) => (
          <label
            className="flex flex-wrap items-center justify-between gap-2 border-t py-2"
            key={i.id}
          >
            {i.filename}{" "}
            <select
              className="rounded border p-2"
              disabled={!editor || busy}
              value={i.editStatus}
              onChange={(e) =>
                send({ action: "status", id: i.id, status: e.target.value })
              }
            >
              {["pending", "editing", "ready"].map((s) => (
                <option key={s} value={s}>
                  {tr(s)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>
      <section className="studio-panel space-y-3 p-4">
        <h2 className="text-xl font-bold">{tr("delivery")}</h2>
        {!files.length && <p>{tr("empty")}</p>}
        {files.map((f) => (
          <div key={f.id} className="space-y-2 border-t py-3">
            <strong>{f.filename}</strong>
            <div className="flex gap-3">
              {(f.isVideo ? ["original"] : ["original", "web"]).map((v) => (
                <a
                  className="underline"
                  key={v}
                  href={"/api/delivery/" + f.id + "?variant=" + v}
                >
                  {tr(v)}
                </a>
              ))}
            </div>
            {editor && (
              <>
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    void send({
                      action: "share",
                      id: f.id,
                      variant: d.get("variant"),
                      days: Number(d.get("days")),
                    });
                  }}
                >
                  <label>
                    {tr("variant")}{" "}
                    <select name="variant" className="border p-2">
                      <option value="original">{tr("original")}</option>
                      {!f.isVideo && <option value="web">{tr("web")}</option>}
                    </select>
                  </label>
                  <label>
                    {tr("days")}{" "}
                    <input
                      className="w-16 border p-2"
                      type="number"
                      name="days"
                      min="1"
                      max="30"
                      defaultValue="7"
                      required
                    />
                  </label>
                  <Button disabled={busy}>
                    {tr(f.expires ? "replace" : "share")}
                  </Button>
                </form>
                {f.expires && (
                  <p>
                    {tr("expires")}:{" "}
                    {new Date(f.expires).toLocaleString(locale)} ·{" "}
                    <button
                      disabled={busy}
                      className="underline"
                      onClick={() => send({ action: "revoke", id: f.id })}
                    >
                      {tr("revoke")}
                    </button>
                  </p>
                )}
                {links[f.id] && (
                  <label>
                    {tr("copy")}{" "}
                    <input
                      className="w-full rounded border p-2"
                      readOnly
                      value={links[f.id]}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                )}
              </>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
