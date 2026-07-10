import { Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
import { SessionPermissionDock } from "@/pages/session/composer/session-permission-dock"
import { SessionQuestionDock } from "@/pages/session/composer/session-question-dock"
import { SessionFollowupDock } from "@/pages/session/composer/session-followup-dock"
import { SessionRevertDock } from "@/pages/session/composer/session-revert-dock"
import { SessionTodoDock } from "@/pages/session/composer/session-todo-dock"
import { SessionQuickReplyDock } from "@/components/session-quick-reply-dock"
import type { SessionComposerRegionController } from "./session-composer-region-controller"

export function SessionComposerRegion(props: {
  controller: SessionComposerRegionController
  promptInput: JSX.Element
}) {
  const language = useLanguage()
  const controller = props.controller
  const settings = useSettings()
  const rolled = () => {
    const revert = controller.revert()
    return revert?.items.length ? revert : undefined
  }

  return (
    <div
      ref={controller.setDockRef}
      data-component="session-prompt-dock"
      classList={{
        "w-full shrink-0 flex flex-col justify-center items-center pb-3 pointer-events-none": true,
        "bg-v2-background-bg-base": settings.general.newLayoutDesigns(),
        "bg-background-stronger": !settings.general.newLayoutDesigns(),
      }}
    >
      <div
        classList={{
          "w-full px-3 pointer-events-auto": true,
          "md:max-w-200 md:mx-auto 2xl:max-w-[1000px]": controller.centered(),
        }}
      >
        <Show when={controller.state.questionRequest()} keyed>
          {(request) => (
            <div>
              <SessionQuestionDock request={request} onSubmit={controller.onResponseSubmit} />
            </div>
          )}
        </Show>

        <Show when={controller.state.permissionRequest()} keyed>
          {(request) => (
            <div>
              <SessionPermissionDock
                request={request}
                responding={controller.state.permissionResponding()}
                onDecide={(response) => {
                  controller.onResponseSubmit()
                  controller.state.decide(response)
                }}
              />
            </div>
          )}
        </Show>

        <Show when={controller.showComposer()}>
          <Show when={controller.dock()}>
            <div
              classList={{
                "overflow-hidden": true,
                "pointer-events-none": controller.dockProgress() < 0.98,
              }}
              style={{
                "max-height": `${controller.dockHeight() * controller.dockProgress()}px`,
              }}
            >
              <div ref={controller.setDockBodyRef}>
                <SessionTodoDock
                  todos={controller.state.todos()}
                  collapsed={controller.todo.collapsed()}
                  onToggle={controller.todo.onToggle}
                  collapseLabel={language.t("session.todo.collapse")}
                  expandLabel={language.t("session.todo.expand")}
                  dockProgress={controller.dockProgress()}
                />
              </div>
            </div>
          </Show>
          <Show
            when={controller.promptReady()}
            fallback={
              <>
                <Show when={rolled()} keyed>
                  {(revert) => (
                    <div class="pb-2">
                      <SessionRevertDock
                        items={revert.items}
                        restoring={revert.restoring}
                        disabled={revert.disabled}
                        onRestore={revert.onRestore}
                      />
                    </div>
                  )}
                </Show>
                <Show when={controller.followup()} keyed>
                  {(followup) => (
                    <SessionFollowupDock
                      items={followup.items}
                      sending={followup.sending}
                      onSend={followup.onSend}
                      onEdit={followup.onEdit}
                    />
                  )}
                </Show>
              </>
            }
          >
            <SessionQuickReplyDock
              onSend={(message) => {
                // DOM-based fallback (works regardless of controller architecture):
                // 1. Set the prompt input via a hidden contenteditable
                // 2. Submit the form
                requestAnimationFrame(() => {
                  const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
                  if (!editor) return
                  editor.focus()
                  // Set text via input event
                  editor.textContent = message
                  editor.dispatchEvent(new InputEvent("input", { bubbles: true }))
                  // Submit the form
                  const form = editor.closest("form")
                  if (form) {
                    form.requestSubmit()
                  } else {
                    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }))
                  }
                })
              }}
            />
            {props.promptInput}
          </Show>
        </Show>
      </div>
    </div>
  )
}