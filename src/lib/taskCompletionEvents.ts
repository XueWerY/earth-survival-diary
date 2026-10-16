import { ref } from 'vue'

export const taskCompletionChangeVersion = ref(0)
export const taskCompletionChangeDetails = ref<{
  taskId: string
  previous: boolean
  completed: boolean
} | null>(null)
export const taskChecklistChangeDetails = ref<{
  taskId: string
  taskName: string
} | null>(null)

const completionIntents = new Map<string, number>()
const authorizedCompletions = new Map<string, number>()
const COMPLETION_INTENT_TTL_MS = 10_000

export function markTaskCompletionIntent(taskId: string): void {
  completionIntents.set(taskId, Date.now() + COMPLETION_INTENT_TTL_MS)
}

export function authorizeTaskCompletion(taskId: string): boolean {
  const expiresAt = completionIntents.get(taskId)
  completionIntents.delete(taskId)
  if (!expiresAt || expiresAt < Date.now()) return false

  authorizedCompletions.set(taskId, Date.now() + COMPLETION_INTENT_TTL_MS)
  return true
}

export function consumeAuthorizedTaskCompletion(taskId: string): boolean {
  const expiresAt = authorizedCompletions.get(taskId)
  authorizedCompletions.delete(taskId)
  return !!expiresAt && expiresAt >= Date.now()
}
