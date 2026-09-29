import { CHILD_LEVEL, PARENT_LEVEL } from '@/lib/constants'
import type { ReqLevel, Requirement } from '@/types'

export function reqLevel(r: Pick<Requirement, 'level'> | undefined | null): ReqLevel {
  return r?.level || '产品需求'
}

export function nextProductReqNo(projectCode: string, requirements: Requirement[]) {
  const re = new RegExp(`^${escapeRegExp(projectCode)}-(\\d+)$`)
  let max = 0
  for (const r of requirements) {
    if (reqLevel(r) !== '产品需求') continue
    const m = r.reqNo.match(re)
    if (!m) continue
    const n = Number.parseInt(m[1], 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  return `${projectCode}-${String(max + 1).padStart(4, '0')}`
}

export function nextChildReqNo(parent: Requirement, requirements: Requirement[], childLevel: ReqLevel) {
  const mark = childLevel === '模块需求' ? 'M' : 'P'
  const prefix = `${parent.reqNo}-${mark}`
  let max = 0
  for (const r of requirements) {
    if (!r.reqNo.startsWith(prefix)) continue
    const n = Number.parseInt(r.reqNo.slice(prefix.length), 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

export function previewReqNo(
  projectCode: string,
  requirements: Requirement[],
  level: ReqLevel,
  parent?: Requirement | null,
) {
  if (level === '产品需求') return nextProductReqNo(projectCode, requirements)
  if (!parent) return level === '模块需求' ? `${projectCode}-□□□□-M01` : '选择父需求后自动生成'
  return nextChildReqNo(parent, requirements, level)
}

export function childrenOf(parentId: number, requirements: Requirement[]) {
  return requirements.filter((r) => r.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function parentOf(req: Requirement, requirements: Requirement[]) {
  if (!req.parentId) return undefined
  return requirements.find((r) => r.id === req.parentId)
}

export function descendantIds(id: number, requirements: Requirement[]): number[] {
  const kids = childrenOf(id, requirements)
  return kids.flatMap((k) => [k.id, ...descendantIds(k.id, requirements)])
}

export function childLevelOf(level: ReqLevel) {
  return CHILD_LEVEL[level]
}

export function parentLevelOf(level: ReqLevel) {
  return PARENT_LEVEL[level]
}

export type ReqTreeNode = {
  req: Requirement
  children: ReqTreeNode[]
}

export function buildReqTree(requirements: Requirement[]): ReqTreeNode[] {
  const ids = new Set(requirements.map((r) => r.id))
  const byParent = new Map<number | 'root', Requirement[]>()
  for (const r of requirements) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : 'root'
    const list = byParent.get(key) ?? []
    list.push(r)
    byParent.set(key, list)
  }
  const sort = (list: Requirement[]) => [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  const walk = (parentKey: number | 'root'): ReqTreeNode[] =>
    sort(byParent.get(parentKey) ?? []).map((req) => ({
      req,
      children: walk(req.id),
    }))
  return walk('root')
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function flattenReqTree(requirements: Requirement[]): Requirement[] {
  const walk = (nodes: ReqTreeNode[]): Requirement[] => nodes.flatMap((n) => [n.req, ...walk(n.children)])
  return walk(buildReqTree(requirements))
}

export function inferParentReqNo(reqNo: string) {
  const m = reqNo.match(/^(.*)-(?:M|P)\d+$/)
  return m?.[1]
}
