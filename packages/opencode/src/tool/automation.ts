import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Automation } from "../automation"
import DESCRIPTION from "./automation.txt"

export const Parameters = Schema.Struct({
  operation: Schema.Literals(["list", "get", "create", "update", "remove", "run", "history", "preview"] as const).annotate({
    description: "The automation operation to perform",
  }),
  id: Schema.optional(Schema.String).annotate({
    description: "Automation ID (required for get, update, remove, run, history)",
  }),
  name: Schema.optional(Schema.String).annotate({ description: "Name (required for create)" }),
  projects: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Project directories (required for create)",
  }),
  prompt: Schema.optional(Schema.String).annotate({ description: "Prompt template (required for create)" }),
  schedule: Schema.optional(Schema.NullOr(Schema.String)).annotate({
    description: "Cron schedule expression (optional, pass null to clear)",
  }),
  enabled: Schema.optional(Schema.Boolean).annotate({ description: "Whether the automation is enabled" }),
  limit: Schema.optional(Schema.Number).annotate({ description: "Limit for history results" }),
})

export const AutomationTool = Tool.define(
  "automation",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (
        params: Schema.Schema.Type<typeof Parameters>,
        ctx: Tool.Context,
      ): Effect.Effect<Tool.ExecuteResult> =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "automation",
            patterns: [params.operation],
            always: ["*"],
            metadata: { operation: params.operation },
          })

          const { operation, id, name, projects, prompt, schedule, enabled, limit } = params

          switch (operation) {
            case "list": {
              const items = yield* Effect.promise(() => Automation.list())
              return {
                title: "Automations list",
                output: JSON.stringify(items, null, 2),
                metadata: { operation: "list" as const, count: items.length },
              }
            }

            case "get": {
              if (!id) return yield* Effect.die(new Error("id is required for get operation"))
              const item = yield* Effect.promise(() => Automation.get(id))
              return {
                title: `Automation: ${item.name}`,
                output: JSON.stringify(item, null, 2),
                metadata: { operation: "get" as const },
              }
            }

            case "create": {
              if (!name || !projects || !prompt) {
                return yield* Effect.die(
                  new Error("name, projects, and prompt are required for create operation"),
                )
              }
              const item = yield* Effect.promise(() =>
                Automation.create({
                  name,
                  projects: [...projects],
                  prompt,
                  schedule: schedule ?? null,
                  enabled,
                }),
              )
              return {
                title: `Created automation: ${item.name}`,
                output: JSON.stringify(item, null, 2),
                metadata: { operation: "create" as const, id: item.id },
              }
            }

            case "update": {
              if (!id) return yield* Effect.die(new Error("id is required for update operation"))
              const item = yield* Effect.promise(() =>
                Automation.update({
                  id,
                  name,
                  projects: projects ? [...projects] : undefined,
                  prompt,
                  schedule,
                  enabled,
                }),
              )
              return {
                title: `Updated automation: ${item.name}`,
                output: JSON.stringify(item, null, 2),
                metadata: { operation: "update" as const },
              }
            }

            case "remove": {
              if (!id) return yield* Effect.die(new Error("id is required for remove operation"))
              const item = yield* Effect.promise(() => Automation.remove(id))
              return {
                title: `Removed automation: ${item.name}`,
                output: JSON.stringify(item, null, 2),
                metadata: { operation: "remove" as const },
              }
            }

            case "run": {
              if (!id) return yield* Effect.die(new Error("id is required for run operation"))
              const item = yield* Effect.promise(() => Automation.run({ id }))
              return {
                title: `Triggered automation: ${item.name}`,
                output: JSON.stringify(item, null, 2),
                metadata: { operation: "run" as const },
              }
            }

            case "history": {
              if (!id) return yield* Effect.die(new Error("id is required for history operation"))
              const runs = yield* Effect.promise(() => Automation.history({ id, limit }))
              return {
                title: `Automation run history: ${id}`,
                output: JSON.stringify(runs, null, 2),
                metadata: { operation: "history" as const, count: runs.length },
              }
            }

            case "preview": {
              if (!schedule) {
                return yield* Effect.die(new Error("schedule is required for preview operation"))
              }
              const result = yield* Effect.promise(() => Automation.preview({ schedule }))
              return {
                title: "Schedule preview",
                output: JSON.stringify(result, null, 2),
                metadata: { operation: "preview" as const, valid: result.valid },
              }
            }
          }
        }).pipe(Effect.orDie),
    }
  }),
)
