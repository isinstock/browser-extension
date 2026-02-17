/**
 * Classifies CSS classes as semantic, utility (Tailwind-style), or hashed (CSS modules).
 *
 * Used by computeSelector to prioritize semantic classes over utility/hashed ones
 * when building CSS selectors for element identification.
 */

export type ClassType = 'semantic' | 'utility' | 'hashed'

/** Regex to detect CSS module hashed suffixes like `__abc123` or `__Xk9mP` */
const HASHED_SUFFIX_RE = /__[a-zA-Z0-9]{4,}$/

/** Tailwind single-word utility classes (no prefix-value pattern) */
const SINGLE_WORD_UTILITIES = new Set([
  'absolute',
  'antialiased',
  'block',
  'capitalize',
  'clear',
  'collapse',
  'container',
  'contents',
  'cursor',
  'flex',
  'float',
  'grid',
  'grow',
  'hidden',
  'inline',
  'invisible',
  'isolate',
  'italic',
  'lowercase',
  'normal',
  'ordinal',
  'outline',
  'overflow',
  'overline',
  'pointer',
  'relative',
  'resize',
  'shrink',
  'static',
  'sticky',
  'table',
  'truncate',
  'underline',
  'uppercase',
  'visible',
])

/**
 * Common Tailwind utility prefixes (the part before the first `-`).
 * e.g. `p-4` → prefix `p`, `bg-white` → prefix `bg`
 */
const UTILITY_PREFIXES = new Set([
  'accent',
  'align',
  'animate',
  'appearance',
  'aspect',
  'auto',
  'backdrop',
  'basis',
  'bg',
  'blur',
  'border',
  'bottom',
  'box',
  'break',
  'brightness',
  'capitalize',
  'caret',
  'col',
  'columns',
  'content',
  'contrast',
  'cursor',
  'decoration',
  'delay',
  'divide',
  'drop',
  'duration',
  'ease',
  'fill',
  'filter',
  'flex',
  'float',
  'font',
  'from',
  'gap',
  'grayscale',
  'grid',
  'grow',
  'h',
  'hue',
  'indent',
  'inset',
  'invert',
  'items',
  'justify',
  'leading',
  'left',
  'line',
  'list',
  'm',
  'max',
  'mb',
  'min',
  'mix',
  'ml',
  'mr',
  'ms',
  'mt',
  'mx',
  'my',
  'not',
  'object',
  'opacity',
  'order',
  'origin',
  'outline',
  'overflow',
  'overscroll',
  'p',
  'pb',
  'pe',
  'pl',
  'place',
  'pointer',
  'pr',
  'ps',
  'pt',
  'px',
  'py',
  'right',
  'ring',
  'rotate',
  'rounded',
  'row',
  'saturate',
  'scale',
  'scroll',
  'select',
  'self',
  'sepia',
  'shadow',
  'shrink',
  'size',
  'skew',
  'snap',
  'space',
  'sr',
  'start',
  'stroke',
  'subgrid',
  'text',
  'to',
  'top',
  'touch',
  'tracking',
  'transform',
  'transition',
  'translate',
  'underline',
  'via',
  'visible',
  'w',
  'whitespace',
  'will',
  'z',
])

/**
 * Returns true if the class looks like a Tailwind / utility-framework class.
 *
 * Detects:
 * - Variant prefixes with `:` (e.g. `sm:p-4`, `hover:bg-blue-500`)
 * - Negative utilities starting with `-` (e.g. `-m-4`, `-translate-x-1`)
 * - Single-word utilities (e.g. `flex`, `grid`, `hidden`)
 * - Prefix-value patterns (e.g. `p-4`, `bg-white`, `text-lg`)
 */
export function isUtilityClass(cls: string): boolean {
  // Variant prefixes like sm:p-4, hover:text-white, dark:bg-black
  if (cls.includes(':')) return true

  // Negative utilities like -m-4, -translate-x-1
  if (cls.startsWith('-')) return true

  // Single-word utilities like flex, grid, hidden
  if (SINGLE_WORD_UTILITIES.has(cls)) return true

  // Prefix-value pattern: extract first segment before `-`
  const dashIndex = cls.indexOf('-')
  if (dashIndex > 0) {
    const prefix = cls.slice(0, dashIndex)
    if (UTILITY_PREFIXES.has(prefix)) return true
  }

  return false
}

/**
 * Returns true if the class looks like a CSS module hashed class.
 *
 * Detects patterns like `styles_card__abc123`, `Component_wrapper__Xk9mP`
 */
export function isHashedClass(cls: string): boolean {
  return HASHED_SUFFIX_RE.test(cls)
}

/**
 * Classifies a CSS class name into one of three categories:
 * - `'hashed'` — CSS module generated (e.g. `styles_card__abc123`)
 * - `'utility'` — Tailwind/utility framework (e.g. `p-4`, `sm:text-lg`)
 * - `'semantic'` — developer-authored meaningful name (e.g. `product-card`, `sidebar`)
 */
export function classifyClass(cls: string): ClassType {
  if (isHashedClass(cls)) return 'hashed'
  if (isUtilityClass(cls)) return 'utility'
  return 'semantic'
}
