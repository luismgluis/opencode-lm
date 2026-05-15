import "hono"

declare module "hono" {
  interface ContextVariableMap {
    user: { id: string; username: string; role: "admin" | "member" }
  }
}
