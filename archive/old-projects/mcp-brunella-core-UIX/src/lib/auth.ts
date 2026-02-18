import { User, UserRole, Permission } from './types'

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  admin: {
    startServer: true,
    stopServer: true,
    restartServer: true,
    viewLogs: true,
    clearLogs: true,
    viewConfig: true,
    editConfig: true,
    viewMetrics: true,
    useChat: true,
    configureAgents: true,
  },
  operator: {
    startServer: true,
    stopServer: true,
    restartServer: true,
    viewLogs: true,
    clearLogs: false,
    viewConfig: true,
    editConfig: false,
    viewMetrics: true,
    useChat: true,
    configureAgents: false,
  },
  viewer: {
    startServer: false,
    stopServer: false,
    restartServer: false,
    viewLogs: true,
    clearLogs: false,
    viewConfig: true,
    editConfig: false,
    viewMetrics: true,
    useChat: true,
    configureAgents: false,
  },
}

export function getRolePermissions(role: UserRole): Permission {
  return ROLE_PERMISSIONS[role]
}

export function canPerformAction(user: User | null, action: keyof Permission): boolean {
  if (!user) return false
  const permissions = getRolePermissions(user.role)
  return permissions[action]
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    admin: 'Adminisztrátor',
    operator: 'Operátor',
    viewer: 'Néző',
  }
  return roleNames[role]
}

export function getRoleColor(role: UserRole): string {
  const roleColors: Record<UserRole, string> = {
    admin: 'text-destructive',
    operator: 'text-accent',
    viewer: 'text-muted-foreground',
  }
  return roleColors[role]
}

export const MOCK_USERS: Array<Omit<User, 'id' | 'createdAt'>> = [
  {
    username: 'admin',
    role: 'admin',
    displayName: 'Rendszergazda',
    email: 'admin@brunella.local',
  },
  {
    username: 'operator',
    role: 'operator',
    displayName: 'Üzemeltető',
    email: 'operator@brunella.local',
  },
  {
    username: 'viewer',
    role: 'viewer',
    displayName: 'Megfigyelő',
    email: 'viewer@brunella.local',
  },
]

export function validateLogin(username: string, password: string): User | null {
  const mockUser = MOCK_USERS.find(u => u.username === username)
  
  if (!mockUser || password !== 'demo123') {
    return null
  }

  return {
    ...mockUser,
    id: `user-${Date.now()}`,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  }
}
