export interface SelectionColor {
  border: string
  background: string
  badge: string
}

export const SELECTION_COLORS: SelectionColor[] = [
  {border: '#00aae7', background: 'rgba(0, 170, 231, 0.08)', badge: '#00aae7'},
  {border: '#6350e9', background: 'rgba(99, 80, 233, 0.08)', badge: '#6350e9'},
  {border: '#32B91C', background: 'rgba(50, 185, 28, 0.08)', badge: '#32B91C'},
  {border: '#e9a250', background: 'rgba(233, 162, 80, 0.08)', badge: '#e9a250'},
  {border: '#e95075', background: 'rgba(233, 80, 117, 0.08)', badge: '#e95075'},
  {border: '#50c8e9', background: 'rgba(80, 200, 233, 0.08)', badge: '#50c8e9'},
  {border: '#b950e9', background: 'rgba(185, 80, 233, 0.08)', badge: '#b950e9'},
  {border: '#e9d250', background: 'rgba(233, 210, 80, 0.08)', badge: '#e9d250'},
]

export function getSelectionColor(index: number): SelectionColor {
  return SELECTION_COLORS[index % SELECTION_COLORS.length]!
}
