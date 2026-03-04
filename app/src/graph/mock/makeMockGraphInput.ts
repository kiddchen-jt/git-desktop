import { GraphInput } from '../types'

export function makeSmallMockGraphInput(): GraphInput {
  const commits = [
    {
      id: 'c0',
      parents: ['c1', 'f2'],
      authorTime: 1_700_000_000,
      subject: 'Merge feature branch',
    },
    {
      id: 'c1',
      parents: ['c2'],
      authorTime: 1_699_999_940,
      subject: 'Fix release notes',
    },
    {
      id: 'f2',
      parents: ['f1'],
      authorTime: 1_699_999_900,
      subject: 'Feature polish',
    },
    {
      id: 'f1',
      parents: ['c3'],
      authorTime: 1_699_999_840,
      subject: 'Feature scaffold',
    },
    {
      id: 'c2',
      parents: ['c3'],
      authorTime: 1_699_999_780,
      subject: 'Prepare v1.0',
    },
    {
      id: 'c3',
      parents: ['c4'],
      authorTime: 1_699_999_720,
      subject: 'Base stabilization',
    },
    {
      id: 'c4',
      parents: [],
      authorTime: 1_699_999_660,
      subject: 'Initial commit',
    },
  ]

  return {
    commits,
    refs: [
      {
        name: 'main',
        full: 'refs/heads/main',
        target: 'c0',
        type: 'branch',
      },
      {
        name: 'origin/main',
        full: 'refs/remotes/origin/main',
        target: 'c0',
        type: 'branch',
        isRemote: true,
      },
      {
        name: 'release/1.0',
        full: 'refs/heads/release/1.0',
        target: 'c2',
        type: 'branch',
      },
      {
        name: 'feature/demo',
        full: 'refs/heads/feature/demo',
        target: 'f2',
        type: 'branch',
      },
      {
        name: 'origin/feature/demo',
        full: 'refs/remotes/origin/feature/demo',
        target: 'f2',
        type: 'branch',
        isRemote: true,
      },
      {
        name: 'v1.0.0',
        full: 'refs/tags/v1.0.0',
        target: 'c3',
        type: 'tag',
      },
    ],
    head: {
      type: 'detached',
      detachedTarget: 'c1',
    },
  }
}

export function makeLargeMockGraphInput(
  commitCount: number = 2000,
  seed: number = 0
): GraphInput {
  const commits: GraphInput['commits'][number][] = []

  for (let i = 0; i < commitCount; i++) {
    const id = makeCommitId(i)
    const parents: Array<string> = []

    if (i + 1 < commitCount) {
      parents.push(makeCommitId(i + 1))
    }

    if (i % 25 === 0 && i + 80 < commitCount) {
      parents.push(makeCommitId(i + 80))
    }

    if (i % 40 === 10 && i + 45 < commitCount) {
      parents.push(makeCommitId(i + 45))
    }

    commits.push({
      id,
      parents,
      authorTime: 1_700_100_000 - i * 90 - seed,
      subject: `Mock commit ${i} (seed ${seed})`,
    })
  }

  const refs: GraphInput['refs'] = [
    {
      name: 'main',
      full: 'refs/heads/main',
      target: makeCommitId(0),
      type: 'branch',
    },
    {
      name: 'origin/main',
      full: 'refs/remotes/origin/main',
      target: makeCommitId(0),
      type: 'branch',
      isRemote: true,
    },
    {
      name: 'perf/baseline',
      full: 'refs/heads/perf/baseline',
      target: makeCommitId(Math.min(120, commitCount - 1)),
      type: 'branch',
    },
    {
      name: 'origin/perf/baseline',
      full: 'refs/remotes/origin/perf/baseline',
      target: makeCommitId(Math.min(120, commitCount - 1)),
      type: 'branch',
      isRemote: true,
    },
    {
      name: 'v2.0.0',
      full: 'refs/tags/v2.0.0',
      target: makeCommitId(Math.min(600, commitCount - 1)),
      type: 'tag',
    },
  ]

  return {
    commits,
    refs,
    head: {
      type: 'symbolic',
      targetRef: 'refs/heads/main',
    },
  }
}

function makeCommitId(index: number): string {
  return `c${index.toString(16).padStart(5, '0')}`
}
