"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createNewsletter, updateNewsletter } from "@/app/actions";
import { renderNewsletterHtml } from "@/lib/newsletter-render";

const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-slate-200 min-h-32 bg-slate-50" />
    ),
  },
);

const LOGO_URL = "https://meal-planner-pro-puce.vercel.app/jwblogo600.png";
const MAX_IMAGE_WIDTH = 1200;
const JPEG_QUALITY = 0.82;

async function resizeToBlob(file: File): Promise<Blob> {
  // SVGs pass through untouched.
  if (file.type === "image/svg+xml") return file;

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  // Tiny images skip the resize.
  if (img.width <= MAX_IMAGE_WIDTH && file.size < 400_000) return file;

  const ratio = Math.min(1, MAX_IMAGE_WIDTH / img.width);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

async function resizeAndUpload(file: File): Promise<string> {
  const resized = await resizeToBlob(file);
  const fd = new FormData();
  const safeName = file.name?.replace(/\.[^.]+$/, ".jpg") || "image.jpg";
  fd.append("file", resized, safeName);
  const res = await fetch("/api/newsletters/upload-image", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.url as string;
}

interface Article {
  // Existing article id from the DB, when editing. Used to send a
  // "keep this image" reference without re-uploading.
  existingId?: string;
  title: string;
  body: string;
  imageData: string | null;
  imageDirty: boolean;
}

interface NewsletterInitial {
  id?: string;
  title: string;
  intro: string;
  introImage: string | null;
  publishDate: string;
  articles: { existingId?: string; title: string; body: string; imageData: string | null }[];
}

const KEEP_SENTINEL = "__KEEP__";

export function NewsletterComposer({
  initial,
}: {
  initial?: NewsletterInitial;
}) {
  const isEdit = !!initial?.id;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [introImage, setIntroImage] = useState<string | null>(
    initial?.introImage ?? null,
  );
  const [introImageDirty, setIntroImageDirty] = useState(false);
  const [publishDate, setPublishDate] = useState(
    initial?.publishDate ?? new Date().toISOString().slice(0, 10),
  );
  const [articles, setArticles] = useState<Article[]>(
    initial?.articles && initial.articles.length > 0
      ? initial.articles.map((a) => ({
          existingId: a.existingId,
          title: a.title,
          body: a.body,
          imageData: a.imageData,
          imageDirty: false,
        }))
      : [{ title: "", body: "", imageData: null, imageDirty: false }],
  );
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function refreshPreview() {
    const html = renderNewsletterHtml(
      { title, intro, introImage, publishDate, articles },
      LOGO_URL,
    );
    setPreviewHtml(html);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      refreshPreview();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, intro, introImage, publishDate, articles]);

  useEffect(() => {
    if (iframeRef.current && previewHtml) {
      iframeRef.current.srcdoc = previewHtml;
    }
  }, [previewHtml]);

  function updateArticle<K extends keyof Article>(
    index: number,
    field: K,
    value: Article[K],
  ) {
    setArticles((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }

  function addArticle() {
    setArticles((prev) => [
      ...prev,
      { title: "", body: "", imageData: null, imageDirty: true },
    ]);
  }

  function setArticleImage(index: number, data: string | null) {
    setArticles((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, imageData: data, imageDirty: true } : a,
      ),
    );
  }

  function removeArticle(index: number) {
    if (articles.length <= 1) return;
    setArticles((prev) => prev.filter((_, i) => i !== index));
  }

  function moveArticle(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= articles.length) return;
    setArticles((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setIntroImageDirtied(data: string | null) {
    setIntroImage(data);
    setIntroImageDirty(true);
  }

  async function handlePaste(
    e: React.ClipboardEvent<HTMLDivElement>,
    index: number,
  ) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        const url = await resizeAndUpload(file);
        setArticleImage(index, url);
        return;
      }
    }
  }

  async function handleIntroPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        const url = await resizeAndUpload(file);
        setIntroImageDirtied(url);
        return;
      }
    }
  }

  async function handleIntroFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await resizeAndUpload(file);
    setIntroImageDirtied(url);
    e.target.value = "";
  }

  async function handleFile(
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await resizeAndUpload(file);
    setArticleImage(index, url);
    e.target.value = "";
  }

  async function handleCopyHtml() {
    try {
      await navigator.clipboard.writeText(previewHtml);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2400);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      {/* Composer */}
      <form
        action={isEdit ? updateNewsletter : createNewsletter}
        className="panel p-6 space-y-5"
      >
        {isEdit && (
          <input type="hidden" name="newsletterId" value={initial!.id} />
        )}

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? "Edit newsletter" : "New newsletter"}
          </h2>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Title
          </label>
          <input
            className="field"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's cooking with Beth — May edition"
            required
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Publish date
            </label>
            <input
              className="field"
              name="publishDate"
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Intro{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <RichTextEditor
            value={intro}
            onChange={setIntro}
            resizeImage={resizeAndUpload}
            placeholder="A short hello to open the newsletter…"
          />
          <input type="hidden" name="intro" value={intro} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Intro image{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <div
            onPaste={handleIntroPaste}
            className="rounded-lg border border-dashed border-slate-300 p-3 space-y-2"
          >
            {introImage ? (
              <div className="space-y-2">
                <img
                  src={introImage}
                  alt=""
                  className="max-h-48 rounded-md border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setIntroImageDirtied(null)}
                  className="text-xs font-semibold text-red-500 hover:text-red-700"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Paste an image into this box, or{" "}
                <label className="font-semibold text-[var(--accent)] hover:underline cursor-pointer">
                  choose a file
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleIntroFile}
                  />
                </label>
              </div>
            )}
            <input
              type="hidden"
              name="introImage"
              value={
                isEdit && !introImageDirty
                  ? KEEP_SENTINEL
                  : (introImage ?? "")
              }
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-700">
              Articles
            </label>
            <button
              type="button"
              onClick={addArticle}
              className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              + Add article
            </button>
          </div>

          <div className="space-y-4">
            {articles.map((article, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-200 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Article {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveArticle(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move up"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveArticle(index, 1)}
                      disabled={index === articles.length - 1}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move down"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {articles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArticle(index)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Remove"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <input
                  className="field"
                  name="articleTitle"
                  placeholder="Article title"
                  value={article.title}
                  onChange={(e) => updateArticle(index, "title", e.target.value)}
                />

                <div
                  onPaste={(e) => handlePaste(e, index)}
                  className="rounded-lg border border-dashed border-slate-300 p-3 space-y-2"
                >
                  {article.imageData ? (
                    <div className="space-y-2">
                      <img
                        src={article.imageData}
                        alt=""
                        className="max-h-48 rounded-md border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setArticleImage(index, null)}
                        className="text-xs font-semibold text-red-500 hover:text-red-700"
                      >
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Paste an image into this box, or{" "}
                      <label className="font-semibold text-[var(--accent)] hover:underline cursor-pointer">
                        choose a file
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => handleFile(e, index)}
                        />
                      </label>
                    </div>
                  )}
                  <input
                    type="hidden"
                    name="articleImage"
                    value={
                      !article.imageDirty && article.existingId
                        ? KEEP_SENTINEL
                        : (article.imageData ?? "")
                    }
                  />
                  <input
                    type="hidden"
                    name="articleImageRef"
                    value={article.existingId ?? ""}
                  />
                </div>

                <RichTextEditor
                  value={article.body}
                  onChange={(html) => updateArticle(index, "body", html)}
                  resizeImage={resizeAndUpload}
                  placeholder="Article body…"
                />
                <input
                  type="hidden"
                  name="articleBody"
                  value={article.body}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopyHtml}
            className="button-secondary text-sm"
          >
            {copyState === "copied"
              ? "Copied!"
              : copyState === "error"
                ? "Copy failed"
                : "Copy HTML"}
          </button>
          <button type="submit" className="button-primary text-sm">
            {isEdit ? "Save changes" : "Save newsletter"}
          </button>
        </div>
      </form>

      {/* Preview */}
      <div className="panel p-3 lg:sticky lg:top-52 lg:self-start">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Preview
          </span>
          <button
            type="button"
            onClick={refreshPreview}
            className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            Refresh
          </button>
        </div>
        <iframe
          ref={iframeRef}
          title="Newsletter preview"
          className="w-full h-[78vh] rounded-lg border border-slate-200 bg-white"
        />
      </div>
    </div>
  );
}
