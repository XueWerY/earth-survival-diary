export const chalk = {
  blue: '#93c5fd' as const,
  dim: 'rgba(255,255,255,0.45)' as const,
  muted: 'rgba(255,255,255,0.5)' as const,
  green: '#67c23a' as const,
  red: '#f56c6c' as const,
  warning: '#e6a23c' as const,
  primary: '#667eea' as const,
  white: '#fff' as const,
  subtle: 'rgba(255,255,255,0.4)' as const,
  orange: '#f59e0b' as const,
  cyan: '#67e8f9' as const,
  amber: '#fbbf24' as const,
  violet: '#a78bfa' as const,
  pink: '#f472b6' as const,
  danger: '#ef4444' as const,
  success: '#22c55e' as const,
  priority(priority: string): string {
    switch (priority) {
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#22c55e'
      default: return 'rgba(255,255,255,0.5)'
    }
  },
}