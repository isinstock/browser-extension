import type {CollectionTrace} from '../utils/collection-selector'
import type {SelectorTrace} from '../utils/compute-selector'

type PickerMode = 'click' | 'advanced'

export interface DebugPanelProps {
  trace: SelectorTrace | null
  collectionTrace: CollectionTrace | null
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

function formatSelectorTrace(trace: SelectorTrace, mode: PickerMode): string {
  const modeLabel = mode === 'click' ? 'Basic' : 'Advanced'
  const lines: string[] = []

  lines.push(`Mode: ${modeLabel}`)
  lines.push(`Element: <${trace.tag}>`)
  if (trace.id) {
    lines.push(`ID: ${trace.id}`)
  }
  if (trace.classes.length > 0) {
    lines.push(`Classes: .${trace.classes.join(', .')}`)
  }
  if (trace.testIdAttrs.length > 0) {
    for (const attr of trace.testIdAttrs) {
      lines.push(`${attr.name}: "${attr.value}"`)
    }
  }
  lines.push(`Strategy: ${trace.strategy}`)
  lines.push('')
  lines.push(`Result: ${trace.result}`)

  if (trace.candidates.length > 0) {
    lines.push('')
    lines.push('Classes evaluated:')
    for (const c of trace.candidates) {
      const marker = trace.kept.includes(c.name) ? '\u2713' : '\u2717'
      const label = trace.kept.includes(c.name) ? 'kept' : 'dropped'
      const classLabel = c.classification !== 'semantic' ? ` [${c.classification}]` : ''
      lines.push(`  ${marker} .${c.name}${classLabel} \u2192 ${c.count} match${c.count !== 1 ? 'es' : ''} (${label})`)
    }
  }

  if (trace.dropped.length > 0) {
    lines.push('')
    lines.push('Dropped:')
    for (const d of trace.dropped) {
      lines.push(`  .${d.name} (${d.count} match${d.count !== 1 ? 'es' : ''})`)
    }
  }

  return lines.join('\n')
}

function formatCollectionTrace(trace: CollectionTrace): string {
  const lines: string[] = []

  lines.push(`Mode: Collection (Shift+hover)`)
  lines.push(`Target: <${trace.targetTag}>`)
  if (trace.targetClasses.length > 0) {
    lines.push(`Classes: .${trace.targetClasses.join(', .')}`)
  }
  lines.push('')

  for (const lvl of trace.levels) {
    if (lvl.parentTag === '(boundary)') {
      lines.push(`Level ${lvl.level}: hit document boundary`)
      continue
    }

    lines.push(`Level ${lvl.level}: ${lvl.siblingCount} <${lvl.tag}> under <${lvl.parentTag}>`)

    if (lvl.siblingCount < 2) {
      lines.push(`  skipped (need \u22652 siblings)`)
    } else if (lvl.strategy) {
      lines.push(`  \u2713 ${lvl.strategy}: ${lvl.selector} (${lvl.matchCount} elements)`)
    } else {
      lines.push(`  \u2717 no strategy matched`)
    }
  }

  lines.push('')
  if (trace.result === 'matched') {
    lines.push(`Result: ${trace.matchedSelector}`)
    lines.push(`Strategy: ${trace.matchedVia} (${trace.matchedCount} elements)`)
  } else {
    lines.push(`Result: no collection found`)
  }

  return lines.join('\n')
}

export function DebugPanel({trace, collectionTrace, mode}: DebugPanelProps) {
  if (collectionTrace) {
    return <div style={panelStyle}>{formatCollectionTrace(collectionTrace)}</div>
  }

  if (trace) {
    return <div style={panelStyle}>{formatSelectorTrace(trace, mode)}</div>
  }

  return (
    <div style={panelStyle}>
      Mode: {mode === 'click' ? 'Basic' : 'Advanced'}
      {'\n'}Hover over an element to see selector trace
      {'\n'}Shift+hover to see collection detection
    </div>
  )
}
