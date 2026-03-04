import * as React from 'react'
import { laneColor } from './colors'
import { GraphLayout, IGraphLayoutEdge, IGraphLayoutNode } from './types'

interface IGraphCanvasProps {
  readonly layout: GraphLayout
  readonly selectedCommitId: string | null
  readonly onSelectCommit: (commitId: string) => void
}

interface IPoint {
  readonly x: number
  readonly y: number
}

let hasLoggedDrawError = false

const OverscanRows = 10
const NodeRadius = 4
const MinGraphColWidth = 120
export const GRAPH_PADDING = 24
const VisibleRefsCount = 3

export function GraphCanvas(props: IGraphCanvasProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  const [viewportSize, setViewportSize] = React.useState({ width: 1, height: 1 })
  const [scrollTop, setScrollTop] = React.useState(0)

  const graphColWidth = React.useMemo(() => {
    const preferred = (props.layout.meta.maxLane + 1) * props.layout.meta.laneWidth + GRAPH_PADDING
    return Math.max(preferred, MinGraphColWidth)
  }, [props.layout.meta.laneWidth, props.layout.meta.maxLane])

  const totalHeight = props.layout.meta.rowCount * props.layout.meta.rowHeight

  const nodesByRow = React.useMemo(() => {
    const rows = new Array<IGraphLayoutNode | undefined>(props.layout.meta.rowCount)
    for (const node of props.layout.nodes) {
      rows[node.row] = node
    }

    return rows
  }, [props.layout])

  const edgesByFromRow = React.useMemo(() => {
    const byRow = new Map<number, Array<IGraphLayoutEdge>>()

    for (const edge of props.layout.edges) {
      const edges = byRow.get(edge.fromRow) ?? []
      edges.push(edge)
      byRow.set(edge.fromRow, edges)
    }

    return byRow
  }, [props.layout])

  React.useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) {
      return
    }

    const updateSize = () => {
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    }

    updateSize()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateSize())
        : null

    resizeObserver?.observe(viewport)
    window.addEventListener('resize', updateSize)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  const visibleRows = React.useMemo(() => {
    const start = Math.max(
      0,
      Math.floor(scrollTop / props.layout.meta.rowHeight) - OverscanRows
    )
    const end = Math.min(
      props.layout.meta.rowCount - 1,
      Math.ceil((scrollTop + viewportSize.height) / props.layout.meta.rowHeight) + OverscanRows
    )

    return { start, end }
  }, [
    props.layout.meta.rowCount,
    props.layout.meta.rowHeight,
    scrollTop,
    viewportSize.height,
  ])

  const toScreen = React.useCallback(
    (x: number, y: number): IPoint => {
      return {
        x,
        y: y - scrollTop,
      }
    },
    [scrollTop]
  )

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(graphColWidth * dpr))
    canvas.height = Math.max(1, Math.floor(viewportSize.height * dpr))
    canvas.style.width = `${graphColWidth}px`
    canvas.style.height = `${viewportSize.height}px`

    const context = canvas.getContext('2d')
    if (context === null) {
      return
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, graphColWidth, viewportSize.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'

    try {
      for (let row = visibleRows.start; row <= visibleRows.end; row++) {
        const rowEdges = edgesByFromRow.get(row)
        if (rowEdges === undefined) {
          continue
        }

        for (const edge of rowEdges) {
          drawEdge(
            context,
            edge,
            props.layout.meta.laneWidth,
            props.layout.meta.rowHeight,
            toScreen
          )
        }
      }

      for (let row = visibleRows.start; row <= visibleRows.end; row++) {
        const node = nodesByRow[row]
        if (node === undefined) {
          continue
        }

        drawNode(
          context,
          node,
          node.id === props.selectedCommitId,
          props.layout.meta.laneWidth,
          props.layout.meta.rowHeight,
          toScreen
        )
      }
    } catch (error) {
      if (!hasLoggedDrawError) {
        hasLoggedDrawError = true
        console.error('[graph-demo] canvas draw failed', error)
      }
    }
  }, [
    edgesByFromRow,
    graphColWidth,
    nodesByRow,
    props.layout.meta.laneWidth,
    props.layout.meta.rowHeight,
    props.selectedCommitId,
    toScreen,
    viewportSize.height,
    visibleRows.end,
    visibleRows.start,
  ])

  const visibleNodes = React.useMemo(() => {
    const nodes: Array<IGraphLayoutNode> = []
    for (let row = visibleRows.start; row <= visibleRows.end; row++) {
      const node = nodesByRow[row]
      if (node !== undefined) {
        nodes.push(node)
      }
    }

    return nodes
  }, [nodesByRow, visibleRows.end, visibleRows.start])

  const onScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  const onRowClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const commitId = event.currentTarget.dataset.commitId
      if (commitId !== undefined) {
        props.onSelectCommit(commitId)
      }
    },
    [props]
  )

  const onRowKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      const commitId = event.currentTarget.dataset.commitId
      if (commitId !== undefined) {
        props.onSelectCommit(commitId)
      }
    },
    [props]
  )

  return (
    <div className="graph-rowview-root">
      <div className="graph-rowview-scroll" ref={viewportRef} onScroll={onScroll}>
        <div className="graph-rowview-spacer" style={{ height: totalHeight }}>
          {visibleNodes.map(node => {
            const top = node.row * props.layout.meta.rowHeight
            const isSelected = node.id === props.selectedCommitId
            const shortSha = node.id.slice(0, 7)
            const date = formatDateYYYYMMDD(node.authorTime)
            const visibleRefs = node.refs.slice(0, VisibleRefsCount)
            const extraRefCount = Math.max(0, node.refs.length - visibleRefs.length)

            return (
              <div
                key={node.id}
                className={isSelected ? 'graph-row graph-row-selected' : 'graph-row'}
                style={{ top, height: props.layout.meta.rowHeight }}
                data-commit-id={node.id}
                role="button"
                tabIndex={-1}
                onClick={onRowClick}
                onKeyDown={onRowKeyDown}
              >
                <span className="graph-row-col graph-row-col-graph" style={{ width: graphColWidth }} />
                <span className="graph-row-col graph-row-col-subject">
                  <span className="graph-row-subject-text">
                    {node.subject}
                  </span>
                  {visibleRefs.map(ref => (
                    <span key={`${node.id}-${ref}`} className="graph-row-ref-pill">
                      {ref}
                    </span>
                  ))}
                  {extraRefCount > 0 && (
                    <span className="graph-row-ref-pill graph-row-ref-pill-extra">+{extraRefCount}</span>
                  )}
                </span>
                <span className="graph-row-col graph-row-col-sha">{shortSha}</span>
                <span className="graph-row-col graph-row-col-date">{date}</span>
              </div>
            )
          })}
        </div>
      </div>

      <canvas ref={canvasRef} className="graph-rowview-canvas" />
    </div>
  )
}

function drawEdge(
  context: CanvasRenderingContext2D,
  edge: IGraphLayoutEdge,
  laneWidth: number,
  rowHeight: number,
  toScreen: (x: number, y: number) => IPoint
) {
  const x0 = edge.fromLane * laneWidth + laneWidth / 2
  const y0 = edge.fromRow * rowHeight + rowHeight / 2
  const x1 = edge.toLane * laneWidth + laneWidth / 2
  const y1 = edge.toRow * rowHeight + rowHeight / 2

  const from = toScreen(x0, y0)
  const to = toScreen(x1, y1)

  context.beginPath()
  context.strokeStyle = laneColor(edge.fromLane)

  if (edge.style === 'merge') {
    context.lineWidth = 1.5
    context.globalAlpha = 0.7
    context.setLineDash([4, 4])
  } else {
    context.lineWidth = 2.2
    context.globalAlpha = 1
    context.setLineDash([])
  }

  context.moveTo(from.x, from.y)
  if (edge.fromLane === edge.toLane) {
    context.lineTo(from.x, to.y)
  } else {
    context.lineTo(to.x, from.y)
    context.lineTo(to.x, to.y)
  }
  context.stroke()

  context.setLineDash([])
  context.globalAlpha = 1
}

function drawNode(
  context: CanvasRenderingContext2D,
  node: IGraphLayoutNode,
  isSelected: boolean,
  laneWidth: number,
  rowHeight: number,
  toScreen: (x: number, y: number) => IPoint
) {
  const point = toScreen(node.x + laneWidth / 2, node.y + rowHeight / 2)
  const color = laneColor(node.lane)

  context.beginPath()
  context.fillStyle = color
  context.arc(point.x, point.y, NodeRadius + (isSelected ? 1.8 : 0), 0, Math.PI * 2)
  context.fill()

  if (isSelected) {
    context.beginPath()
    context.strokeStyle = '#0d1117'
    context.lineWidth = 1.5
    context.arc(point.x, point.y, NodeRadius + 3.8, 0, Math.PI * 2)
    context.stroke()
  }
}

function formatDateYYYYMMDD(authorTime: number): string {
  const timestampMs = authorTime > 10_000_000_000 ? authorTime : authorTime * 1000
  if (!Number.isFinite(timestampMs)) {
    return 'N/A'
  }

  const date = new Date(timestampMs)
  if (Number.isNaN(date.getTime())) {
    return 'N/A'
  }

  return date.toISOString().slice(0, 10)
}
