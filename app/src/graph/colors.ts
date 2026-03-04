export const LANE_PALETTE: ReadonlyArray<string> = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
  '#4c78a8',
  '#f58518',
]

export function laneColor(lane: number): string {
  return LANE_PALETTE[lane % LANE_PALETTE.length]
}
