import { GraphInput, GraphLayout, IGraphLayoutEdge, IGraphRefInput } from './types'

interface IBuildGraphLayoutOptions {
  readonly rowHeight?: number
  readonly laneWidth?: number
}

interface ILaneState {
  expected?: string
}

interface IPendingEdge {
  readonly from: string
  readonly to: string
  readonly style: 'mainline' | 'merge'
  readonly fromLane: number
  readonly fromRow: number
}

interface IResolvedRef {
  readonly name: string
  readonly category: 0 | 1 | 2 | 3
}

const DefaultRowHeight = 28
const DefaultLaneWidth = 22

/**
 * Build a deterministic lane-based layout for a topologically sorted graph
 * where commits are ordered from newest to oldest.
 */
export function buildGraphLayout(
  input: GraphInput,
  opts: IBuildGraphLayoutOptions = {}
): GraphLayout {
  const rowHeight = opts.rowHeight ?? DefaultRowHeight
  const laneWidth = opts.laneWidth ?? DefaultLaneWidth

  const lanes: Array<ILaneState> = []
  const commitLane = new Map<string, number>()
  const commitRow = new Map<string, number>()
  const pendingEdges = new Map<string, Array<IPendingEdge>>()
  const commitIdSet = new Set(input.commits.map(c => c.id))
  const remainingCommitIds = new Set(input.commits.map(c => c.id))
  let unresolvedEdges = 0

  const nodes: Array<GraphLayout['nodes'][number]> = []
  const edges: Array<IGraphLayoutEdge> = []

  const refsByCommit = resolveRefsByCommit(input)

  const addEdge = (
    from: string,
    to: string,
    style: 'mainline' | 'merge',
    fromLane: number,
    fromRow: number
  ) => {
    // Parent is outside the loaded commit window (live list boundary).
    // Drop edge deterministically to avoid unresolved coordinates.
    if (!commitIdSet.has(to)) {
      unresolvedEdges++
      return
    }

    const toLane = commitLane.get(to)
    const toRow = commitRow.get(to)

    if (toLane !== undefined && toRow !== undefined) {
      edges.push({
        from,
        to,
        style,
        fromLane,
        toLane,
        fromRow,
        toRow,
      })
      return
    }

    const pending = pendingEdges.get(to) ?? []
    pending.push({ from, to, style, fromLane, fromRow })
    pendingEdges.set(to, pending)
  }

  for (let row = 0; row < input.commits.length; row++) {
    const commit = input.commits[row]
    const usedLanesThisRow = new Set<number>()

    let lane = lanes.findIndex(x => x.expected === commit.id)

    if (lane === -1) {
      lane = lanes.findIndex(
        (x, index) => x.expected === undefined && !usedLanesThisRow.has(index)
      )
    }

    if (lane === -1) {
      lane = lanes.length
      lanes.push({})
    }

    usedLanesThisRow.add(lane)

    commitLane.set(commit.id, lane)
    commitRow.set(commit.id, row)

    const mainlineParent = commit.parents[0]

    if (mainlineParent !== undefined) {
      addEdge(commit.id, mainlineParent, 'mainline', lane, row)
      lanes[lane].expected = mainlineParent
    } else {
      lanes[lane].expected = undefined
    }

    for (let i = 1; i < commit.parents.length; i++) {
      const mergeParent = commit.parents[i]
      if (mergeParent !== undefined) {
        addEdge(commit.id, mergeParent, 'merge', lane, row)
      }
    }

    const pending = pendingEdges.get(commit.id)
    if (pending !== undefined) {
      for (const pendingEdge of pending) {
        edges.push({
          from: pendingEdge.from,
          to: pendingEdge.to,
          style: pendingEdge.style,
          fromLane: pendingEdge.fromLane,
          toLane: lane,
          fromRow: pendingEdge.fromRow,
          toRow: row,
        })
      }

      pendingEdges.delete(commit.id)
    }

    nodes.push({
      id: commit.id,
      lane,
      row,
      x: lane * laneWidth,
      y: row * rowHeight,
      parents: [...commit.parents],
      subject: commit.subject,
      authorTime: commit.authorTime,
      refs: refsByCommit.get(commit.id) ?? [],
      isMerge: commit.parents.length > 1,
    })

    remainingCommitIds.delete(commit.id)

    // Release lane expectations that cannot ever be fulfilled by remaining rows.
    for (const laneState of lanes) {
      if (
        laneState.expected !== undefined &&
        !remainingCommitIds.has(laneState.expected)
      ) {
        laneState.expected = undefined
      }
    }
  }

  for (const pending of pendingEdges.values()) {
    unresolvedEdges += pending.length
  }

  let maxLane = 0
  for (const node of nodes) {
    if (node.lane > maxLane) {
      maxLane = node.lane
    }
  }

  return {
    nodes,
    edges,
    meta: {
      rowHeight,
      laneWidth,
      maxLane,
      rowCount: input.commits.length,
      unresolvedEdges,
    },
  }
}

function resolveRefsByCommit(input: GraphInput): Map<string, ReadonlyArray<string>> {
  const byCommit = new Map<string, Array<IResolvedRef>>()

  const pushResolved = (target: string, ref: IResolvedRef) => {
    const refs = byCommit.get(target) ?? []
    refs.push(ref)
    byCommit.set(target, refs)
  }

  for (const ref of input.refs) {
    pushResolved(ref.target, mapRefToResolved(ref))
  }

  const head = input.head
  if (head.type === 'symbolic') {
    const target = input.refs.find(x => x.full === head.targetRef)?.target
    if (target !== undefined) {
      pushResolved(target, { name: 'HEAD', category: 0 })
    }
  } else {
    pushResolved(head.detachedTarget, { name: 'HEAD', category: 0 })
  }

  const result = new Map<string, ReadonlyArray<string>>()

  for (const [commitId, refs] of byCommit) {
    const sorted = [...refs].sort((a, b) => {
      if (a.category !== b.category) {
        return a.category - b.category
      }

      return a.name.localeCompare(b.name)
    })

    result.set(
      commitId,
      sorted.map(x => x.name)
    )
  }

  return result
}

function mapRefToResolved(ref: IGraphRefInput): IResolvedRef {
  if (ref.type === 'branch') {
    return {
      name: ref.name,
      category: ref.isRemote === true ? 2 : 1,
    }
  }

  return {
    name: ref.name,
    category: 3,
  }
}
