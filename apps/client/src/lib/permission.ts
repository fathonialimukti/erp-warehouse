export type MenuItem = {
  key: string
  label: string
  description: string
  requiredAnyPermissions?: string[]
  requiredAllPermissions?: string[]
  to?: string
}

function matchesPermission(granted: string, required: string) {
  if (granted === '*' || required === '*') return true

  if (required.endsWith(':*')) {
    const prefix = required.slice(0, -2)
    return granted.startsWith(`${prefix}:`)
  }

  if (granted.endsWith(':*')) {
    const prefix = granted.slice(0, -2)
    return required.startsWith(`${prefix}:`)
  }

  return granted === required
}

export function hasPermission(userPermissions: string[], requiredPermission: string) {
  return userPermissions.some((granted) =>
    matchesPermission(granted, requiredPermission),
  )
}

export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[],
) {
  return requiredPermissions.some((required) =>
    hasPermission(userPermissions, required),
  )
}

export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[],
) {
  return requiredPermissions.every((required) =>
    hasPermission(userPermissions, required),
  )
}

export function canViewMenuItem(item: MenuItem, userPermissions: string[]) {
  if (
    item.requiredAnyPermissions &&
    !hasAnyPermission(userPermissions, item.requiredAnyPermissions)
  ) {
    return false
  }

  if (
    item.requiredAllPermissions &&
    !hasAllPermissions(userPermissions, item.requiredAllPermissions)
  ) {
    return false
  }

  return true
}

export function buildVisibleMenu(items: MenuItem[], userPermissions: string[]) {
  return items.filter((item) => canViewMenuItem(item, userPermissions))
}
