import { createSignal, createEffect, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"

export type QuickReply = {
  key: string
  message: string
}

export type QuickReplyList = QuickReply[]

export function SessionQuickReplyDock(props: {
  onSend: (message: string) => void
}) {
  const [store, setStore] = persisted(
    Persist.global("quick-replies"),
    createStore<QuickReplyList>([]),
  )

  const [editing, setEditing] = createSignal(false)
  const [editKey, setEditKey] = createSignal("")
  const [editMessage, setEditMessage] = createSignal("")
  const [editIndex, setEditIndex] = createSignal<number | undefined>()

  function startAdd() {
    setEditIndex(undefined)
    setEditKey("")
    setEditMessage("")
    setEditing(true)
  }

  function startEdit(index: number) {
    const item = store[index]
    if (!item) return
    setEditIndex(index)
    setEditKey(item.key)
    setEditMessage(item.message)
    setEditing(true)
  }

  function save() {
    const key = editKey().trim()
    const message = editMessage().trim()
    if (!key || !message) return

    if (editIndex() !== undefined) {
      const idx = editIndex()!
      setStore(idx, { key, message })
    } else {
      setStore([...store, { key, message }])
    }
    setEditing(false)
  }

  function remove(index: number) {
    const next = store.filter((_, i) => i !== index)
    setStore(next)
  }

  return (
    <div class="flex flex-wrap items-center gap-1.5 px-0.5 pb-2">
      <For each={store}>
        {(item, index) => (
          <div class="group relative">
            <button
              type="button"
              onClick={() => props.onSend(item.message)}
              class="rounded-full border border-border-weak-base bg-background-base/60 px-2.5 py-1 text-12-medium text-text-weak transition-all hover:border-border-base hover:bg-background-base hover:text-text-base"
            >
              {item.key}
            </button>
            <div class="absolute -right-1.5 -top-1.5 z-10 hidden gap-0.5 group-hover:flex">
              <button
                type="button"
                onClick={() => startEdit(index())}
                class="flex size-4 items-center justify-center rounded-full bg-background-stronger text-10-medium text-text-weak hover:text-text-base"
                title="Edit"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              </button>
              <button
                type="button"
                onClick={() => remove(index())}
                class="flex size-4 items-center justify-center rounded-full bg-background-stronger text-10-medium text-text-weak hover:text-text-danger"
                title="Delete"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          </div>
        )}
      </For>
      <button
        type="button"
        onClick={startAdd}
        class="flex size-6 items-center justify-center rounded-full border border-dashed border-border-weak-base text-text-weak transition-all hover:border-border-base hover:text-text-base"
        title="Add quick reply"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><path d="M12 5v14M5 12h14"/></svg>
      </button>

      <Show when={editing()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditing(false)}>
          <div class="w-full max-w-md rounded-lg border border-border-base bg-background-base p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 class="mb-3 text-14-semibold text-text-base">{editIndex() !== undefined ? "Edit quick reply" : "Add quick reply"}</h3>
            <div class="mb-2">
              <label class="mb-1 block text-12-medium text-text-weak">Label</label>
              <input
                type="text"
                value={editKey()}
                onInput={(e) => setEditKey(e.currentTarget.value)}
                placeholder="e.g. Fix this bug"
                class="w-full rounded-md border border-border-weak-base bg-background-base px-3 py-2 text-14-regular text-text-base outline-none focus:border-border-base"
              />
            </div>
            <div class="mb-4">
              <label class="mb-1 block text-12-medium text-text-weak">Message</label>
              <textarea
                value={editMessage()}
                onInput={(e) => setEditMessage(e.currentTarget.value)}
                placeholder="e.g. Find the bug in this file and fix it"
                rows={3}
                class="w-full resize-none rounded-md border border-border-weak-base bg-background-base px-3 py-2 text-14-regular text-text-base outline-none focus:border-border-base"
              />
            </div>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                class="rounded-md border border-border-weak-base px-3 py-1.5 text-13-medium text-text-weak transition-colors hover:bg-background-stronger"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                class="rounded-md bg-[var(--accent-blue,#58a6ff)] px-3 py-1.5 text-13-medium text-white transition-opacity hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
