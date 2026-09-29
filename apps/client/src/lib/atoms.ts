import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Locale } from "./i18n";
import { getInitialLocale, persistLocale } from "./i18n";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface UserWithPermissions extends User {
  permissions: string[];
  roleName: string;
}

// Auth state
export const authTokenAtom = atomWithStorage<string | null>("auth-token", null);
export const authUserAtom = atomWithStorage<UserWithPermissions | null>(
  "auth-user",
  null,
);
export const authBootstrapReadyAtom = atom(false);
export const isAuthenticatedAtom = atom((get) => Boolean(get(authTokenAtom)));

// UI state
export const sidebarOpenAtom = atomWithStorage<boolean>("sidebar-open", true);
export const themeModeAtom = atomWithStorage<"light" | "dark">(
  "theme-mode",
  "light",
);
export const localeAtom = atom<Locale>(getInitialLocale());
export const localeActionsAtom = atom(null, (_get, set, newLocale: Locale) => {
  set(localeAtom, newLocale);
  persistLocale(newLocale);
});

const normalizePermissionName = (permission: string) => {
  if (permission.includes("@")) {
    return permission;
  }

  return permission.replace(/_(?=[^_]+$)/, "@");
};

const normalizePermissions = (permissions: string[]) =>
  permissions.map((permission) => normalizePermissionName(permission));

// Computed atom for user permissions
export const userPermissionsAtom = atom((get) => {
  const user = get(authUserAtom);
  return normalizePermissions(user?.permissions ?? []);
});

// Helper to check if user has permission
export const hasPermissionAtom = atom(
  (get) => (permission: string | string[]) => {
    const permissions = get(userPermissionsAtom);
    const required = Array.isArray(permission) ? permission : [permission];
    const normalizedRequired = required.map(normalizePermissionName);

    return normalizedRequired.some((requiredPermission) =>
      permissions.includes(requiredPermission),
    );
  },
);

export const clearAuthAtom = atom(null, (_get, set) => {
  set(authTokenAtom, null);
  set(authUserAtom, null);
});

// API wait indicator: bumped while requests are silently retrying after a
// 429 (rate limiter makes them wait). Navbar shows a subtle pill.
export const apiWaitingCountAtom = atom(0);

// AI form-fill bridge: AI sets this atom; form pages read and apply values
export const aiFormFillAtom = atom<Record<string, unknown> | null>(null);

// AI Fill modal state — shared between AiFillButton (toggle) and AiFillPanel (render)
export const aiFillOpenAtom = atom(false);

// AI chat open bridge: any component can open the AI chat with an optional preset message
export const aiChatOpenAtom = atom(false);
export const aiChatPresetMessageAtom = atom<string | null>(null);

// AI putaway control bridge: the AI chat (via client tools) writes to these
// atoms; the WarehouseLayoutPage reads them and applies the effects. This lets
// the LLM drive the putaway panel + 3D view without a direct ref.
export interface AiPutawaySelection {
  inboundTransactionId: string;
  palletId: string;
}
export const aiPutawaySelectionAtom = atom<AiPutawaySelection | null>(null);

export interface AiPutawayHighlight {
  storageLocationId: string;
  reason: string;
}
export const aiPutawayHighlightAtom = atom<AiPutawayHighlight | null>(null);

/** Stage one or more pallet→location assignments locally (not yet saved). */
export interface AiPutawayStageAction {
  assignments: Array<{ palletId: string; storageLocationId: string }>;
}
export const aiPutawayStageAtom = atom<AiPutawayStageAction | null>(null);

/** Un-stage a single pallet assignment (undo). */
export interface AiPutawayUnstageAction {
  palletId: string;
}
export const aiPutawayUnstageAtom = atom<AiPutawayUnstageAction | null>(null);

/** Commit all staged assignments to the server. */
export const aiPutawaySaveAtom = atom<number | null>(null);

/** Select an inbound transaction in the putaway panel. */
export interface AiPutawaySelectTransactionAction {
  inboundTransactionId: string;
}
export const aiPutawaySelectTransactionAtom =
  atom<AiPutawaySelectTransactionAction | null>(null);

// AI dispatch control bridge: the AI chat (via client tools) writes to these
// atoms; the WarehouseLayoutPage reads them and applies the effects. This lets
// the LLM drive the dispatch panel + 3D view without a direct ref.
export interface AiDispatchSelection {
  transactionId: string;
  itemId: string;
}
export const aiDispatchSelectionAtom = atom<AiDispatchSelection | null>(null);

export interface AiDispatchHighlight {
  palletId: string;
  reason: string;
}
export const aiDispatchHighlightAtom = atom<AiDispatchHighlight | null>(null);

/** Stage one or more item→pallet picks locally (not yet saved). */
export interface AiDispatchStageAction {
  assignments: Array<{ outboundTransactionItemId: string; palletId: string }>;
}
export const aiDispatchStageAtom = atom<AiDispatchStageAction | null>(null);

/** Un-stage a single pallet pick (undo). */
export interface AiDispatchUnstageAction {
  palletId: string;
}
export const aiDispatchUnstageAtom = atom<AiDispatchUnstageAction | null>(null);

/** Commit all staged picks to the server. */
export const aiDispatchSaveAtom = atom<number | null>(null);

/** Select an outbound transaction in the dispatch panel. */
export interface AiDispatchSelectTransactionAction {
  transactionId: string;
}
export const aiDispatchSelectTransactionAtom =
  atom<AiDispatchSelectTransactionAction | null>(null);

// AI approval control bridge: the AI chat (via client tools) writes to these
// atoms; transaction detail pages read them and trigger approval/rejection modals.
export interface AiApproveAction {
  transactionType: string;
  transactionId: string;
  rationale?: string;
}
export const aiApproveAtom = atom<AiApproveAction | null>(null);

export interface AiRejectAction {
  transactionType: string;
  transactionId: string;
  rationale?: string;
}
export const aiRejectAtom = atom<AiRejectAction | null>(null);
