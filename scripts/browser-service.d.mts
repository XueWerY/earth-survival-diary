import type { IncomingMessage, ServerResponse } from 'node:http'

export function createBrowserServiceMiddleware(): (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: Error) => void,
) => void

export function isTrustedLocalRequest(request: IncomingMessage): boolean
