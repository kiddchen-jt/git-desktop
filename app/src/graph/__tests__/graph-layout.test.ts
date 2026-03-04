import assert from 'node:assert'
import { describe, it } from 'node:test'
import { buildGraphLayout } from '../graph-layout'
import { makeSmallMockGraphInput } from '../mock/makeMockGraphInput'

describe('graph-layout', () => {
  it('assigns deterministic lanes for fixed input', () => {
    const input = makeSmallMockGraphInput()
    const layout = buildGraphLayout(input, { rowHeight: 20, laneWidth: 12 })

    const laneByCommit = new Map(layout.nodes.map(node => [node.id, node.lane]))

    assert.equal(laneByCommit.get('c0'), 0)
    assert.equal(laneByCommit.get('c1'), 0)
    assert.equal(laneByCommit.get('f2'), 1)
    assert.equal(laneByCommit.get('f1'), 1)
    assert.equal(laneByCommit.get('c2'), 0)
    assert.equal(laneByCommit.get('c3'), 0)
    assert.equal(laneByCommit.get('c4'), 0)
  })

  it('creates expected edges and styles', () => {
    const input = makeSmallMockGraphInput()
    const layout = buildGraphLayout(input)

    const shape = layout.edges
      .map(edge => `${edge.from}->${edge.to}:${edge.style}:${edge.fromLane}->${edge.toLane}`)
      .sort()

    assert.deepEqual(shape, [
      'c0->c1:mainline:0->0',
      'c0->f2:merge:0->1',
      'c1->c2:mainline:0->0',
      'c2->c3:mainline:0->0',
      'c3->c4:mainline:0->0',
      'f1->c3:mainline:1->0',
      'f2->f1:mainline:1->1',
    ])
  })

  it('sorts refs deterministically with HEAD first', () => {
    const input = makeSmallMockGraphInput()
    const withSymbolicHead = {
      ...input,
      refs: [
        ...input.refs,
        {
          name: 'v-top',
          full: 'refs/tags/v-top',
          target: 'c0',
          type: 'tag' as const,
        },
      ],
      head: {
        type: 'symbolic' as const,
        targetRef: 'refs/heads/main',
      },
    }

    const layout = buildGraphLayout(withSymbolicHead)
    const node = layout.nodes.find(x => x.id === 'c0')

    assert.ok(node)
    assert.deepEqual(node.refs, ['HEAD', 'main', 'origin/main', 'v-top'])
  })

  it('returns identical output for repeated runs', () => {
    const input = makeSmallMockGraphInput()
    const first = buildGraphLayout(input)
    const second = buildGraphLayout(input)

    assert.deepEqual(first, second)
  })

  it('drops edges whose parent is outside the input commit set', () => {
    const input = {
      commits: [
        {
          id: 'c0',
          parents: ['missing-parent'],
          authorTime: 1700000000,
          subject: 'top',
        },
      ],
      refs: [],
      head: {
        type: 'detached' as const,
        detachedTarget: 'c0',
      },
    }

    const layout = buildGraphLayout(input)
    assert.equal(layout.edges.length, 0)
    assert.equal(layout.meta.unresolvedEdges, 1)
  })

  it('releases stale lane expectations and reuses lower lane indexes', () => {
    const input = {
      commits: [
        {
          id: 'c0',
          parents: ['c1', 'm1'],
          authorTime: 1700000000,
          subject: 'merge into main',
        },
        {
          id: 'm1',
          parents: ['missing-parent'],
          authorTime: 1699999999,
          subject: 'side branch top',
        },
        {
          id: 'c1',
          parents: ['c2'],
          authorTime: 1699999998,
          subject: 'main',
        },
        {
          id: 'b0',
          parents: ['b1'],
          authorTime: 1699999997,
          subject: 'new branch',
        },
        {
          id: 'b1',
          parents: [],
          authorTime: 1699999996,
          subject: 'new branch base',
        },
        {
          id: 'c2',
          parents: [],
          authorTime: 1699999995,
          subject: 'main base',
        },
      ],
      refs: [],
      head: {
        type: 'detached' as const,
        detachedTarget: 'c0',
      },
    }

    const layout = buildGraphLayout(input)
    const laneByCommit = new Map(layout.nodes.map(node => [node.id, node.lane]))

    // If stale expected values are not released, b0 ends up on lane 2.
    assert.equal(laneByCommit.get('b0'), 1)
  })
})
