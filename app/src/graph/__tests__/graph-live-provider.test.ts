import assert from 'node:assert'
import { describe, it } from 'node:test'
import { Branch, BranchType } from '../../models/branch'
import { Commit } from '../../models/commit'
import { CommitIdentity } from '../../models/commit-identity'
import { buildGraphLayout } from '../graph-layout'
import { toGraphInput } from '../live/getGraphInputForRepository'

function createCommit(sha: string, summary: string, parents: ReadonlyArray<string>) {
  const identity = new CommitIdentity('Graph Tester', 'graph@example.com', new Date('2024-01-01T00:00:00Z'))
  return new Commit(sha, sha.slice(0, 7), summary, '', identity, identity, parents, [], [])
}

describe('graph-live-provider', () => {
  it('maps desktop commit and ref models into GraphInput', () => {
    const commits = [
      createCommit('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'top', ['bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']),
      createCommit('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'base', []),
    ]
    const branches = [
      new Branch('main', 'origin/main', { sha: commits[0].sha }, BranchType.Local, 'refs/heads/main'),
      new Branch('origin/main', null, { sha: commits[0].sha }, BranchType.Remote, 'refs/remotes/origin/main'),
    ]
    const tags = new Map<string, string>([['v1.0.0', commits[0].sha]])

    const input = toGraphInput({
      commits,
      branches,
      tags,
      symbolicHeadRef: 'refs/heads/main',
    })

    assert.equal(input.commits.length, 2)
    assert.deepEqual(input.commits[0].parents, [commits[1].sha])
    assert.equal(input.commits[0].authorTime, 1704067200)
    assert.equal(input.refs.length, 3)
    assert.deepEqual(input.head, { type: 'symbolic', targetRef: 'refs/heads/main' })
  })

  it('supports detached head fallback and layout head ordering', () => {
    const commits = [
      createCommit('cccccccccccccccccccccccccccccccccccccccc', 'top', []),
    ]
    const branches = [
      new Branch('main', null, { sha: commits[0].sha }, BranchType.Local, 'refs/heads/main'),
      new Branch('origin/main', null, { sha: commits[0].sha }, BranchType.Remote, 'refs/remotes/origin/main'),
    ]
    const tags = new Map<string, string>([['v2.0.0', commits[0].sha]])

    const input = toGraphInput({
      commits,
      branches,
      tags,
      symbolicHeadRef: null,
    })

    assert.deepEqual(input.head, {
      type: 'detached',
      detachedTarget: commits[0].sha,
    })

    const layout = buildGraphLayout(input)
    assert.deepEqual(layout.nodes[0].refs, ['HEAD', 'main', 'origin/main', 'v2.0.0'])
  })
})
