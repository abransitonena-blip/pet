import 'server-only'

import { getPrivilegedAuthClient, getPrivilegedIdentityConfig } from '@/lib/finance/serverIdentity'

export interface PushNotificationInput {
  readonly deviceToken: string
  readonly title: string
  readonly body: string
  readonly url?: string
  readonly tag?: string
}

export type SendPushResult =
  | { readonly ok: true; readonly messageName: string }
  | { readonly ok: false; readonly reason: 'not-configured' | 'send-failed' | 'unregistered' }

/**
 * FCM answers 404, or an UNREGISTERED error code, once a token is dead -- the
 * app was uninstalled or the permission revoked. That is the one failure the
 * caller should act on (by forgetting the token), so it is told apart from a
 * transient one.
 */
function isUnregistered(error: unknown): boolean {
  const response = (error as {
    response?: { status?: number; data?: { error?: { details?: Array<{ errorCode?: string }> } } }
  } | null)?.response
  if (!response) return false
  if (response.status === 404) return true
  return (response.data?.error?.details ?? []).some((detail) => detail.errorCode === 'UNREGISTERED')
}

/**
 * N1 push send via the FCM HTTP v1 API, authenticated through the same T3
 * Workload Identity Federation client (roles/firebasecloudmessaging.admin
 * on the same scoped service account) -- no Cloud Functions required, so
 * this is not blocked by the Blaze-plan decision the owner already
 * declined. Title, body, and target token always come from the caller;
 * this module invents no notification content. Fails closed when the
 * identity is not configured.
 */
export async function sendPushNotification(input: PushNotificationInput): Promise<SendPushResult> {
  const config = getPrivilegedIdentityConfig()
  const authClient = getPrivilegedAuthClient()
  if (!config || !authClient) return { ok: false, reason: 'not-configured' }

  if (!input.deviceToken || !input.title || !input.body) return { ok: false, reason: 'send-failed' }

  try {
    const response = await authClient.request<{ name: string }>({
      url: `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
      method: 'POST',
      data: {
        message: {
          token: input.deviceToken,
          notification: { title: input.title, body: input.body },
          // public/sw.js renders the notification itself and reads these
          // fields; FCM requires every data value to be a string.
          data: { title: input.title, body: input.body, url: input.url ?? '/', tag: input.tag ?? '' },
          // fcm_options.link must be an absolute HTTPS URL or FCM rejects the
          // whole message; app-relative paths travel in data.url instead.
          webpush: input.url && /^https:\/\//.test(input.url) ? { fcm_options: { link: input.url } } : undefined,
        },
      },
    })
    return { ok: true, messageName: response.data.name }
  } catch (error) {
    return { ok: false, reason: isUnregistered(error) ? 'unregistered' : 'send-failed' }
  }
}
