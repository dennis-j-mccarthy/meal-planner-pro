"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useEffect, useRef } from "react";



interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  resizeImage?: (file: File) => Promise<string>;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  resizeImage,
}: RichTextEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({
        HTMLAttributes: {
          style: "max-width:100%;height:auto;border-radius:6px;",
        },
      }),
    ],
    content: value || "<p></p>",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-32 px-3 py-2 focus:outline-none [&_p]:my-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-[var(--accent)] [&_a]:underline",
      },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;
        if (!items || !resizeImage) return false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (!file) continue;
            event.preventDefault();
            resizeImage(file).then((src) => {
              editorRef.current?.chain().focus().setImage({ src }).run();
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // Track editor for closures that need a live reference.
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Keep external value in sync (e.g., when initial loads after first render).
  const lastApplied = useRef<string>(value);
  useEffect(() => {
    if (!editor) return;
    if (value === lastApplied.current) return;
    lastApplied.current = value;
    const current = editor.getHTML();
    if (current !== (value || "<p></p>")) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-slate-200 min-h-32 bg-slate-50" />
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Toolbar editor={editor} resizeImage={resizeImage} />
      <EditorContent
        editor={editor}
        className="border-t border-slate-200"
        data-placeholder={placeholder}
      />
    </div>
  );
}

function Toolbar({
  editor,
  resizeImage,
}: {
  editor: Editor;
  resizeImage?: (file: File) => Promise<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function btnClass(active: boolean) {
    return `rounded px-2 py-1 text-xs font-semibold ${
      active
        ? "bg-slate-200 text-slate-900"
        : "text-slate-600 hover:bg-slate-100"
    }`;
  }

  function promptLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave blank to remove)", prev ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = resizeImage ? await resizeImage(file) : await fileToDataUrl(file);
    editor.chain().focus().setImage({ src }).run();
    e.target.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive("bold"))}
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive("italic"))}
        title="Italic"
      >
        <em>I</em>
      </button>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive("heading", { level: 2 }))}
        title="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive("heading", { level: 3 }))}
        title="Heading 3"
      >
        H3
      </button>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive("bulletList"))}
        title="Bullet list"
      >
        •
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive("orderedList"))}
        title="Numbered list"
      >
        1.
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive("blockquote"))}
        title="Quote"
      >
        “”
      </button>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <button
        type="button"
        onClick={promptLink}
        className={btnClass(editor.isActive("link"))}
        title="Link"
      >
        🔗
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={btnClass(false)}
        title="Insert image"
      >
        🖼
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleImageFile}
      />
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <button
        type="button"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
        className={btnClass(false)}
        title="Clear formatting"
      >
        ⨯
      </button>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
