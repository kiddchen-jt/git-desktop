import * as React from 'react'
import { Repository } from '../models/repository'
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/lib/button'
import { GRAPH_PADDING, GraphCanvas } from './GraphCanvas'
import { buildGraphLayout } from './graph-layout'
import { getGraphInputForRepository } from './live/getGraphInputForRepository'
import { makeLargeMockGraphInput, makeSmallMockGraphInput } from './mock/makeMockGraphInput'
import { GraphInput, GraphLayout } from './types'

type GraphSourceKind = 'mock-small' | 'mock-large' | 'live'

interface IGraphDemoProps {
  readonly onDismissed: () => void
  readonly repository: Repository | null
}

const EmptyInput: GraphInput = {
  commits: [],
  refs: [],
  head: { type: 'detached', detachedTarget: '' },
}

const DefaultRowHeight = 28
const DefaultLaneWidth = 22

export function GraphDemo(props: IGraphDemoProps) {
  const [source, setSource] = React.useState<GraphSourceKind>('mock-small')
  const [selectedCommitId, setSelectedCommitId] = React.useState<string | null>(null)
  const [largeSeed, setLargeSeed] = React.useState(0)
  const [liveLimit, setLiveLimit] = React.useState(500)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [layout, setLayout] = React.useState<GraphLayout>(() =>
    buildGraphLayout(makeSmallMockGraphInput(), {
      rowHeight: DefaultRowHeight,
      laneWidth: DefaultLaneWidth,
    })
  )
  const [datasetError, setDatasetError] = React.useState<string | null>(null)
  const [isLoadingDataset, setIsLoadingDataset] = React.useState(false)
  const [liveInfoMessage, setLiveInfoMessage] = React.useState<string | null>(null)

  const selectedNode = React.useMemo(() => {
    return layout.nodes.find(node => node.id === selectedCommitId) ?? null
  }, [layout.nodes, selectedCommitId])

  const graphColWidth = React.useMemo(() => {
    return Math.max((layout.meta.maxLane + 1) * layout.meta.laneWidth + GRAPH_PADDING, 120)
  }, [layout.meta.laneWidth, layout.meta.maxLane])

  React.useEffect(() => {
    setSelectedCommitId(layout.nodes[0]?.id ?? null)
  }, [layout.nodes])

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoadingDataset(true)
      setDatasetError(null)
      setLiveInfoMessage(null)

      try {
        let nextInput: GraphInput

        if (source === 'mock-small') {
          nextInput = makeSmallMockGraphInput()
        } else if (source === 'mock-large') {
          // Keep heavy sync work off the click event turn.
          await waitForNextTick()
          nextInput = makeLargeMockGraphInput(2000, largeSeed)
        } else if (props.repository === null) {
          nextInput = EmptyInput
          setLiveInfoMessage('No repository is currently selected.')
        } else if (props.repository.missing) {
          nextInput = EmptyInput
          setLiveInfoMessage(`Repository is missing on disk: ${props.repository.path}`)
        } else {
          nextInput = await getGraphInputForRepository(props.repository, liveLimit)
          if (nextInput.commits.length === 0) {
            setLiveInfoMessage('Repository has no commits to display.')
          }
        }

        const nextLayout = buildGraphLayout(nextInput, {
          rowHeight: DefaultRowHeight,
          laneWidth: DefaultLaneWidth,
        })

        if (!cancelled) {
          setLayout(nextLayout)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.stack ?? error.message : String(error)
          setDatasetError(message)
          console.error('[graph-demo] failed to load dataset', error)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDataset(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [liveLimit, largeSeed, props.repository, reloadToken, source])

  const onRebuildLargeMock = React.useCallback(() => {
    setLargeSeed(seed => seed + 1)
    setSource('mock-large')
  }, [])

  const onSelectMockSmall = React.useCallback(() => {
    setSource('mock-small')
  }, [])

  const onSelectMockLarge = React.useCallback(() => {
    setSource('mock-large')
  }, [])

  const onSelectLive = React.useCallback(() => {
    setSource('live')
  }, [])

  const onReloadLive = React.useCallback(() => {
    setReloadToken(token => token + 1)
  }, [])

  const onSetLiveLimit200 = React.useCallback(() => {
    setLiveLimit(200)
  }, [])

  const onSetLiveLimit500 = React.useCallback(() => {
    setLiveLimit(500)
  }, [])

  const onSetLiveLimit2000 = React.useCallback(() => {
    setLiveLimit(2000)
  }, [])

  return (
    <Dialog
      id="graph-demo"
      title="Commit Graph Demo (Row View)"
      onDismissed={props.onDismissed}
      className="graph-demo-dialog"
    >
      <DialogContent>
        <div className="graph-demo-controls">
          <div className="graph-demo-dataset-toggle" role="group" aria-label="Data source">
            <Button onClick={onSelectMockSmall} disabled={source === 'mock-small' || isLoadingDataset}>
              Mock (Small)
            </Button>
            <Button onClick={onSelectMockLarge} disabled={source === 'mock-large' || isLoadingDataset}>
              Mock (Large)
            </Button>
            <Button onClick={onSelectLive} disabled={source === 'live' || isLoadingDataset}>
              Live (Current Repository)
            </Button>
            <Button onClick={onRebuildLargeMock} disabled={source !== 'mock-large' || isLoadingDataset}>
              Rebuild large mock
            </Button>
            <Button onClick={onReloadLive} disabled={source !== 'live' || isLoadingDataset}>
              Reload
            </Button>
          </div>
          <div className="graph-demo-meta">
            source: {source} | rows: {layout.meta.rowCount.toLocaleString()} | rowHeight: {layout.meta.rowHeight} | graphColWidth:{' '}
            {graphColWidth} | edges: {layout.edges.length.toLocaleString()} | lanes: 0-{layout.meta.maxLane}
            {isLoadingDataset ? ' | loading dataset...' : ''}
          </div>
        </div>

        {source === 'live' && (
          <div className="graph-demo-live-controls">
            <div className="graph-demo-live-repo">
              repo: {props.repository?.name ?? 'N/A'} ({props.repository?.path ?? 'no repository selected'})
            </div>
            <div className="graph-demo-dataset-toggle" role="group" aria-label="Live commit limit">
              <Button onClick={onSetLiveLimit200} disabled={isLoadingDataset || liveLimit === 200}>
                200
              </Button>
              <Button onClick={onSetLiveLimit500} disabled={isLoadingDataset || liveLimit === 500}>
                500
              </Button>
              <Button onClick={onSetLiveLimit2000} disabled={isLoadingDataset || liveLimit === 2000}>
                2000
              </Button>
            </div>
          </div>
        )}

        <div className="graph-demo-canvas-wrap">
          <GraphCanvas
            layout={layout}
            selectedCommitId={selectedCommitId}
            onSelectCommit={setSelectedCommitId}
          />
        </div>

        {liveInfoMessage !== null && (
          <div className="graph-demo-detail-panel">
            <div className="graph-demo-selection-line">{liveInfoMessage}</div>
          </div>
        )}

        {datasetError !== null && (
          <div className="graph-demo-detail-panel">
            <div className="graph-demo-selection-line">
              <strong>Dataset Error</strong>
            </div>
            <textarea
              className="graph-demo-error-block"
              value={datasetError}
              readOnly={true}
              rows={4}
              aria-label="Dataset error"
            />
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

function waitForNextTick(): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, 0)
  })
}
