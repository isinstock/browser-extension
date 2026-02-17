/**
 * Manages bottom padding on <html> to keep page content scrollable
 * behind a fixed-position panel at the bottom of the viewport.
 *
 * Uses a ResizeObserver to track the panel's rendered height and
 * applies matching padding-bottom to documentElement. Restores the
 * original padding on stop().
 */
export class PagePaddingManager {
  private savedPaddingBottom = ''
  private observer: ResizeObserver

  constructor() {
    this.observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
        document.documentElement.style.paddingBottom = `${height}px`
      }
    })
  }

  start(element: Element) {
    this.savedPaddingBottom = document.documentElement.style.paddingBottom
    this.observer.observe(element)
  }

  stop(element: Element) {
    this.observer.unobserve(element)
    document.documentElement.style.paddingBottom = this.savedPaddingBottom
  }
}
