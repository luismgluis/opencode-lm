import { ServerAuth } from "@/server/auth"
import { Effect, Encoding, Layer, Redacted } from "effect"
import { HttpEffect, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiError, HttpApiMiddleware } from "effect/unstable/httpapi"
import { hasPtyConnectTicketURL } from "@/server/shared/pty-ticket"
import { isPublicUIPath } from "@/server/shared/public-ui"
import { UnauthorizedError } from "../errors"
import { createHmac } from "node:crypto"

const AUTH_TOKEN_QUERY = "auth_token"
const UNAUTHORIZED = 401
const WWW_AUTHENTICATE = 'Basic realm="Secure Area"'
const SESSION_COOKIE = "opencode_session"

// JWT secret independent of Basic auth password
const JWT_SECRET = process.env.OPENCODE_SERVER_PASSWORD || "opencode-jwt-secret-change-me"

function verifyJWT(token: string): { sub: string; username: string; role: string } | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const [headerB64, bodyB64, sigB64] = parts
    const expectedSig = createHmac("sha256", JWT_SECRET)
      .update(`${headerB64}.${bodyB64}`)
      .digest()
    if (!Buffer.from(expectedSig).equals(Buffer.from(sigB64, "base64url"))) return null
    const payload = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return { sub: payload.sub, username: payload.username, role: payload.role }
  } catch {
    return null
  }
}

function isAuthPath(pathname: string) {
  return pathname.startsWith("/auth/") || pathname.startsWith("/api/users/")
}

export class Authorization extends HttpApiMiddleware.Service<Authorization>()(
  "@opencode/ExperimentalHttpApiAuthorization",
  {
    error: HttpApiError.UnauthorizedNoContent,
  },
) {}

export class V2Authorization extends HttpApiMiddleware.Service<V2Authorization>()(
  "@opencode/ExperimentalHttpApiV2Authorization",
  {
    error: UnauthorizedError,
  },
) {}

function emptyCredential() {
  return {
    username: "",
    password: Redacted.make(""),
  }
}

function validateCredential<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  credential: ServerAuth.DecodedCredentials,
  config: ServerAuth.Info,
) {
  return Effect.gen(function* () {
    if (!ServerAuth.required(config)) return yield* effect
    if (!ServerAuth.authorized(credential, config)) {
      yield* HttpEffect.appendPreResponseHandler((_request, response) =>
        Effect.succeed(HttpServerResponse.setHeader(response, "www-authenticate", WWW_AUTHENTICATE)),
      )
      return yield* new HttpApiError.Unauthorized({})
    }
    return yield* effect
  })
}

function decodeCredential(input: string) {
  return Encoding.decodeBase64String(input)
    .asEffect()
    .pipe(
      Effect.match({
        onFailure: emptyCredential,
        onSuccess: (header) => {
          const parts = header.split(":")
          if (parts.length !== 2) return emptyCredential()
          return {
            username: parts[0],
            password: Redacted.make(parts[1]),
          }
        },
      }),
    )
}

export const v2AuthorizationLayer = Layer.effect(
  V2Authorization,
  Effect.gen(function* () {
    const config = yield* ServerAuth.Config
    if (!ServerAuth.required(config)) return V2Authorization.of((effect) => effect)
    return V2Authorization.of((effect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        return yield* credentialFromRequest(request).pipe(
          Effect.flatMap((credential) =>
            Effect.gen(function* () {
              if (ServerAuth.authorized(credential, config)) return yield* effect
              yield* HttpEffect.appendPreResponseHandler((_request, response) =>
                Effect.succeed(HttpServerResponse.setHeader(response, "www-authenticate", WWW_AUTHENTICATE)),
              )
              return yield* new UnauthorizedError({ message: "Authentication required" })
            }),
          ),
        )
      }),
    )
  }),
)

// ── Router middleware: JWT always checked, Basic auth as optional fallback ──
export const authorizationRouterMiddleware = HttpRouter.middleware()(
  Effect.gen(function* () {
    const config = yield* ServerAuth.Config

    return (effect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const url = new URL(request.url, "http://localhost")
        if (isPublicUIPath(request.method, url.pathname)) return yield* effect
        if (hasPtyConnectTicketURL(url)) return yield* effect
        if (isAuthPath(url.pathname)) return yield* effect

        // 1. JWT always checked first
        const jwt = extractJWT(request)
        if (jwt && verifyJWT(jwt)) return yield* effect

        // 2. Only if JWT fails AND Basic auth is configured, fall back to Basic
        if (ServerAuth.required(config)) {
          return yield* credentialFromURL(url, request).pipe(
            Effect.flatMap((credential) => validateRawCredential(effect, credential, config)),
          )
        }

        // 3. No JWT and no Basic auth required → deny API access
        return yield* Effect.succeed(
          HttpServerResponse.empty({
            status: UNAUTHORIZED,
            headers: { "www-authenticate": WWW_AUTHENTICATE },
          }),
        )
      })
  }),
)

// ── HttpApi layer: JWT always checked ──
export const authorizationLayer = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const config = yield* ServerAuth.Config

    // Always check JWT; Basic auth as optional fallback
    if (!ServerAuth.required(config)) {
      return Authorization.of((effect) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest
          const jwt = extractJWT(request)
          if (jwt && verifyJWT(jwt)) return yield* effect
          return yield* new HttpApiError.Unauthorized({})
        }),
      )
    }

    return Authorization.of((effect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        // Check JWT first
        const jwt = extractJWT(request)
        if (jwt && verifyJWT(jwt)) return yield* effect
        // Fall back to Basic auth
        return yield* credentialFromRequest(request).pipe(
          Effect.flatMap((credential) => validateCredential(effect, credential, config)),
        )
      }),
    )
  }),
)
