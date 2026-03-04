import { Branch, BranchType } from '../../models/branch'
import { Commit } from '../../models/commit'
import { Repository } from '../../models/repository'
import { getAllTags, getBranches, getCommits, getSymbolicRef } from '../../lib/git'
import { GraphHeadInput, GraphInput } from '../types'

interface IDesktopGraphData {
  readonly commits: ReadonlyArray<Commit>
  readonly branches: ReadonlyArray<Branch>
  readonly tags: ReadonlyMap<string, string>
  readonly symbolicHeadRef: string | null
}

export interface IGraphDataProvider {
  readonly getCommits: (
    repository: Repository,
    limit: number
  ) => Promise<ReadonlyArray<Commit>>
  readonly getBranches: (repository: Repository) => Promise<ReadonlyArray<Branch>>
  readonly getAllTags: (repository: Repository) => Promise<Map<string, string>>
  readonly getSymbolicRef: (
    repository: Repository,
    ref: string
  ) => Promise<string | null>
}

const defaultDataProvider: IGraphDataProvider = {
  getCommits: (repository, limit) => getCommits(repository, 'HEAD', limit),
  getBranches,
  getAllTags,
  getSymbolicRef,
}

export async function getGraphInputForRepository(
  repo: Repository,
  limit: number,
  provider: IGraphDataProvider = defaultDataProvider
): Promise<GraphInput> {
  const [commits, branches, tags, symbolicHeadRef] = await Promise.all([
    provider.getCommits(repo, limit),
    provider.getBranches(repo),
    provider.getAllTags(repo),
    provider.getSymbolicRef(repo, 'HEAD'),
  ])

  return toGraphInput({
    commits,
    branches,
    tags,
    symbolicHeadRef,
  })
}

export function toGraphInput(data: IDesktopGraphData): GraphInput {
  const commits = data.commits.map(commit => ({
    id: commit.sha,
    parents: [...commit.parentSHAs],
    authorTime: Math.floor(commit.author.date.getTime() / 1000),
    subject: commit.summary,
  }))

  const refs = [
    ...data.branches.map(branch => ({
      name: branch.name,
      full: branch.ref,
      target: branch.tip.sha,
      type: 'branch' as const,
      isRemote: branch.type === BranchType.Remote,
    })),
    ...Array.from(data.tags, ([name, target]) => ({
      name,
      full: `refs/tags/${name}`,
      target,
      type: 'tag' as const,
    })),
  ]

  const head: GraphHeadInput =
    data.symbolicHeadRef !== null
      ? { type: 'symbolic', targetRef: data.symbolicHeadRef }
      : {
          type: 'detached',
          detachedTarget: data.commits[0]?.sha ?? '',
        }

  return { commits, refs, head }
}
