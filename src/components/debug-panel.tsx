import type {SelectorTrace} from '../utils/compute-selector'

type PickerMode = 'click' | 'advanced'

export interface DebugPanelProps {
  trace: SelectorTrace | null
  mode: PickerMode
}

const panelStyle = {
  position: 'fixed',
  top: '8px',
  right: '8px',
  width: '380px',
  maxHeight: '50vh',
  overflowY: 'auto',
  background: 'rgba(0, 0, 0, 0.9)',
  color: '#e0e0e0',
  fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: '11px',
  lineHeight: '1.5',
  padding: '10px 12px',
  borderRadius: '6px',
  zIndex: 2147483647,
  pointerEvents: 'none',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  border: '1px solid rgba(255, 255, 255, 0.1)',
} as const

export function DebugPanel({trace, mode}: DebugPanelProps) {
  if (!trace) return null

  const modeLabel = mode === 'click' ? 'Basic' : 'Advanced'
  const lines: string[] = []

  lines.push(`Mode: ${modeLabel}`)
  lines.push(`Element: <${trace.tag}>`)
  lines.push(`Strategy: ${trace.strategy}`)
  lines.push('')
  lines.push(`Result: ${trace.result}`)

  if (trace.candidates.length > 0) {
    lines.push('')
    lines.push('Classes evaluated:')
    for (const c of trace.candidates) {
      const marker = trace.kept.includes(c.name) ? '\u2713' : '\u2717'
      const label = trace.kept.includes(c.name) ? 'kept' : 'dropped'
      lines.push(`  ${marker} .${c.name} \u2192 ${c.count} match${c.count !== 1 ? 'es' : ''} (${label})`)
    }
  }

  if (trace.dropped.length > 0) {
    lines.push('')
    lines.push('Dropped:')
    for (const d of trace.dropped) {
      lines.push(`  .${d.name} (${d.count} match${d.count !== 1 ? 'es' : ''})`)
    }
  }

  return <div style={panelStyle}>{lines.join('\n')}</div>
}
