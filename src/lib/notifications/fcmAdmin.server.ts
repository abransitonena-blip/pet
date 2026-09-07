import 'server-only'

import { getPrivilegedAuthClient, getPrivilegedIdentityConfig } from '@/lib/finance/serverIdentity'

export interface PushNotificationInput {
  readonly deviceToken: string
  readonly title: string
  readonly body: string
  readonly url?: string
}

export type SendPushResult =
  | { readonly ok: true; readonly messageName: string }
  | { readonly ok: false; readonly reason: 'not-configured' | 'send-failed' }

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
          webpush: input.url ? { fcm_options: { link: input.url } } : undefined,
        },
      },
    })
    return { ok: true, messageName: response.data.name }
  } catch {
    return { ok: false, reason: 'send-failed' }
  }
}
