import { computed, reactive } from 'vue'
import { api } from '@/lib/api'

/**
 * Developer API keys — the credential a merchant's own server presents to send SMS
 * without the dashboard. Backed by /api/sms/api-keys.
 *
 * The one rule this store exists to enforce: the plaintext secret is returned by the
 * CREATE call and never again. It is deliberately NOT kept in `items` and never re-fetched
 * — it lives only in the caller's local ref until the modal closes. Storing it here would
 * quietly make it recoverable from anywhere in the app, which is exactly the property the
 * hashed server-side storage is designed to remove.
 */
export type ApiKeyMode = 'live' | 'test'
export type ApiKeyStatus = 'active' | 'revoked'

export interface ApiKey {
  id: string
  name: string
  /** Non-secret leading segment, e.g. "sk_live_7f2a91c4". Safe to display. */
  prefix: string
  mode: ApiKeyMode
  status: ApiKeyStatus
  allowedIps: string[]
  createdAt: number
  lastUsedAt: number | null
  requestCount: number
  revokedAt: number | null
}

interface ApiKeyDoc {
  id: string
  name: string
  prefix: string
  mode: string
  status: string
  allowedIps: string[] | null
  createdAt: string
  lastUsedAt: string | null
  requestCount: number
  revokedAt: string | null
}

interface ListResponse {
  /** Whether this business is permitted to hold API keys at all (admin-granted). */
  enabled: boolean
  keys: ApiKeyDoc[]
}

interface CreatedResponse {
  key: ApiKeyDoc
  /** The plaintext key. Shown once, never stored. */
  secret: string
}

function mapKey(k: ApiKeyDoc): ApiKey {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    mode: k.mode === 'test' ? 'test' : 'live',
    status: k.status === 'revoked' ? 'revoked' : 'active',
    allowedIps: k.allowedIps ?? [],
    createdAt: k.createdAt ? Date.parse(k.createdAt) : Date.now(),
    lastUsedAt: k.lastUsedAt ? Date.parse(k.lastUsedAt) : null,
    requestCount: k.requestCount ?? 0,
    revokedAt: k.revokedAt ? Date.parse(k.revokedAt) : null,
  }
}

const state = reactive<{ items: ApiKey[]; enabled: boolean; loaded: boolean }>({
  items: [],
  // Default FALSE, unlike the sender-ID store's optimistic defaults: showing a "create key"
  // button we know the server will refuse is worse than a moment of nothing, and the
  // access grant is rare enough that guessing yes would be wrong for most accounts.
  enabled: false,
  loaded: false,
})

async function refresh() {
  const payload = await api.get<ListResponse>('/api/sms/api-keys')
  state.items = (payload?.keys ?? []).map(mapKey)
  state.enabled = payload?.enabled === true
  state.loaded = true
}

/** Drop cached keys on sign-out so the next user doesn't inherit them. */
export function resetApiKeys() {
  state.items = []
  state.enabled = false
  state.loaded = false
}

export function useApiKeys() {
  /**
   * Create a key. Returns the plaintext secret to the CALLER, who must show it once and
   * then let it go — it is intentionally not written into the store.
   */
  async function create(input: { name: string; mode: ApiKeyMode; allowedIps: string[] }): Promise<string> {
    const created = await api.post<CreatedResponse>('/api/sms/api-keys', {
      name: input.name.trim() || undefined,
      mode: input.mode,
      allowedIps: input.allowedIps.length ? input.allowedIps : undefined,
    })
    await refresh()
    return created.secret
  }

  async function revoke(id: string) {
    await api.del(`/api/sms/api-keys/${encodeURIComponent(id)}`)
    await refresh()
  }

  return {
    items: computed(() => state.items),
    // Live keys first — the revoked ones are history, kept visible for the audit trail.
    active: computed(() => state.items.filter((k) => k.status === 'active')),
    revoked: computed(() => state.items.filter((k) => k.status === 'revoked')),
    enabled: computed(() => state.enabled),
    loaded: computed(() => state.loaded),
    refresh,
    create,
    revoke,
  }
}
