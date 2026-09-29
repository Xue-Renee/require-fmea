import {
  CHARACTERISTIC_SYMBOLS,
  DELIVERY_PHASES,
  IMPORTANCE_LEVELS,
  LS_LIST_VIEW,
  REQ_LEVELS,
  REQ_STATUS,
  RISK_LEVELS,
  TR_STATES,
} from '@/lib/constants'
import { formatBomLabel, relatedReqNos } from '@/lib/store'
import { reqLevel } from '@/lib/hierarchy'
import { splitMulti } from '@/lib/utils'
import type { Database, Requirement } from '@/types'
import { useCallback, useState } from 'react'

export type ColKey =
  | 'reqNo'
  | 'level'
  | 'parent'
  | 'bom'
  | 'category'
  | 'feature'
  | 'spec'
  | 'specDescription'
  | 'source'
  | 'characteristicSymbol'
  | 'importance'
  | 'related'
  | 'acceptanceMethod'
  | 'riskLevel'
  | 'module'
  | 'discipline'
  | 'deliveryPhase'
  | 'tr3'
  | 'tr4'
  | 'tr4a'
  | 'tr5'
  | 'status'
  | 'remark'
  | 'actions'

export type FilterOp = 'eq' | 'neq' | 'contains' | 'notContains' | 'empty' | 'notEmpty'

export type SortKey = 'tree' | 'reqNo' | 'level' | 'category' | 'createdAt' | 'updatedAt' | 'deliveryPhase' | 'riskLevel' | 'importance' | 'characteristicSymbol'

export type FilterCondition = {
  id: string
  field: ColKey
  op: FilterOp
  value: string
}

export type ListViewState = {
  columns: ColKey[]
  filters: FilterCondition[]
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  colWidths: Partial<Record<ColKey, number>>
  toolsOpen: boolean
}

export const FILTER_OPS: { value: FilterOp; label: string }[] = [
  { value: 'eq', label: '是' },
  { value: 'neq', label: '不是' },
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
  { value: 'empty', label: '为空' },
  { value: 'notEmpty', label: '不为空' },
]

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'tree', label: '结构顺序' },
  { value: 'reqNo', label: '需求ID' },
  { value: 'level', label: '需求层级' },
  { value: 'category', label: '需求分类' },
  { value: 'riskLevel', label: '设计实现难度' },
  { value: 'importance', label: '需求重要度' },
  { value: 'characteristicSymbol', label: '特性符号' },
  { value: 'deliveryPhase', label: '交付阶段' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'updatedAt', label: '更新时间' },
]

export const LIST_COLUMNS: {
  key: ColKey
  label: string
  width: number
  required?: boolean
  sticky?: boolean
  filterable?: boolean
  valueKind?: 'enum' | 'text'
}[] = [
  { key: 'reqNo', label: '需求ID', width: 150, required: true, sticky: true, filterable: true, valueKind: 'text' },
  { key: 'level', label: '需求层级', width: 96, filterable: true, valueKind: 'enum' },
  { key: 'parent', label: '父需求', width: 120, filterable: true, valueKind: 'text' },
  { key: 'bom', label: '关联BOM零件', width: 160, filterable: true, valueKind: 'text' },
  { key: 'category', label: '需求分类', width: 96, filterable: true, valueKind: 'enum' },
  { key: 'feature', label: '需求特性', width: 110, filterable: true, valueKind: 'text' },
  { key: 'spec', label: '需求规格', width: 280, filterable: true, valueKind: 'text' },
  { key: 'specDescription', label: '需求规格描述', width: 180, filterable: true, valueKind: 'text' },
  { key: 'source', label: '需求依据/来源', width: 150, filterable: true, valueKind: 'text' },
  { key: 'characteristicSymbol', label: '特性符号', width: 92, filterable: true, valueKind: 'enum' },
  { key: 'importance', label: '需求重要度', width: 110, filterable: true, valueKind: 'enum' },
  { key: 'related', label: '关联需求', width: 140, filterable: true, valueKind: 'text' },
  { key: 'acceptanceMethod', label: '验收方式', width: 110, filterable: true, valueKind: 'enum' },
  { key: 'riskLevel', label: '设计实现难度', width: 120, filterable: true, valueKind: 'enum' },
  { key: 'module', label: '涉及模块', width: 140, filterable: true, valueKind: 'enum' },
  { key: 'discipline', label: '涉及专业', width: 120, filterable: true, valueKind: 'enum' },
  { key: 'deliveryPhase', label: '交付阶段', width: 80, filterable: true, valueKind: 'enum' },
  { key: 'tr3', label: 'TR3设计是否已包含实现', width: 168, filterable: true, valueKind: 'enum' },
  { key: 'tr4', label: 'TR4验证是否通过', width: 150, filterable: true, valueKind: 'enum' },
  { key: 'tr4a', label: 'TR4A需求是否通过', width: 150, filterable: true, valueKind: 'enum' },
  { key: 'tr5', label: 'TR5需求验收是否通过', width: 168, filterable: true, valueKind: 'enum' },
  { key: 'status', label: '状态', width: 100, filterable: true, valueKind: 'enum' },
  { key: 'remark', label: '通用要求/备注', width: 160, filterable: true, valueKind: 'text' },
  { key: 'actions', label: '操作', width: 168, required: true },
]

export const COLUMN_MAP = Object.fromEntries(LIST_COLUMNS.map((c) => [c.key, c])) as Record<ColKey, (typeof LIST_COLUMNS)[number]>

/** 需求重要度及之前的字段由产品经理填写；其余由系统工程师填写（操作列除外） */
export const PM_COLUMNS = new Set<ColKey>([
  'reqNo',
  'level',
  'parent',
  'bom',
  'category',
  'feature',
  'spec',
  'specDescription',
  'source',
  'characteristicSymbol',
  'importance',
])

export type ColumnOwner = 'pm' | 'se' | 'none'

export function columnOwner(key: ColKey): ColumnOwner {
  if (key === 'actions') return 'none'
  return PM_COLUMNS.has(key) ? 'pm' : 'se'
}

export function ownerSpans(columns: ColKey[]) {
  const spans: { owner: ColumnOwner; count: number }[] = []
  for (const key of columns) {
    const owner = columnOwner(key)
    const last = spans[spans.length - 1]
    if (last && last.owner === owner) last.count += 1
    else spans.push({ owner, count: 1 })
  }
  return spans
}

export const DEFAULT_COLUMNS: ColKey[] = [
  'reqNo',
  'level',
  'parent',
  'bom',
  'category',
  'feature',
  'spec',
  'source',
  'characteristicSymbol',
  'importance',
  'related',
  'acceptanceMethod',
  'riskLevel',
  'module',
  'discipline',
  'deliveryPhase',
  'tr3',
  'tr4',
  'tr4a',
  'tr5',
  'actions',
]

const KNOWN = new Set<string>(LIST_COLUMNS.map((c) => c.key))

export function normalizeColumns(cols: string[] | undefined): ColKey[] {
  const body = (cols ?? DEFAULT_COLUMNS).filter((c) => c !== 'reqNo' && c !== 'actions' && KNOWN.has(c)) as ColKey[]
  const uniq: ColKey[] = []
  for (const k of body) if (!uniq.includes(k)) uniq.push(k)
  const order = LIST_COLUMNS.map((c) => c.key)
  const rank = (k: ColKey) => order.indexOf(k)
  const pm = uniq.filter((k) => PM_COLUMNS.has(k)).sort((a, b) => rank(a) - rank(b))
  const se = uniq.filter((k) => !PM_COLUMNS.has(k)).sort((a, b) => rank(a) - rank(b))
  return ['reqNo', ...pm, ...se, 'actions']
}

function newId() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function emptyFilter(): FilterCondition {
  return { id: newId(), field: 'level', op: 'eq', value: '' }
}

export function defaultListView(): ListViewState {
  return { columns: [...DEFAULT_COLUMNS], filters: [], sortKey: 'tree', sortDir: 'asc', colWidths: {}, toolsOpen: false }
}

export function colWidthOf(key: ColKey, custom?: Partial<Record<ColKey, number>>) {
  const fallback = COLUMN_MAP[key]?.width ?? 120
  const w = custom?.[key]
  if (typeof w !== 'number' || !Number.isFinite(w)) return fallback
  return Math.min(800, Math.max(64, Math.round(w)))
}

function normalizeWidths(raw: unknown): Partial<Record<ColKey, number>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Partial<Record<ColKey, number>> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN.has(k) || typeof v !== 'number' || !Number.isFinite(v)) continue
    out[k as ColKey] = Math.min(800, Math.max(64, Math.round(v)))
  }
  return out
}

function normalizeState(raw: Partial<ListViewState> | null | undefined): ListViewState {
  const base = defaultListView()
  if (!raw || typeof raw !== 'object') return base
  const sortKey = SORT_OPTIONS.some((s) => s.value === raw.sortKey) ? (raw.sortKey as SortKey) : 'tree'
  const sortDir = raw.sortDir === 'desc' ? 'desc' : 'asc'
  const filters = Array.isArray(raw.filters)
    ? raw.filters
        .filter((f) => f && KNOWN.has(f.field) && FILTER_OPS.some((o) => o.value === f.op))
        .map((f) => ({
          id: typeof f.id === 'string' ? f.id : newId(),
          field: f.field,
          op: f.op,
          value: typeof f.value === 'string' ? f.value : '',
        }))
    : []
  return {
    columns: normalizeColumns(raw.columns),
    filters,
    sortKey,
    sortDir,
    colWidths: normalizeWidths(raw.colWidths),
    toolsOpen: raw.toolsOpen === true,
  }
}

function loadListView(): ListViewState {
  try {
    const raw = localStorage.getItem(LS_LIST_VIEW)
    if (!raw) return defaultListView()
    return normalizeState(JSON.parse(raw) as Partial<ListViewState>)
  } catch {
    return defaultListView()
  }
}

function saveListView(state: ListViewState) {
  localStorage.setItem(LS_LIST_VIEW, JSON.stringify(state))
}

export function useListView() {
  const [state, setState] = useState<ListViewState>(loadListView)
  const patch = useCallback((partial: Partial<ListViewState>) => {
    setState((prev) => {
      const next = normalizeState({ ...prev, ...partial })
      saveListView(next)
      return next
    })
  }, [])
  return { ...state, patch }
}

export function fieldText(req: Requirement, field: ColKey, db: Database): string {
  const parent = req.parentId ? db.requirements.find((r) => r.id === req.parentId) : undefined
  const bom = req.bomItemId ? db.bomItems?.find((b) => b.id === req.bomItemId) : undefined
  switch (field) {
    case 'reqNo':
      return req.reqNo
    case 'level':
      return reqLevel(req)
    case 'parent':
      return parent?.reqNo ?? ''
    case 'bom':
      return bom ? formatBomLabel(bom) : ''
    case 'category':
      return reqLevel(req) === '零件需求' ? '' : req.category
    case 'feature':
      return req.feature ?? ''
    case 'spec':
      return req.spec
    case 'specDescription':
      return req.specDescription ?? ''
    case 'source':
      return reqLevel(req) === '产品需求' ? (req.source ?? '') : ''
    case 'characteristicSymbol':
      return req.characteristicSymbol
    case 'importance':
      return reqLevel(req) === '产品需求' ? req.importance : ''
    case 'related':
      return relatedReqNos(req, db).join(',')
    case 'acceptanceMethod':
      return req.acceptanceMethod ?? ''
    case 'riskLevel':
      return req.riskLevel
    case 'module':
      return reqLevel(req) === '产品需求' ? (req.module ?? '') : ''
    case 'discipline':
      return req.discipline ?? ''
    case 'deliveryPhase':
      return req.deliveryPhase
    case 'tr3':
      return req.tr3DesignCovered
    case 'tr4':
      return req.tr4Verified
    case 'tr4a':
      return req.tr4aPassed
    case 'tr5':
      return req.tr5Accepted
    case 'status':
      return req.status
    case 'remark':
      return req.remark ?? ''
    default:
      return ''
  }
}

function matchOp(text: string, op: FilterOp, value: string) {
  const t = text.trim().toLowerCase()
  const v = value.trim().toLowerCase()
  const parts = splitMulti(text).map((s) => s.toLowerCase())
  switch (op) {
    case 'empty':
      return t === ''
    case 'notEmpty':
      return t !== ''
    case 'eq':
      return t === v || parts.includes(v)
    case 'neq':
      return t !== v && !parts.includes(v)
    case 'contains':
      return t.includes(v) || parts.some((p) => p.includes(v))
    case 'notContains':
      return !t.includes(v) && !parts.some((p) => p.includes(v))
    default:
      return true
  }
}

export function matchFilters(req: Requirement, filters: FilterCondition[], db: Database) {
  return filters.every((f) => {
    if (f.op !== 'empty' && f.op !== 'notEmpty' && !f.value.trim()) return true
    return matchOp(fieldText(req, f.field, db), f.op, f.value)
  })
}

const LEVEL_RANK: Record<string, number> = { 产品需求: 0, 模块需求: 1, 零件需求: 2 }
const RISK_RANK: Record<string, number> = { 高: 0, 中: 1, 低: 2 }
const IMP_RANK: Record<string, number> = { MUST: 0, Should: 1, 'Nice to have': 2 }
const CHAR_RANK: Record<string, number> = { CC: 0, SC: 1, 一般: 2 }
const PHASE_RANK: Record<string, number> = { EVT: 0, DVT: 1, PVT: 2, MP: 3 }

function cmp(a: string | number, b: string | number) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function sortRequirements(
  rows: Requirement[],
  sortKey: SortKey,
  sortDir: 'asc' | 'desc',
  treeIndex: Map<number, number>,
) {
  const dir = sortDir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    let r = 0
    switch (sortKey) {
      case 'tree':
        r = (treeIndex.get(a.id) ?? 0) - (treeIndex.get(b.id) ?? 0)
        break
      case 'reqNo':
        r = cmp(a.reqNo, b.reqNo)
        break
      case 'level':
        r = (LEVEL_RANK[reqLevel(a)] ?? 9) - (LEVEL_RANK[reqLevel(b)] ?? 9)
        break
      case 'category':
        r = cmp(a.category, b.category)
        break
      case 'createdAt':
        r = cmp(a.createdAt, b.createdAt)
        break
      case 'updatedAt':
        r = cmp(a.updatedAt, b.updatedAt)
        break
      case 'deliveryPhase':
        r = (PHASE_RANK[a.deliveryPhase] ?? 9) - (PHASE_RANK[b.deliveryPhase] ?? 9)
        break
      case 'riskLevel':
        r = (RISK_RANK[a.riskLevel] ?? 9) - (RISK_RANK[b.riskLevel] ?? 9)
        break
      case 'importance':
        r = (IMP_RANK[a.importance] ?? 9) - (IMP_RANK[b.importance] ?? 9)
        break
      case 'characteristicSymbol':
        r = (CHAR_RANK[a.characteristicSymbol] ?? 9) - (CHAR_RANK[b.characteristicSymbol] ?? 9)
        break
    }
    if (r === 0) r = (treeIndex.get(a.id) ?? 0) - (treeIndex.get(b.id) ?? 0)
    return r * (sortKey === 'tree' ? 1 : dir)
  })
}

export function enumOptions(field: ColKey, extra: string[] = []) {
  const base: string[] = (() => {
    switch (field) {
      case 'level':
        return [...REQ_LEVELS]
      case 'characteristicSymbol':
        return [...CHARACTERISTIC_SYMBOLS]
      case 'importance':
        return [...IMPORTANCE_LEVELS]
      case 'riskLevel':
        return [...RISK_LEVELS]
      case 'deliveryPhase':
        return [...DELIVERY_PHASES]
      case 'tr3':
      case 'tr4':
      case 'tr4a':
      case 'tr5':
        return [...TR_STATES]
      case 'status':
        return [...REQ_STATUS]
      default:
        return []
    }
  })()
  const seen = new Set(base)
  for (const v of extra) {
    if (v && !seen.has(v)) {
      seen.add(v)
      base.push(v)
    }
  }
  return base
}

export function collectFieldOptions(field: ColKey, reqs: Requirement[], db: Database, extras?: string[]) {
  const fromData: string[] = []
  for (const r of reqs) {
    const raw = fieldText(r, field, db)
    for (const part of splitMulti(raw).length ? splitMulti(raw) : raw ? [raw] : []) {
      if (part) fromData.push(part)
    }
  }
  return enumOptions(field, [...(extras ?? []), ...fromData])
}

export const FILTERABLE_COLUMNS = LIST_COLUMNS.filter((c) => c.filterable)
