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
})
