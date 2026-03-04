import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/lib/button'
import { buildGraphLayout } from './graph-layout'
import { GRAPH_PADDING, GraphCanvas } from './GraphCanvas'
import { makeLargeMockGraphInput, makeSmallMockGraphInput } from './mock/makeMockGraphInput'
import { GraphLayout } from './types'

type DatasetKind = 'small' | 'large'

interface IGraphDemoProps {
  readonly onDismissed: () => void
}

export function GraphDemo(props: IGraphDemoProps) {
  const [dataset, setDataset] = React.useState<DatasetKind>('small')
  const [selectedCommitId, setSelectedCommitId] = React.useState<string | null>(null)
  const [largeSeed, setLargeSeed] = React.useState(0)
  const [layout, setLayout] = React.useState<GraphLayout>(() =>
    buildGraphLayout(makeSmallMockGraphInput(), { rowHeight: 28, laneWidth: 22 })
  )
  const [datasetError, setDatasetError] = React.useState<string | null>(null)
  const [isLoadingDataset, setIsLoadingDataset] = React.useState(false)

  const selectedNode = React.useMemo(() => {
    return layout.nodes.find(node => node.id === selectedCommitId) ?? null
  }, [layout.nodes, selectedCommitId])

  const graphColWidth = React.useMemo(() => {
    return Math.max((layout.meta.maxLane + 1) * layout.meta.laneWidth + GRAPH_PADDING, 120)
  }, [layout.meta.laneWidth, layout.meta.maxLane])

  React.useEffect(() => {
    setSelectedCommitId(layout.nodes[0]?.id ?? null)
  }, [layout.nodes])

  const loadDataset = React.useCallback((kind: DatasetKind, seed: number) => {
    try {
      const nextInput =
        kind === 'small' ? makeSmallMockGraphInput() : makeLargeMockGraphInput(2000, seed)
      const nextLayout = buildGraphLayout(nextInput, { rowHeight: 28, laneWidth: 22 })

      setLayout(nextLayout)
      setDataset(kind)
      setDatasetError(null)
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error)
      setDatasetError(message)
      console.error('[graph-demo] failed to load dataset', error)
    } finally {
      setIsLoadingDataset(false)
    }
  }, [])

  const queueLoadDataset = React.useCallback(
    (kind: DatasetKind, seed: number) => {
      setIsLoadingDataset(true)
      // Move heavy mock generation/layout out of the click event turn.
      window.setTimeout(() => loadDataset(kind, seed), 0)
    },
    [loadDataset]
  )

  const onSelectSmallDataset = React.useCallback(() => {
    queueLoadDataset('small', largeSeed)
  }, [largeSeed, queueLoadDataset])

  const onSelectLargeDataset = React.useCallback(() => {
    queueLoadDataset('large', largeSeed)
  }, [largeSeed, queueLoadDataset])

  const onRebuildLargeMock = React.useCallback(() => {
    setLargeSeed(seed => {
      const nextSeed = seed + 1
      queueLoadDataset('large', nextSeed)
      return nextSeed
    })
  }, [queueLoadDataset])

  return (
    <Dialog
      id="graph-demo"
      title="Commit Graph Demo (Row View)"
      onDismissed={props.onDismissed}
      className="graph-demo-dialog"
    >
      <DialogContent>
        <div className="graph-demo-controls">
          <div className="graph-demo-dataset-toggle" role="group" aria-label="Dataset">
            <Button
              onClick={onSelectSmallDataset}
              disabled={dataset === 'small' || isLoadingDataset}
            >
              Small dataset
            </Button>
            <Button
              onClick={onSelectLargeDataset}
              disabled={dataset === 'large' || isLoadingDataset}
            >
              Large dataset (2000)
            </Button>
            <Button
              onClick={onRebuildLargeMock}
              disabled={dataset !== 'large' || isLoadingDataset}
            >
              Rebuild large mock
            </Button>
          </div>
          <div className="graph-demo-meta">
            rows: {layout.meta.rowCount.toLocaleString()} | rowHeight: {layout.meta.rowHeight} | graphColWidth:{' '}
            {graphColWidth} | edges: {layout.edges.length.toLocaleString()} | lanes: 0-{layout.meta.maxLane}
            {isLoadingDataset ? ' | loading dataset...' : ''}
          </div>
        </div>

        <div className="graph-demo-canvas-wrap">
          <GraphCanvas
            layout={layout}
            selectedCommitId={selectedCommitId}
            onSelectCommit={setSelectedCommitId}
          />
        </div>

        {datasetError !== null && (
          <div className="graph-demo-detail-panel">
            <div className="graph-demo-selection-line">
              <strong>dataset error:</strong> {datasetError}
            </div>
          </div>
        )}

        <div className="graph-demo-detail-panel">
          {selectedNode === null ? (
            <div className="graph-demo-selection">No commit selected</div>
          ) : (
            <>
              <div className="graph-demo-selection-line">
                <strong>id:</strong> {selectedNode.id}
              </div>
              <div className="graph-demo-selection-line">
                <strong>subject:</strong> {selectedNode.subject}
              </div>
              <div className="graph-demo-selection-line">
                <strong>parents:</strong>{' '}
                {selectedNode.parents.length > 0 ? selectedNode.parents.join(', ') : '(none)'}
              </div>
              <div className="graph-demo-selection-line">
                <strong>refs:</strong> {selectedNode.refs.length > 0 ? selectedNode.refs.join(', ') : '(none)'}
              </div>
              <div className="graph-demo-selection-line">
                <strong>authorTime:</strong> {formatFullDateTime(selectedNode.authorTime)}
              </div>
              <div className="graph-demo-selection-line">
                <strong>author:</strong> N/A
              </div>
            </>
          )}
        </div>
      </DialogContent>
      <DialogFooter>
        <Button onClick={props.onDismissed}>Close</Button>
      </DialogFooter>
    </Dialog>
  )
}

function formatFullDateTime(authorTime: number): string {
  const timestampMs = authorTime > 10_000_000_000 ? authorTime : authorTime * 1000
  if (!Number.isFinite(timestampMs)) {
    return 'N/A'
  }

  const date = new Date(timestampMs)
  if (Number.isNaN(date.getTime())) {
    return 'N/A'
  }

  return date.toISOString()
}
