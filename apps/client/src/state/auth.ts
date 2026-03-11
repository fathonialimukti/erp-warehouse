import { atom, getDefaultStore } from 'jotai'

type AuthSession = {
  tokenExpiresAt: number | null
  permissions: string[]
  userName: string | null
  roleName: string | null
}

export const authSessionAtom = atom<AuthSession>({
  tokenExpiresAt: null,
  permissions: [],
  userName: null,
  roleName: null,
})

const store = getDefaultStore()

export function setAuthSession(next: Partial<AuthSession>) {
  const current = store.get(authSessionAtom)
  store.set(authSessionAtom, { ...current, ...next })
}

export function clearAuthSession() {
  store.set(authSessionAtom, {
    tokenExpiresAt: null,
    permissions: [],
    userName: null,
    roleName: null,
  })
}

export function getAuthSession() {
  return store.get(authSessionAtom)
}

export function isTokenExpired(tokenExpiresAt: number | null) {
  if (!tokenExpiresAt) return false
  return Date.now() >= tokenExpiresAt
}
