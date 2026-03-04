export interface IGraphCommitInput {
  readonly id: string
  readonly parents: ReadonlyArray<string>
  readonly authorTime: number
  readonly subject: string
}

export interface IGraphRefInput {
  readonly name: string
  readonly full: string
  readonly target: string
  readonly type: 'branch' | 'tag'
  readonly isRemote?: boolean
}

export type GraphHeadInput =
  | { readonly type: 'symbolic'; readonly targetRef: string }
  | { readonly type: 'detached'; readonly detachedTarget: string }

export type GraphInput = {
  readonly commits: ReadonlyArray<IGraphCommitInput>
  readonly refs: ReadonlyArray<IGraphRefInput>
  readonly head: GraphHeadInput
}

export interface IGraphLayoutNode {
  readonly id: string
  readonly lane: number
  readonly row: number
  readonly x: number
  readonly y: number
  readonly parents: ReadonlyArray<string>
  readonly subject: string
  readonly authorTime: number
  readonly refs: ReadonlyArray<string>
  readonly isMerge: boolean
}

export interface IGraphLayoutEdge {
  readonly from: string
  readonly to: string
  readonly style: 'mainline' | 'merge'
  readonly fromLane: number
  readonly toLane: number
  readonly fromRow: number
  readonly toRow: number
}

export type GraphLayout = {
  readonly nodes: ReadonlyArray<IGraphLayoutNode>
  readonly edges: ReadonlyArray<IGraphLayoutEdge>
  readonly meta: {
    readonly rowHeight: number
    readonly laneWidth: number
    readonly maxLane: number
    readonly rowCount: number
  }
}
