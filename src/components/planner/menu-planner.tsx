"use client";

import { Eye, History, Plus, Send, Star, Undo2, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { approveProposal, emailProposalLinkToClient, sendProposal } from "@/app/actions";
import {
  addDish,
  addFavorites,
  fillOpenSlots,
  reloadPlannerDishes,
  removeDish,
  reorderDishes,
  restoreDish,
  setDishCategory,
  startFromLastMenu,
  suggestSwaps,
  swapDish,
  undoAdds,
} from "@/app/planner-actions";
import type { DishQuotaRow } from "@/lib/dish-quota";
import { DishCard, type DishDrag, type SwapState } from "./dish-card";
import { Finder, useFinder } from "./finder";
import {
  groupDishes,
  OTHER_SLOT,
  openSlots,
  singularLabel,
  slotNames,
  withArticle,
  type PlannerDish,
  type RecipeHit,
} from "./planner-logic";
import { PreviewModal } from "./preview-modal";
import { BTN_PRIMARY, BTN_QUIET, CARD, DISPLAY_FONT, FOCUS } from "./ui";

type Fail = { ok: false; error: string };
type Toast = { id: number; message: string; undo?: () => void };
type Restore = { proposalId: string; recipeId: string; courseLabel: string | null; position: number };

// Drag and drop runs on desktop only (md and up). Phones keep the tap flow:
// iOS would otherwise start an HTML5 drag on long-press.
const DESKTOP_QUERY = "(min-width: 768px)";
function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

type DragItem = { kind: "recipe"; hit: RecipeHit } | { kind: "dish"; dish: PlannerDish };
/** Where a drop would land: before a dish in a group (null = end of the group), or the recipe list. */
type DropTarget = { kind: "slot"; group: string; beforeId: string | null } | { kind: "finder" };

function sameTarget(a: DropTarget | null, b: DropTarget | null) {
  if (!a || !b) return a === b;
  if (a.kind === "finder" || b.kind === "finder") return a.kind === b.kind;
  return a.group === b.group && a.beforeId === b.beforeId;
}

/** Course label for a group ("Other" = no label). */
function courseFor(group: string): string | null {
  return group === OTHER_SLOT ? null : group;
}

/** A small accent chip with the dish title, used as the drag image. */
function setDragGhost(e: React.DragEvent, title: string) {
  e.dataTransfer.setData("text/plain", title); // Firefox needs data to start a drag
  const ghost = document.createElement("div");
  ghost.textContent = title;
  ghost.style.cssText =
    "position:fixed;top:-1000px;left:-1000px;max-width:280px;padding:8px 14px;border-radius:10px;" +
    "font:600 14px/1.3 system-ui,-apple-system,sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" +
    "background:linear-gradient(135deg,var(--accent),var(--accent-strong));box-shadow:0 8px 20px rgba(15,23,42,.25);";
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 16, 16);
  setTimeout(() => ghost.remove(), 0);
}

export type MenuPlannerProps = {
  proposalId: string;
  /** Where "Send menu to client" lands: the cook date's steps. */
  cookDateId: string;
  status: string;
  editable: boolean;
  shareToken: string | null;
  firstName: string;
  clientEmail: string | null;
  crumb: React.ReactNode;
  dateLabel: string;
  statusPanel?: React.ReactNode;
  quota: DishQuotaRow[];
  safety: string[];
  initialDishes: PlannerDish[];
  initialResults: RecipeHit[];
  lastMenuLabel: string | null;
  favoriteCount: number;
};

export function MenuPlanner(props: MenuPlannerProps) {
  const {
    proposalId,
    cookDateId,
    status,
    editable,
    firstName,
    clientEmail,
    quota,
    safety,
  } = props;
  const router = useRouter();
  const finder = useFinder(proposalId, props.initialResults);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastSeq = useRef(0);
  const swapSeq = useRef(0);

  const [dishes, setDishes] = useState<PlannerDish[]>(props.initialDishes);
  const [inflight, setInflight] = useState(0);
  const [saveState, setSaveState] = useState<"none" | "saved" | "error">("none");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [draftBusy, setDraftBusy] = useState<null | "last" | "fav" | "fill">(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [swapState, setSwapState] = useState<SwapState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [send, setSend] = useState<"idle" | "confirm" | "sending">("idle");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);

  // ---------------------------------------------------------- drag and drop state
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  const dnd = editable && desktop;
  const dragItem = useRef<DragItem | null>(null);
  const [dragKind, setDragKind] = useState<null | "recipe" | "dish">(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  // Latest dishes for async follow-ups (add, then place where it was dropped).
  const dishesRef = useRef(dishes);
  useEffect(() => {
    dishesRef.current = dishes;
  }, [dishes]);

  // Toasts fade on their own; ones with Undo linger a little longer.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(
      () => setToast((cur) => (cur?.id === toast.id ? null : cur)),
      toast.undo ? 8000 : 4500,
    );
    return () => clearTimeout(t);
  }, [toast]);

  // Escape closes the phone bottom sheet.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // ---------------------------------------------------------- derived
  const slots = slotNames(quota);
  const groups = groupDishes(dishes, quota);
  const open = openSlots(dishes, quota);
  const slotsLeft = [...open.values()].reduce((a, b) => a + b, 0);
  const firstOpenSlot = quota.find((q) => open.has(q.category))?.category ?? null;
  const onMenu = new Set(dishes.map((d) => d.recipeId));
  const dishCount = dishes.filter((d) => !d.clientRemoved).length;
  // Sending again clears the client's skips, so skipped dishes still here go back out.
  const skippedStill = dishes.length - dishCount;
  const hasQuota = quota.length > 0;
  // While dragging, show every course as a drop zone, even ones with no dishes yet.
  const displayGroups = dragKind
    ? [
        ...slots.map((name) => groups.find((g) => g.name === name) ?? { name, target: null, dishes: [] }),
        ...groups.filter((g) => !slots.includes(g.name)),
      ]
    : groups;

  // ---------------------------------------------------------- helpers
  function showToast(message: string, undo?: () => void) {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, message, undo });
  }

  /** Run a write, keep the quiet "Saved" indicator honest, surface failures inline. */
  async function save<R extends { ok: boolean }>(p: Promise<R>): Promise<R | null> {
    setInflight((n) => n + 1);
    try {
      const res = await p;
      if (res.ok) {
        setSaveState("saved");
      } else {
        setSaveState("error");
        setError((res as unknown as Fail).error);
      }
      return res;
    } catch {
      setSaveState("error");
      setError("Couldn't save that change. Check your connection and try again.");
      return null;
    } finally {
      setInflight((n) => n - 1);
    }
  }

  function openFinder(category: string | null) {
    if (category !== finder.filters.category) finder.setCategory(category);
    setSheetOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // ---------------------------------------------------------- dish actions
  function addHit(hit: RecipeHit, target?: { course: string | null; group: string; beforeId: string | null }) {
    if (!editable || onMenu.has(hit.id)) return;
    const course = target ? target.course : (finder.filters.category ?? hit.category ?? firstOpenSlot ?? null);
    const tempId = `tmp-${hit.id}`;
    const temp: PlannerDish = {
      id: tempId,
      recipeId: hit.id,
      title: hit.title,
      description: hit.description,
      tags: null,
      courseLabel: course,
      position: dishes.reduce((m, d) => Math.max(m, d.position), 0) + 1,
      keptLastTime: false,
      servedLabel: hit.recentlyServed ? hit.lastServedLabel : null,
      clientRemoved: false,
      conflict: hit.conflict,
    };
    setDishes((ds) => [...ds, temp]);
    void save(addDish(proposalId, hit.id, course)).then((res) => {
      if (res && res.ok) {
        const dish = res.dish;
        setDishes((ds) => {
          const swapped = ds.map((d) => (d.id === tempId ? dish : d));
          return swapped.filter((d, i) => swapped.findIndex((x) => x.id === d.id) === i);
        });
        showToast(`Added “${hit.title}” to ${course ?? OTHER_SLOT}.`, () => remove(dish, true));
        // Dropped onto a dish: move the new one in front of it.
        if (target?.beforeId) {
          const list = dishesRef.current.map((d) => (d.id === tempId ? dish : d));
          if (!list.some((d) => d.id.startsWith("tmp-"))) {
            applyOrder(list, orderedWith(list, dish.id, target.group, target.beforeId));
          }
        }
      } else {
        setDishes((ds) => ds.filter((d) => d.id !== tempId));
      }
    });
  }

  function restore(r: Restore, dish: PlannerDish) {
    const tempId = `tmp-${dish.recipeId}`;
    setToast(null);
    setDishes((ds) => [...ds, { ...dish, id: tempId }]);
    void save(restoreDish(r.proposalId, r.recipeId, r.courseLabel, r.position)).then((res) => {
      if (res && res.ok) setDishes((ds) => ds.map((d) => (d.id === tempId ? res.dish : d)));
      else setDishes((ds) => ds.filter((d) => d.id !== tempId));
    });
  }

  function remove(dish: PlannerDish, quiet = false) {
    if (swapFor === dish.id) closeSwap();
    if (quiet) setToast(null);
    setDishes((ds) => ds.filter((d) => d.id !== dish.id));
    void save(removeDish(dish.id)).then((res) => {
      if (!res || !res.ok) {
        setDishes((ds) => (ds.some((d) => d.id === dish.id) ? ds : [...ds, dish]));
        return;
      }
      if (!quiet) showToast(`Removed “${dish.title}”.`, () => restore(res.restore, dish));
    });
  }

  function setCourse(dish: PlannerDish, value: string | null) {
    const before = dish.courseLabel;
    setDishes((ds) => ds.map((d) => (d.id === dish.id ? { ...d, courseLabel: value } : d)));
    void save(setDishCategory(dish.id, value)).then((res) => {
      if (!res || !res.ok) {
        setDishes((ds) => ds.map((d) => (d.id === dish.id ? { ...d, courseLabel: before } : d)));
      }
    });
  }

  function closeSwap() {
    swapSeq.current += 1;
    setSwapFor(null);
    setSwapState(null);
  }

  async function openSwap(dish: PlannerDish) {
    const mine = ++swapSeq.current;
    setSwapFor(dish.id);
    setSwapState({ status: "loading" });
    try {
      const res = await suggestSwaps(dish.id);
      if (mine !== swapSeq.current) return;
      setSwapState(res.ok ? { status: "ready", options: res.options } : { status: "error", message: res.error });
    } catch {
      if (mine === swapSeq.current) setSwapState({ status: "error", message: "Couldn't load alternatives. Try again." });
    }
  }

  function applySwap(dish: PlannerDish, toRecipeId: string, preview: Partial<PlannerDish>, onDone?: (d: PlannerDish) => void) {
    setDishes((ds) => ds.map((d) => (d.id === dish.id ? { ...d, ...preview, recipeId: toRecipeId } : d)));
    void save(swapDish(dish.id, toRecipeId)).then((res) => {
      if (res && res.ok) {
        setDishes((ds) => ds.map((d) => (d.id === dish.id ? res.dish : d)));
        onDone?.(res.dish);
      } else {
        setDishes((ds) => ds.map((d) => (d.id === dish.id ? dish : d)));
      }
    });
  }

  function pickSwap(dish: PlannerDish, hit: RecipeHit) {
    closeSwap();
    applySwap(
      dish,
      hit.id,
      {
        title: hit.title,
        description: hit.description,
        keptLastTime: false,
        servedLabel: null,
        clientRemoved: false,
        conflict: hit.conflict,
      },
      (now) =>
        showToast(`Swapped in “${hit.title}”.`, () => {
          setToast(null);
          applySwap(now, dish.recipeId, dish);
        }),
    );
  }

  // ---------------------------------------------------------- drag and drop
  /** Dish ids in their new order: `movingId` goes before `beforeId`, or after the last dish of `group`. */
  function orderedWith(list: PlannerDish[], movingId: string, group: string, beforeId: string | null): string[] {
    const rest = [...list].sort((a, b) => a.position - b.position).filter((d) => d.id !== movingId);
    let at = beforeId ? rest.findIndex((d) => d.id === beforeId) : -1;
    if (at < 0) {
      const inGroup = new Set(
        (groupDishes(rest, quota).find((g) => g.name === group)?.dishes ?? []).map((d) => d.id),
      );
      let last = -1;
      rest.forEach((d, i) => {
        if (inGroup.has(d.id)) last = i;
      });
      at = last >= 0 ? last + 1 : rest.length;
    }
    const ids = rest.map((d) => d.id);
    ids.splice(at, 0, movingId);
    return ids;
  }

  /** Save a new order (and optionally a new course for the moved dish); roll back if it fails. */
  function applyOrder(list: PlannerDish[], ids: string[], moved?: { id: string; courseLabel: string | null }) {
    const rank = new Map(ids.map((id, i) => [id, i + 1]));
    const previous = list.map((d) => ({ id: d.id, position: d.position, courseLabel: d.courseLabel }));
    setDishes((ds) =>
      ds.map((d) => {
        const position = rank.get(d.id) ?? d.position;
        return moved && d.id === moved.id ? { ...d, position, courseLabel: moved.courseLabel } : { ...d, position };
      }),
    );
    void save(reorderDishes(proposalId, ids, moved ?? null)).then((res) => {
      if (res && res.ok) return;
      const back = new Map(previous.map((p) => [p.id, p]));
      setDishes((ds) =>
        ds.map((d) => {
          const p = back.get(d.id);
          return p ? { ...d, position: p.position, courseLabel: p.courseLabel } : d;
        }),
      );
    });
  }

  function moveDish(dish: PlannerDish, group: string, beforeId: string | null) {
    if (beforeId === dish.id) return;
    if (inflight > 0 || dishes.some((d) => d.id.startsWith("tmp-"))) {
      showToast("Still saving the last change. Try again in a moment.");
      return;
    }
    const from = groups.find((g) => g.dishes.some((d) => d.id === dish.id))?.name ?? null;
    const changeCourse = from !== group;
    const ids = orderedWith(dishes, dish.id, group, beforeId);
    const current = [...dishes].sort((a, b) => a.position - b.position).map((d) => d.id);
    if (!changeCourse && ids.every((id, i) => id === current[i])) return;
    applyOrder(dishes, ids, changeCourse ? { id: dish.id, courseLabel: courseFor(group) } : undefined);
    if (changeCourse) showToast(`Moved “${dish.title}” to ${group}.`);
  }

  function startDrag(e: React.DragEvent, item: DragItem) {
    dragItem.current = item;
    e.dataTransfer.effectAllowed = item.kind === "recipe" ? "copy" : "move";
    setDragGhost(e, item.kind === "recipe" ? item.hit.title : item.dish.title);
    if (swapFor) closeSwap();
    // Changing the DOM inside dragstart can cancel the drag in Chrome.
    requestAnimationFrame(() => {
      if (dragItem.current !== item) return; // the drag already ended
      setDragKind(item.kind);
      setDraggingId(item.kind === "dish" ? item.dish.id : null);
    });
  }

  function endDrag() {
    dragItem.current = null;
    setDragKind(null);
    setDraggingId(null);
    setDropTarget(null);
  }

  function dragOver(e: React.DragEvent, target: DropTarget) {
    const item = dragItem.current;
    if (!item) return;
    if (target.kind === "finder" && item.kind !== "dish") return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = item.kind === "recipe" ? "copy" : "move";
    setDropTarget((prev) => (sameTarget(prev, target) ? prev : target));
  }

  function dragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropTarget(null);
  }

  function drop(e: React.DragEvent, target: DropTarget) {
    const item = dragItem.current;
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    endDrag();
    if (target.kind === "finder") {
      if (item.kind === "dish") remove(item.dish);
      return;
    }
    if (item.kind === "recipe") {
      addHit(item.hit, { course: courseFor(target.group), group: target.group, beforeId: target.beforeId });
    } else {
      moveDish(item.dish, target.group, target.beforeId);
    }
  }

  function dishDrag(dish: PlannerDish, group: string): DishDrag | undefined {
    if (!dnd) return undefined;
    const target: DropTarget = { kind: "slot", group, beforeId: dish.id };
    return {
      onDragStart: (e) => startDrag(e, { kind: "dish", dish }),
      onDragEnd: endDrag,
      onDragOver: (e) => dragOver(e, target),
      onDrop: (e) => drop(e, target),
      dropBefore:
        dropTarget?.kind === "slot" && dropTarget.beforeId === dish.id && draggingId !== dish.id,
      dragging: draggingId === dish.id,
    };
  }

  // ---------------------------------------------------------- draft buttons
  function undoDraft(added: PlannerDish[]) {
    const ids = new Set(added.map((a) => a.id));
    setToast(null);
    setDishes((ds) => ds.filter((d) => !ids.has(d.id)));
    void save(undoAdds(proposalId, [...ids])).then((res) => {
      if (!res || !res.ok) {
        setDishes((ds) => [...ds, ...added.filter((a) => !ds.some((d) => d.id === a.id))]);
      }
    });
  }

  async function runDraft(kind: "last" | "fav" | "fill") {
    setDraftBusy(kind);
    setError(null);
    const action = kind === "last" ? startFromLastMenu : kind === "fav" ? addFavorites : fillOpenSlots;
    const res = await save(action(proposalId));
    setDraftBusy(null);
    if (!res || !res.ok) return;
    const added = res.added;
    if (added.length > 0) {
      setDishes((ds) => [...ds, ...added.filter((a) => !ds.some((d) => d.id === a.id))]);
      showToast(res.message, () => undoDraft(added));
    } else {
      showToast(res.message);
    }
  }

  // ---------------------------------------------------------- paste a list
  async function submitPaste() {
    if (!pasteText.trim()) return;
    setPasteBusy(true);
    setError(null);
    const before = new Set(dishes.map((d) => d.id));
    try {
      const res = await fetch("/api/proposals/paste-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, text: pasteText }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ? `Couldn't read that list: ${data.error}` : "Couldn't read that list.");
        return;
      }
      const reload = await reloadPlannerDishes(proposalId);
      if (!reload.ok) {
        setError(reload.error);
        return;
      }
      const added = reload.dishes.filter((d) => !before.has(d.id));
      setDishes(reload.dishes);
      setPasteText("");
      setPasteOpen(false);
      setSaveState("saved");
      showToast(
        added.length > 0 ? `Added ${added.length} ${added.length === 1 ? "dish" : "dishes"} from your list.` : "No dishes found in that list.",
        added.length > 0 ? () => undoDraft(added) : undefined,
      );
    } catch {
      setError("Couldn't read that list. Check your connection and try again.");
    } finally {
      setPasteBusy(false);
    }
  }

  // ---------------------------------------------------------- send
  async function doSend() {
    setSend("sending");
    setError(null);
    const fd = new FormData();
    fd.set("proposalId", proposalId);
    try {
      await sendProposal(fd);
    } catch {
      setSend("confirm");
      setError("Couldn't send the menu. Try again.");
      return;
    }
    if (clientEmail) {
      try {
        await emailProposalLinkToClient(fd);
        // Sent: back to the cook date's steps (they open on "Waiting for …").
        router.push(`/cook-dates/${cookDateId}`);
        return;
      } catch {
        setError(
          `The menu is marked as sent, but the email to ${clientEmail} didn't go out. Copy the review link above and text it to ${firstName}, or try “Email to client” again.`,
        );
      }
    } else {
      showToast(`Marked as sent. Copy the review link above to share it with ${firstName}.`);
    }
    setSend("idle");
    router.refresh();
  }

  // ---------------------------------------------------------- render
  const sendLabel = status === "REVISIONS_REQUESTED" ? "Send updated menu" : "Send menu to client";
  // Always the preview copy of the client's page: its buttons work but save
  // nothing. (The live review link would let a tap here answer for the client.)
  const previewButton = (
    <button type="button" onClick={() => setPreviewOpen(true)} className={BTN_QUIET}>
      <Eye aria-hidden="true" />
      Preview what the client sees
    </button>
  );

  const pastePanel = (
    <div>
      {!pasteOpen ? (
        <button
          type="button"
          onClick={() => setPasteOpen(true)}
          className={`min-h-11 rounded-lg text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline sm:min-h-8 ${FOCUS}`}
        >
          Paste a list instead
        </button>
      ) : (
        <div>
          <label htmlFor="planner-paste" className="text-xs font-medium text-slate-600">
            Paste a menu (one dish per line, course headings optional)
          </label>
          <textarea
            id="planner-paste"
            rows={6}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className={`mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ${FOCUS}`}
            placeholder={"Entrées\nLemon herb chicken\nSides\nRoasted carrots"}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={submitPaste} disabled={!pasteText.trim() || pasteBusy} className={BTN_PRIMARY}>
              {pasteBusy ? "Reading…" : "Add these dishes"}
            </button>
            <button type="button" onClick={() => setPasteOpen(false)} className={BTN_QUIET}>
              Cancel
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">New dish names are also saved to your recipe library.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={editable ? "pb-4" : ""}>
      {/* Header */}
      <header>
        <div className="text-sm text-slate-500">{props.crumb}</div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl leading-none text-slate-900 sm:text-5xl" style={DISPLAY_FONT}>
            Menu
          </h1>
          {editable ? (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto" role="group" aria-label="Draft the menu">
              <button
                type="button"
                onClick={() => runDraft("last")}
                disabled={!!draftBusy || !props.lastMenuLabel}
                title={props.lastMenuLabel ? `Copy the ${props.lastMenuLabel} menu` : `No earlier menu for ${firstName} yet`}
                className={BTN_QUIET}
              >
                <History aria-hidden="true" />
                {draftBusy === "last" ? "Copying…" : "Start from last menu"}
              </button>
              <button
                type="button"
                onClick={() => runDraft("fav")}
                disabled={!!draftBusy || props.favoriteCount === 0}
                title={props.favoriteCount > 0 ? `Dishes ${firstName} kept before, most-kept first` : `${firstName} has no kept dishes yet`}
                className={BTN_QUIET}
              >
                <Star aria-hidden="true" />
                {draftBusy === "fav" ? "Adding…" : "Their favorites"}
              </button>
              <button
                type="button"
                onClick={() => runDraft("fill")}
                disabled={!!draftBusy || !hasQuota || slotsLeft === 0}
                title={
                  !hasQuota
                    ? `${firstName} has no dish plan yet`
                    : slotsLeft === 0
                      ? "Every slot is filled"
                      : "Fill each open slot with safe recipes not served recently"
                }
                className={BTN_QUIET}
              >
                <WandSparkles aria-hidden="true" />
                {draftBusy === "fill" ? "Filling…" : "Fill open slots"}
              </button>
            </div>
          ) : (
            previewButton
          )}
        </div>
      </header>

      {props.statusPanel && <div className="mt-6">{props.statusPanel}</div>}

      {safety.length > 0 && (
        <div role="note" className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <p>
            <span className="font-semibold">For {firstName}:</span> {safety.join(" · ")}
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" onClick={() => setError(null)} className={`shrink-0 font-medium underline ${FOCUS}`}>
            Dismiss
          </button>
        </div>
      )}

      <div
        className={`mt-6 grid gap-6 ${
          editable ? "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "max-w-3xl"
        }`}
      >
        {/* Slots (the menu): first on phones, right column on desktop */}
        <section aria-label="Dishes on this menu" className="min-w-0 space-y-6">
          {displayGroups.length === 0 && (
            <div className={`${CARD} px-5 py-8 text-center`}>
              <p className="text-sm font-semibold text-slate-700">Nothing on this menu yet.</p>
              {editable && (
                <>
                  <p className="mt-1 text-sm text-slate-500">
                    {dnd
                      ? "Drag recipes from the list on the left, use a button above to draft it, or pick dishes one by one."
                      : "Use a button above to draft it, or pick dishes one by one."}
                  </p>
                  <button type="button" onClick={() => openFinder(null)} className={`${BTN_PRIMARY} mt-4 md:hidden`}>
                    <Plus aria-hidden="true" />
                  Add a dish
                  </button>
                </>
              )}
            </div>
          )}

          {displayGroups.map((group) => {
            const have = group.dishes.filter((d) => !d.clientRemoved).length;
            const full = group.target !== null && have >= group.target;
            const empties = editable && group.target !== null ? Math.max(0, group.target - have) : 0;
            const groupTarget: DropTarget = { kind: "slot", group: group.name, beforeId: null };
            const overEnd =
              dropTarget?.kind === "slot" && dropTarget.group === group.name && dropTarget.beforeId === null;
            const overGroup = dropTarget?.kind === "slot" && dropTarget.group === group.name;
            return (
              <div
                key={group.name}
                onDragOver={dnd ? (e) => dragOver(e, groupTarget) : undefined}
                onDragLeave={dnd ? dragLeave : undefined}
                onDrop={dnd ? (e) => drop(e, groupTarget) : undefined}
                className={`-mx-2 rounded-2xl px-2 py-2 transition-colors ${
                  overGroup ? "bg-[var(--accent-light)]/50 ring-2 ring-[var(--accent)]" : dragKind ? "bg-slate-50/60" : ""
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-lg text-slate-900" style={DISPLAY_FONT}>
                    {group.name}
                  </h2>
                  {group.target !== null && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${full ? "text-emerald-700" : "text-slate-500"}`}>
                      {full && (
                        <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                        </svg>
                      )}
                      {have} of {group.target}
                    </span>
                  )}
                </div>
                <ul className="space-y-3">
                  {group.dishes.map((dish) => (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      slot={group.name}
                      slots={slots}
                      editable={editable}
                      pending={dish.id.startsWith("tmp-")}
                      swap={swapFor === dish.id ? swapState : null}
                      onSwap={() => openSwap(dish)}
                      onPickSwap={(hit) => pickSwap(dish, hit)}
                      onCloseSwap={closeSwap}
                      onRemove={() => remove(dish)}
                      onCategory={(value) => setCourse(dish, value)}
                      drag={dishDrag(dish, group.name)}
                    />
                  ))}
                  {Array.from({ length: empties }, (_, i) => (
                    <li key={`empty-${i}`}>
                      <button
                        type="button"
                        onClick={() => openFinder(group.name)}
                        className={`flex min-h-12 w-full items-center gap-2 rounded-2xl border-2 border-dashed px-4 text-left text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] ${FOCUS} ${
                          overEnd && i === 0
                            ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent-strong)]"
                            : "border-slate-300 text-slate-500"
                        }`}
                      >
                        <span aria-hidden="true" className="text-base leading-none">+</span>
                        {overEnd && i === 0 ? `Drop to add ${withArticle(singularLabel(group.name))}` : `Add ${withArticle(singularLabel(group.name))}`}
                      </button>
                    </li>
                  ))}
                  {dragKind && empties === 0 && (
                    <li
                      aria-hidden="true"
                      className={`flex min-h-12 items-center justify-center rounded-2xl border-2 border-dashed text-sm font-medium ${
                        overEnd
                          ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent-strong)]"
                          : "border-slate-200 text-slate-400"
                      }`}
                    >
                      Drop here for {group.name}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}

          {editable && !hasQuota && groups.length > 0 && !dragKind && (
            <button
              type="button"
              onClick={() => openFinder(null)}
              className={`flex min-h-12 w-full items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 text-sm font-medium text-slate-500 hover:border-[var(--accent)] hover:text-[var(--accent-strong)] ${FOCUS}`}
            >
              <Plus aria-hidden="true" className="h-4 w-4" /> Add a dish
            </button>
          )}

          {editable && dishCount > 0 && (
            <form action={approveProposal} className="pt-2 text-xs text-slate-500">
              <input type="hidden" name="proposalId" value={proposalId} />
              Already agreed by text or phone?{" "}
              <button type="submit" className={`min-h-11 font-semibold text-slate-700 underline underline-offset-2 sm:min-h-0 ${FOCUS}`}>
                Mark it approved
              </button>
            </form>
          )}
        </section>

        {/* Recipe list: left column on desktop, a bottom sheet on phones */}
        {editable && (
          <>
            {sheetOpen && (
              <div aria-hidden="true" onClick={() => setSheetOpen(false)} className="fixed inset-0 z-[55] bg-slate-900/30 md:hidden" />
            )}
            <aside
              aria-label="Recipes"
              onDragOver={dnd ? (e) => dragOver(e, { kind: "finder" }) : undefined}
              onDragLeave={dnd ? dragLeave : undefined}
              onDrop={dnd ? (e) => drop(e, { kind: "finder" }) : undefined}
              className={`${
                sheetOpen ? "fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] rounded-t-2xl border-t border-slate-200 p-4 shadow-2xl" : "relative hidden"
              } flex-col bg-white md:sticky md:inset-auto md:top-24 md:z-auto md:order-first md:flex md:max-h-none md:self-start md:rounded-2xl md:border md:border-[var(--border-soft)] md:p-4 md:shadow-[0_1px_3px_rgba(30,41,59,0.04),0_4px_16px_color-mix(in_srgb,var(--accent)_8%,transparent)]`}
            >
              <Finder
                finder={finder}
                firstName={firstName}
                slots={slots}
                onMenu={onMenu}
                onAdd={(hit) => addHit(hit)}
                inputRef={inputRef}
                onClose={() => setSheetOpen(false)}
                paste={pastePanel}
                drag={
                  dnd
                    ? {
                        onDragStart: (e, hit) => startDrag(e, { kind: "recipe", hit }),
                        onDragEnd: endDrag,
                      }
                    : undefined
                }
              />
              {dragKind === "dish" && (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center backdrop-blur-[1px] ${
                    dropTarget?.kind === "finder"
                      ? "border-[var(--accent)] bg-[var(--accent-light)]/90 text-[var(--accent-strong)]"
                      : "border-slate-300 bg-white/80 text-slate-500"
                  }`}
                >
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  <p className="text-sm font-semibold">Drop here to take it off the menu</p>
                  <p className="text-xs">You can undo it.</p>
                </div>
              )}
            </aside>
          </>
        )}
      </div>

      {/* Footer */}
      {editable && (
        <div className="sticky bottom-[calc(var(--tab-bar-h)+1px+env(safe-area-inset-bottom))] z-40 -mx-4 mt-8 border-t border-[var(--border-soft)] bg-white/95 px-4 py-3 shadow-[0_-4px_16px_color-mix(in_srgb,var(--accent)_8%,transparent)] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border-x lg:bottom-0 lg:rounded-b-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              <span className={`font-medium ${hasQuota && slotsLeft === 0 ? "text-emerald-700" : "text-slate-900"}`}>
                {hasQuota
                  ? slotsLeft === 0
                    ? "Menu complete"
                    : `${slotsLeft} ${slotsLeft === 1 ? "slot" : "slots"} left`
                  : `${dishCount} ${dishCount === 1 ? "dish" : "dishes"}`}
              </span>
              <span className="ml-2 text-xs text-slate-500" aria-live="polite">
                {inflight > 0 ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : ""}
              </span>
            </p>

            {send === "idle" ? (
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <button type="button" onClick={() => openFinder(finder.filters.category)} className={`${BTN_QUIET} md:hidden`}>
                  <Plus aria-hidden="true" />
                  Add a dish
                </button>
                {previewButton}
                <button
                  type="button"
                  aria-disabled={dishCount === 0}
                  onClick={() => {
                    if (dishCount === 0) {
                      showToast("Add at least one dish first.");
                      return;
                    }
                    setSend("confirm");
                  }}
                  className={`${BTN_PRIMARY} ${dishCount === 0 ? "opacity-50" : ""}`}
                >
                  <Send aria-hidden="true" />
                  {sendLabel}
                </button>
              </div>
            ) : (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto" role="group" aria-label="Confirm send">
                <p className="text-sm font-medium text-slate-900">
                  {clientEmail ? `Send to ${clientEmail}?` : `${firstName} has no email on file. Mark as sent and share the link yourself?`}
                  {skippedStill > 0 && (
                    <span className="block text-xs font-normal text-amber-800">
                      {skippedStill === 1 ? "1 dish" : `${skippedStill} dishes`} {firstName} skipped {skippedStill === 1 ? "is" : "are"} still on the menu and will be sent again.
                    </span>
                  )}
                </p>
                <button type="button" onClick={doSend} disabled={send === "sending"} className={BTN_PRIMARY}>
                  <Send aria-hidden="true" />
                  {send === "sending" ? "Sending…" : clientEmail ? "Send" : "Mark as sent"}
                </button>
                <button type="button" onClick={() => setSend("idle")} disabled={send === "sending"} className={BTN_QUIET}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      <div className="pointer-events-none fixed inset-x-0 bottom-44 z-[65] flex justify-center px-4 lg:bottom-28" role="status" aria-live="polite">
        {toast && (
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl">
            <p>{toast.message}</p>
            {toast.undo && (
              <button
                type="button"
                onClick={toast.undo}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 font-semibold text-amber-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:min-h-8"
              >
                <Undo2 aria-hidden="true" className="h-4 w-4" />
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {previewOpen && (
        <PreviewModal proposalId={proposalId} firstName={firstName} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
