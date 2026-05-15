import { Hono } from "hono"
import { describeRoute, validator } from "hono-openapi"
import { resolver } from "hono-openapi"
import type { QuestionID } from "@/question/schema"
import { Question } from "@/question"
import z from "zod"
import { errors } from "../../error"
import { lazy } from "@/util/lazy"
import { jsonRequest } from "./trace"

const Reply = z.object({
  answers: z
    .array(z.array(z.string()))
    .describe("User answers in order of questions (each answer is an array of selected labels)"),
})

const RequestSchema = z.object({
  id: z.string().startsWith("que"),
  sessionID: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      header: z.string(),
      options: z.array(
        z.object({
          label: z.string(),
          description: z.string(),
        }),
      ),
      multiple: z.boolean().optional(),
      custom: z.boolean().optional(),
    }),
  ),
  tool: z
    .object({
      messageID: z.string(),
      callID: z.string(),
    })
    .optional(),
})

export const QuestionRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List pending questions",
        description: "Get all pending question requests across all sessions.",
        operationId: "question.list",
        responses: {
          200: {
            description: "List of pending questions",
            content: {
              "application/json": {
                schema: resolver(RequestSchema.array()),
              },
            },
          },
        },
      }),
      async (c) =>
        jsonRequest("QuestionRoutes.list", c, function* () {
          const svc = yield* Question.Service
          return yield* svc.list()
        }),
    )
    .post(
      "/:requestID/reply",
      describeRoute({
        summary: "Reply to question request",
        description: "Provide answers to a question request from the AI assistant.",
        operationId: "question.reply",
        responses: {
          200: {
            description: "Question answered successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          requestID: z.string().startsWith("que"),
        }),
      ),
      validator("json", Reply),
      async (c) =>
        jsonRequest("QuestionRoutes.reply", c, function* () {
          const params = c.req.valid("param")
          const json = c.req.valid("json")
          const svc = yield* Question.Service
          yield* svc.reply({
            requestID: params.requestID as unknown as QuestionID,
            answers: json.answers,
          })
          return true
        }),
    )
    .post(
      "/:requestID/reject",
      describeRoute({
        summary: "Reject question request",
        description: "Reject a question request from the AI assistant.",
        operationId: "question.reject",
        responses: {
          200: {
            description: "Question rejected successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          requestID: z.string().startsWith("que"),
        }),
      ),
      async (c) =>
        jsonRequest("QuestionRoutes.reject", c, function* () {
          const params = c.req.valid("param")
          const svc = yield* Question.Service
          yield* svc.reject(params.requestID as unknown as QuestionID)
          return true
        }),
    ),
)
