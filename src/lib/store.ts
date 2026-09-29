import {
  DEFAULT_PART_ACCEPTANCE_METHODS,
  isImportance,
  isReqStatus,
  LS_DB,
  LS_OPTIONS,
  LS_ROLE,
} from '@/lib/constants'
import { nextChildReqNo, nextProductReqNo, reqLevel } from '@/lib/hierarchy'
import { dfmeaAnalysisMeta, dfmeaComboKey, dfmeaPaths, recordComboKey } from '@/lib/dfmea'
import { resolveOptionLists } from '@/lib/options'
import { currentActor, nowIso, splitMulti } from '@/lib/utils'
import type {
  BomItem,
  ChangeRequest,
  ChangeStatus,
  CustomOptions,
  Database,
  DeliveryPhase,
  DfmeaAnalysis,
  DfmeaAnalysisKind,
  DfmeaRecord,
  FreezeReview,
  FreezeStatus,
  Importance,
  LinkType,
  Project,
  ReqLevel,
  ReqStatus,
  Requirement,
  RequirementLink,
  ReviewDecision,
  RiskLevel,
  Role,
  TestSubmit,
  TrEvidence,
  TrState,
  CharacteristicSymbol,
} from '@/types'
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emptyDb(): Database {
  return {
    projects: [],
    requirements: [],
    links: [],
    bomItems: [],
    freezeReviews: [],
    changeRequests: [],
    testSubmits: [],
    notifications: [],
    dfmeaRecords: [],
    dfmeaAnalyses: [],
    seq: 0,
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function majorityStatus(reqs: Requirement[]): ReqStatus {
  const counts = new Map<string, number>()
  for (const r of reqs) {
    if (!r.status) continue
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  }
  let best: ReqStatus = '草稿'
  let n = -1
  for (const [k, v] of counts) {
    if (v > n && isReqStatus(k)) {
      n = v
      best = k
    }
  }
  return best
}

function migrateImportance(v: string): Importance {
  if (v === '最高' || v === '高') return 'MUST'
  if (v === '中') return 'Should'
  if (v === '低') return 'Nice to have'
  if (isImportance(v)) return v
  return 'Should'
}

const PART_ACCEPTANCE_SET = new Set<string>(DEFAULT_PART_ACCEPTANCE_METHODS)

const LEGACY_BOM_MODULE: Record<string, string> = {
  'CAM3D-P-001': '投射模组',
  'CAM3D-P-002': '散热模组',
  'CAM3D-P-003': '采集模组',
  'CAM3D-P-004': '主控与处理模组',
  'CAM3D-P-005': '投射模组',
  'CAM3D-P-006': '采集模组',
  'CAM3D-P-007': '散热模组',
  'CAM3D-P-008': '结构件与外壳',
  'CAM3D-P-009': '电源管理模组',
  'CAM3D-P-010': '接口与通信模组',
}

function migrateAcceptance(v: string, level?: ReqLevel): string {
  if (level === '零件需求') return v || ''
  const parts = splitMulti(v)
  if (parts.length > 0 && parts.every((p) => PART_ACCEPTANCE_SET.has(p))) return v
  if (v === '测试' || v === '检验') return '型式试验'
  if (v === '分析' || v === '评审') return '技术评审'
  if (v === '演示') return '原型确认'
  return v || '型式试验'
}

function migrateDisciplinePart(d: string): string {
  if (d === '机械' || d === '工艺' || d === '质量') return '结构'
  if (d === '电子') return '电路'
  if (d === '测试') return '软件'
  return d
}

function nextAnalysisSort(db: Database, reqId: number, kind: DfmeaAnalysisKind) {
  let max = 0
  for (const a of db.dfmeaAnalyses) {
    if (a.reqId === reqId && a.kind === kind) max = Math.max(max, a.sortOrder ?? 0)
  }
  return max + 1
}

function findOrCreateAnalysis(
  db: Database,
  projectId: number,
  reqId: number,
  kind: DfmeaAnalysisKind,
  text: string,
) {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const found = db.dfmeaAnalyses.find((a) => a.reqId === reqId && a.kind === kind && a.text.trim() === trimmed)
  if (found) return found
  const created: DfmeaAnalysis = {
    id: nextId(db),
    projectId,
    reqId,
    kind,
    text: trimmed,
    sortOrder: nextAnalysisSort(db, reqId, kind),
    updatedAt: nowIso(),
  }
  db.dfmeaAnalyses.push(created)
  return created
}

function filledAnalyses(db: Database, reqId: number | undefined, kind: DfmeaAnalysisKind) {
  if (!reqId) return []
  return db.dfmeaAnalyses
    .filter((a) => a.reqId === reqId && a.kind === kind && a.text.trim())
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
}

function comboSlots(items: DfmeaAnalysis[]): { id: number; text: string }[] {
  if (items.length === 0) return [{ id: 0, text: '' }]
  return items.map((a) => ({ id: a.id, text: a.text }))
}

function migrateDfmeaAnalyses(db: Database) {
  for (const rec of db.dfmeaRecords) {
    if (rec.productReqId && rec.failureEffect?.trim()) {
      const item = findOrCreateAnalysis(db, rec.projectId, rec.productReqId, 'failureEffect', rec.failureEffect)
      rec.failureEffectId = item?.id
    }
    if (rec.moduleReqId && rec.failureMode?.trim()) {
      const item = findOrCreateAnalysis(db, rec.projectId, rec.moduleReqId, 'failureMode', rec.failureMode)
      rec.failureModeId = item?.id
    }
    if (rec.partReqId && rec.failureCause?.trim()) {
      const item = findOrCreateAnalysis(db, rec.projectId, rec.partReqId, 'failureCause', rec.failureCause)
      rec.failureCauseId = item?.id
    }
  }
  const projectIds = [...new Set(db.dfmeaRecords.map((r) => r.projectId))]
  for (const projectId of projectIds) ensureDfmeaCombos(db, projectId)
}

function ensureDfmeaCombos(db: Database, projectId: number) {
  const projectReqs = db.requirements.filter((r) => r.projectId === projectId)
  const desired: {
    key: string
    productReqId?: number
    moduleReqId?: number
    partReqId?: number
    failureEffectId?: number
    failureModeId?: number
    failureCauseId?: number
    failureEffect?: string
    failureMode?: string
    failureCause?: string
    bomItemId?: number
  }[] = []
  for (const path of dfmeaPaths(projectReqs)) {
    const fes = comboSlots(filledAnalyses(db, path.product?.id, 'failureEffect'))
    const fms = comboSlots(filledAnalyses(db, path.module?.id, 'failureMode'))
    const fcs = comboSlots(filledAnalyses(db, path.part?.id, 'failureCause'))
    for (const fe of fes) {
      for (const fm of fms) {
        for (const fc of fcs) {
          desired.push({
            key: dfmeaComboKey(path.product?.id, path.module?.id, path.part?.id, fe.id || undefined, fm.id || undefined, fc.id || undefined),
            productReqId: path.product?.id,
            moduleReqId: path.module?.id,
            partReqId: path.part?.id,
            failureEffectId: fe.id || undefined,
            failureModeId: fm.id || undefined,
            failureCauseId: fc.id || undefined,
            failureEffect: fe.text || undefined,
            failureMode: fm.text || undefined,
            failureCause: fc.text || undefined,
            bomItemId: path.part?.bomItemId,
          })
        }
      }
    }
  }
  const unused = db.dfmeaRecords.filter((r) => r.projectId === projectId)
  const kept: DfmeaRecord[] = []
  const t = nowIso()
  const take = (pred: (r: DfmeaRecord) => boolean) => {
    const i = unused.findIndex(pred)
    if (i < 0) return undefined
    return unused.splice(i, 1)[0]
  }
  for (const d of desired) {
    const rec =
      take((r) => recordComboKey(r) === d.key) ??
      take(
        (r) =>
          r.productReqId === d.productReqId &&
          r.moduleReqId === d.moduleReqId &&
          r.partReqId === d.partReqId &&
          (!r.failureEffectId || r.failureEffectId === d.failureEffectId) &&
          (!r.failureModeId || r.failureModeId === d.failureModeId) &&
          (!r.failureCauseId || r.failureCauseId === d.failureCauseId),
      ) ??
      take((r) => r.productReqId === d.productReqId && r.moduleReqId === d.moduleReqId && r.partReqId === d.partReqId)
    if (rec) {
      rec.failureEffectId = d.failureEffectId
      rec.failureModeId = d.failureModeId
      rec.failureCauseId = d.failureCauseId
      rec.failureEffect = d.failureEffect
      rec.failureMode = d.failureMode
      rec.failureCause = d.failureCause
      if (!rec.bomItemId && d.bomItemId) rec.bomItemId = d.bomItemId
      kept.push(rec)
    } else {
      kept.push({
        id: nextId(db),
        projectId,
        productReqId: d.productReqId,
        moduleReqId: d.moduleReqId,
        partReqId: d.partReqId,
        bomItemId: d.bomItemId,
        failureEffectId: d.failureEffectId,
        failureModeId: d.failureModeId,
        failureCauseId: d.failureCauseId,
        failureEffect: d.failureEffect,
        failureMode: d.failureMode,
        failureCause: d.failureCause,
        actionStatus: '未开始',
        updatedAt: t,
      })
    }
  }
  db.dfmeaRecords = db.dfmeaRecords.filter((r) => r.projectId !== projectId).concat(kept)
}

function migrate(db: Database): Database {
  if (!Array.isArray(db.bomItems)) db.bomItems = []
  if (!Array.isArray(db.freezeReviews)) db.freezeReviews = []
  if (!Array.isArray(db.changeRequests)) db.changeRequests = []
  if (!Array.isArray(db.testSubmits)) db.testSubmits = []
  if (!Array.isArray(db.notifications)) db.notifications = []
  if (!Array.isArray(db.dfmeaRecords)) db.dfmeaRecords = []
  if (!Array.isArray(db.dfmeaAnalyses)) db.dfmeaAnalyses = []
  migrateDfmeaAnalyses(db)
  for (const req of db.requirements) {
    req.importance = migrateImportance(String(req.importance ?? ''))
    if (!req.level) req.level = '产品需求'
    req.acceptanceMethod = migrateAcceptance(String(req.acceptanceMethod ?? ''), reqLevel(req))
    if (req.discipline) {
      req.discipline = splitMulti(req.discipline).map(migrateDisciplinePart).join(',')
    }
    const loose = req as Requirement & { priority?: unknown }
    delete loose.priority
    if (reqLevel(req) !== '产品需求') {
      req.source = undefined
      req.module = undefined
    }
    if (reqLevel(req) !== '零件需求') req.bomItemId = undefined
    else if (req.parentId) {
      const parent = db.requirements.find((r) => r.id === req.parentId)
      if (parent?.category) req.category = parent.category
    }
  }
  for (const p of db.projects) {
    if (!p.status) {
      const reqs = db.requirements.filter((r) => r.projectId === p.id)
      p.status = majorityStatus(reqs)
    }
  }
  for (const b of db.bomItems) {
    if (!b.moduleGroup && LEGACY_BOM_MODULE[b.partNo]) b.moduleGroup = LEGACY_BOM_MODULE[b.partNo]
  }
  return db
}

function readDb(): Database {
  try {
    const raw = localStorage.getItem(LS_DB)
    if (!raw) return emptyDb()
    const parsed = JSON.parse(raw) as Partial<Database>
    const db: Database = {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
      links: Array.isArray(parsed.links) ? parsed.links : [],
      bomItems: Array.isArray(parsed.bomItems) ? parsed.bomItems : [],
      freezeReviews: Array.isArray(parsed.freezeReviews) ? parsed.freezeReviews : [],
      changeRequests: Array.isArray(parsed.changeRequests) ? parsed.changeRequests : [],
      testSubmits: Array.isArray(parsed.testSubmits) ? parsed.testSubmits : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      dfmeaRecords: Array.isArray(parsed.dfmeaRecords) ? parsed.dfmeaRecords : [],
      dfmeaAnalyses: Array.isArray(parsed.dfmeaAnalyses) ? parsed.dfmeaAnalyses : [],
      seq: typeof parsed.seq === 'number' ? parsed.seq : 0,
    }
    return migrate(db)
  } catch {
    return emptyDb()
  }
}

let cache: Database = readDb()

function persist() {
  localStorage.setItem(LS_DB, JSON.stringify(cache))
  emit()
}

function mutate(fn: (db: Database) => void) {
  const next = clone(cache)
  fn(next)
  cache = next
  persist()
}

function nextId(db: Database) {
  db.seq += 1
  return db.seq
}

export function getDb() {
  return cache
}

export function nextReqNo(project: Project, requirements: Requirement[]) {
  return nextProductReqNo(project.code, requirements)
}

export function nextSortOrder(projectId: number, requirements: Requirement[]) {
  let max = 0
  for (const r of requirements) {
    if (r.projectId === projectId) max = Math.max(max, r.sortOrder ?? 0)
  }
  return max + 1
}

export function createProject(input: {
  name: string
  code: string
  coreDesigners?: string
  description?: string
  status?: ReqStatus
}): Project {
  let created!: Project
  mutate((db) => {
    const t = nowIso()
    created = {
      id: nextId(db),
      name: input.name.trim(),
      code: input.code.trim(),
      coreDesigners: input.coreDesigners?.trim() || undefined,
      description: input.description?.trim() || undefined,
      status: input.status ?? '草稿',
      createdAt: t,
      updatedAt: t,
    }
    db.projects.push(created)
  })
  return created
}

export function updateProject(id: number, patch: Partial<Omit<Project, 'id'>>) {
  mutate((db) => {
    const p = db.projects.find((x) => x.id === id)
    if (!p) return
    Object.assign(p, patch, { updatedAt: nowIso() })
  })
}

export function deleteProject(id: number) {
  mutate((db) => {
    db.projects = db.projects.filter((p) => p.id !== id)
    const reqIds = new Set(db.requirements.filter((r) => r.projectId === id).map((r) => r.id))
    db.requirements = db.requirements.filter((r) => r.projectId !== id)
    db.links = db.links.filter((l) => l.projectId !== id && !reqIds.has(l.fromReqId) && !reqIds.has(l.toReqId))
    db.bomItems = db.bomItems.filter((b) => b.projectId !== id)
    db.freezeReviews = db.freezeReviews.filter((x) => x.projectId !== id)
    db.changeRequests = db.changeRequests.filter((x) => x.projectId !== id)
    db.testSubmits = db.testSubmits.filter((x) => x.projectId !== id)
    db.notifications = db.notifications.filter((x) => x.projectId !== id)
    db.dfmeaRecords = db.dfmeaRecords.filter((x) => x.projectId !== id)
    db.dfmeaAnalyses = db.dfmeaAnalyses.filter((x) => x.projectId !== id)
  })
}

export function setProjectStatus(projectId: number, status: ReqStatus) {
  mutate((db) => {
    const p = db.projects.find((x) => x.id === projectId)
    if (!p) return
    const t = nowIso()
    p.status = status
    p.updatedAt = t
    for (const r of db.requirements) {
      if (r.projectId === projectId) {
        r.status = status
        r.updatedAt = t
      }
    }
  })
}

export type RequirementDraft = {
  category: string
  feature?: string
  spec: string
  specDescription?: string
  source?: string
  characteristicSymbol: CharacteristicSymbol
  importance: Importance
  acceptanceMethod: string
  riskLevel: RiskLevel
  module?: string
  discipline?: string
  deliveryPhase: DeliveryPhase
  tr3DesignCovered: TrState
  tr4Verified: TrState
  tr4aPassed: TrState
  tr5Accepted: TrState
  tr3Evidence?: TrEvidence
  tr4Evidence?: TrEvidence
  tr4aEvidence?: TrEvidence
  tr5Evidence?: TrEvidence
  remark?: string
  bomItemId?: number
}

export function createRequirement(projectId: number, draft: RequirementDraft, extras?: Partial<Requirement>) {
  const gate = canEditRequirements(projectId)
  if (!gate.ok) throw new Error(gate.reason)
  let created!: Requirement
  mutate((db) => {
    const project = db.projects.find((p) => p.id === projectId)
    if (!project) return
    const t = nowIso()
    const level: ReqLevel = extras?.level ?? '产品需求'
    const parentId = level === '产品需求' ? undefined : extras?.parentId
    const parent = parentId ? db.requirements.find((r) => r.id === parentId) : undefined
    let reqNo = extras?.reqNo
    if (!reqNo) {
      if (level === '产品需求') reqNo = nextProductReqNo(project.code, db.requirements)
      else {
        reqNo = parent ? nextChildReqNo(parent, db.requirements, level) : nextProductReqNo(project.code, db.requirements)
      }
    }
    const category =
      level === '零件需求' ? (parent?.category ?? draft.category) : draft.category || parent?.category || '其他'
    created = {
      id: nextId(db),
      projectId,
      reqNo,
      level,
      parentId,
      category,
      feature: draft.feature?.trim() || undefined,
      spec: draft.spec.trim(),
      specDescription: draft.specDescription?.trim() || undefined,
      source: level === '产品需求' ? draft.source?.trim() || undefined : undefined,
      characteristicSymbol: draft.characteristicSymbol,
      importance: draft.importance,
      acceptanceMethod: draft.acceptanceMethod,
      riskLevel: draft.riskLevel,
      module: level === '产品需求' ? draft.module || undefined : undefined,
      discipline: draft.discipline || undefined,
      deliveryPhase: draft.deliveryPhase,
      tr3DesignCovered: draft.tr3DesignCovered,
      tr4Verified: draft.tr4Verified,
      tr4aPassed: draft.tr4aPassed,
      tr5Accepted: draft.tr5Accepted,
      tr3Evidence: draft.tr3Evidence,
      tr4Evidence: draft.tr4Evidence,
      tr4aEvidence: draft.tr4aEvidence,
      tr5Evidence: draft.tr5Evidence,
      status: extras?.status ?? project.status,
      remark: draft.remark?.trim() || undefined,
      bomItemId: level === '零件需求' ? (extras?.bomItemId ?? draft.bomItemId) : undefined,
      sortOrder: extras?.sortOrder ?? nextSortOrder(projectId, db.requirements),
      createdAt: t,
      updatedAt: t,
    }
    db.requirements.push(created)
    if (created.parentId) {
      const exists = db.links.some(
        (l) => l.fromReqId === created.id && l.toReqId === created.parentId && l.linkType === '分解',
      )
      if (!exists) {
        db.links.push({
          id: nextId(db),
          projectId,
          fromReqId: created.id,
          toReqId: created.parentId,
          linkType: '分解',
        })
      }
    }
  })
  if (created) syncDfmeaFromRequirements(projectId)
  return created
}

const TR_ONLY_KEYS = new Set([
  'tr3DesignCovered',
  'tr4Verified',
  'tr4aPassed',
  'tr5Accepted',
  'tr3Evidence',
  'tr4Evidence',
  'tr4aEvidence',
  'tr5Evidence',
])

export function latestFreeze(projectId: number, db: Database = cache) {
  return db.freezeReviews.filter((x) => x.projectId === projectId).sort((a, b) => b.id - a.id)[0]
}

export function approvedChange(projectId: number, db: Database = cache) {
  return db.changeRequests.find((c) => c.projectId === projectId && c.status === '已通过')
}

export function canEditRequirements(projectId: number, db: Database = cache): { ok: boolean; reason?: string } {
  const p = db.projects.find((x) => x.id === projectId)
  if (!p) return { ok: false, reason: '项目不存在' }
  if (p.status === '已基线' && !approvedChange(projectId, db)) {
    return { ok: false, reason: '产品已基线，修改需求须先通过变更系统发起申请并审批通过' }
  }
  return { ok: true }
}

export function updateRequirement(id: number, patch: Partial<Requirement>) {
  const existing = cache.requirements.find((x) => x.id === id)
  if (existing) {
    const keys = Object.keys(patch).filter((k) => k !== 'updatedAt')
    const trOnly = keys.length > 0 && keys.every((k) => TR_ONLY_KEYS.has(k))
    if (!trOnly) {
      const gate = canEditRequirements(existing.projectId)
      if (!gate.ok) throw new Error(gate.reason)
    }
  }
  mutate((db) => {
    const r = db.requirements.find((x) => x.id === id)
    if (!r) return
    const prevParent = r.parentId
    Object.assign(r, patch, { updatedAt: nowIso() })
    if (reqLevel(r) === '产品需求') r.parentId = undefined
    if (reqLevel(r) !== '产品需求') {
      r.source = undefined
      r.module = undefined
    }
    if (reqLevel(r) === '零件需求') {
      const parent = r.parentId ? db.requirements.find((x) => x.id === r.parentId) : undefined
      if (parent?.category) r.category = parent.category
    } else {
      r.bomItemId = undefined
    }
    if (prevParent !== r.parentId) {
      if (prevParent) {
        db.links = db.links.filter(
          (l) => !(l.fromReqId === r.id && l.toReqId === prevParent && l.linkType === '分解'),
        )
      }
      if (r.parentId) {
        const exists = db.links.some(
          (l) => l.fromReqId === r.id && l.toReqId === r.parentId && l.linkType === '分解',
        )
        if (!exists) {
          db.links.push({
            id: nextId(db),
            projectId: r.projectId,
            fromReqId: r.id,
            toReqId: r.parentId,
            linkType: '分解',
          })
        }
      }
    }
  })
  if (existing) syncDfmeaFromRequirements(existing.projectId)
}

export function deleteRequirement(id: number) {
  const existing = cache.requirements.find((x) => x.id === id)
  if (existing) {
    const gate = canEditRequirements(existing.projectId)
    if (!gate.ok) throw new Error(gate.reason)
  }
  mutate((db) => {
    const ids = new Set<number>([id, ...collectDescendantIds(id, db.requirements)])
    db.requirements = db.requirements.filter((r) => !ids.has(r.id))
    db.links = db.links.filter((l) => !ids.has(l.fromReqId) && !ids.has(l.toReqId))
    db.dfmeaRecords = db.dfmeaRecords.filter(
      (r) => !ids.has(r.productReqId ?? -1) && !ids.has(r.moduleReqId ?? -1) && !ids.has(r.partReqId ?? -1),
    )
    db.dfmeaAnalyses = db.dfmeaAnalyses.filter((a) => !ids.has(a.reqId))
  })
  if (existing) syncDfmeaFromRequirements(existing.projectId)
}

export type BomItemDraft = {
  partNo: string
  name: string
  moduleGroup?: string
  spec?: string
  qty?: number
  unit?: string
  remark?: string
}

function nextBomSort(projectId: number, items: BomItem[]) {
  let max = 0
  for (const b of items) {
    if (b.projectId === projectId) max = Math.max(max, b.sortOrder ?? 0)
  }
  return max + 1
}

export function formatBomLabel(item: BomItem) {
  const base = item.spec ? `${item.partNo} ${item.name}（${item.spec}）` : `${item.partNo} ${item.name}`
  return item.moduleGroup ? `${item.moduleGroup} / ${base}` : base
}

export function createBomItem(projectId: number, draft: BomItemDraft): BomItem {
  const gate = canEditRequirements(projectId)
  if (!gate.ok) throw new Error(gate.reason)
  let created!: BomItem
  mutate((db) => {
    const t = nowIso()
    created = {
      id: nextId(db),
      projectId,
      partNo: draft.partNo.trim(),
      name: draft.name.trim(),
      moduleGroup: draft.moduleGroup?.trim() || undefined,
      spec: draft.spec?.trim() || undefined,
      qty: typeof draft.qty === 'number' && Number.isFinite(draft.qty) ? draft.qty : undefined,
      unit: draft.unit?.trim() || undefined,
      remark: draft.remark?.trim() || undefined,
      sortOrder: nextBomSort(projectId, db.bomItems),
      createdAt: t,
      updatedAt: t,
    }
    db.bomItems.push(created)
  })
  return created
}

export function updateBomItem(id: number, patch: Partial<BomItemDraft>) {
  const existing = cache.bomItems.find((b) => b.id === id)
  if (existing) {
    const gate = canEditRequirements(existing.projectId)
    if (!gate.ok) throw new Error(gate.reason)
  }
  mutate((db) => {
    const item = db.bomItems.find((b) => b.id === id)
    if (!item) return
    if (patch.partNo !== undefined) item.partNo = patch.partNo.trim()
    if (patch.name !== undefined) item.name = patch.name.trim()
    if (patch.moduleGroup !== undefined) item.moduleGroup = patch.moduleGroup.trim() || undefined
    if (patch.spec !== undefined) item.spec = patch.spec.trim() || undefined
    if (patch.qty !== undefined) item.qty = typeof patch.qty === 'number' && Number.isFinite(patch.qty) ? patch.qty : undefined
    if (patch.unit !== undefined) item.unit = patch.unit.trim() || undefined
    if (patch.remark !== undefined) item.remark = patch.remark.trim() || undefined
    item.updatedAt = nowIso()
  })
}

export function deleteBomItem(id: number) {
  const existing = cache.bomItems.find((b) => b.id === id)
  if (existing) {
    const gate = canEditRequirements(existing.projectId)
    if (!gate.ok) throw new Error(gate.reason)
  }
  mutate((db) => {
    db.bomItems = db.bomItems.filter((b) => b.id !== id)
    for (const r of db.requirements) {
      if (r.bomItemId === id) r.bomItemId = undefined
    }
    for (const r of db.dfmeaRecords) {
      if (r.bomItemId === id) r.bomItemId = undefined
    }
  })
}

function collectDescendantIds(id: number, requirements: Requirement[]): number[] {
  const kids = requirements.filter((r) => r.parentId === id)
  return kids.flatMap((k) => [k.id, ...collectDescendantIds(k.id, requirements)])
}

export function addLink(input: {
  projectId: number
  fromReqId: number
  toReqId: number
  linkType: LinkType
}): { ok: boolean; reason?: 'self' | 'duplicate' | 'missing' | 'frozen' } {
  const gate = canEditRequirements(input.projectId)
  if (!gate.ok) return { ok: false, reason: 'frozen' }
  let result: { ok: boolean; reason?: 'self' | 'duplicate' | 'missing' | 'frozen' } = { ok: true }
  mutate((db) => {
    if (input.fromReqId === input.toReqId) {
      result = { ok: false, reason: 'self' }
      return
    }
    const from = db.requirements.find((r) => r.id === input.fromReqId)
    const to = db.requirements.find((r) => r.id === input.toReqId)
    if (!from || !to) {
      result = { ok: false, reason: 'missing' }
      return
    }
    const dup = db.links.some(
      (l) => l.fromReqId === input.fromReqId && l.toReqId === input.toReqId && l.linkType === input.linkType,
    )
    if (dup) {
      result = { ok: false, reason: 'duplicate' }
      return
    }
    db.links.push({
      id: nextId(db),
      projectId: input.projectId,
      fromReqId: input.fromReqId,
      toReqId: input.toReqId,
      linkType: input.linkType,
    })
  })
  return result
}

export function deleteLink(id: number) {
  mutate((db) => {
    db.links = db.links.filter((l) => l.id !== id)
  })
}

export function findProjectByCode(code: string) {
  return cache.projects.find((p) => p.code === code)
}

export function replaceDb(next: Database) {
  cache = migrate(clone(next))
  persist()
}

function readRole(): Role {
  const v = localStorage.getItem(LS_ROLE)
  return v === 'member' ? 'member' : 'admin'
}

let roleCache: Role = readRole()

export function getRole() {
  return roleCache
}

export function setRole(role: Role) {
  roleCache = role
  localStorage.setItem(LS_ROLE, role)
  emit()
}

function readCustomOptions(): CustomOptions {
  try {
    const raw = localStorage.getItem(LS_OPTIONS)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CustomOptions
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

let optionsCache: CustomOptions = readCustomOptions()

export function getCustomOptions() {
  return optionsCache
}

export function saveCustomOptions(next: CustomOptions) {
  optionsCache = { ...next }
  localStorage.setItem(LS_OPTIONS, JSON.stringify(optionsCache))
  emit()
}

export function resetCustomKey(key: keyof CustomOptions) {
  const next = { ...optionsCache }
  delete next[key]
  optionsCache = next
  localStorage.setItem(LS_OPTIONS, JSON.stringify(optionsCache))
  emit()
}

export function getResolvedOptions() {
  return resolveOptionLists(optionsCache)
}

export function useAppStore() {
  const v = useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
  return {
    version: v,
    db: cache,
    role: roleCache,
    customOptions: optionsCache,
    options: resolveOptionLists(optionsCache),
  }
}

export function startFreezeReview(projectId: number, input: { initiator: string; reviewers: { role: string; name: string }[]; comment?: string }) {
  let created!: FreezeReview
  mutate((db) => {
    const t = nowIso()
    created = {
      id: nextId(db),
      projectId,
      initiator: input.initiator.trim() || currentActor(),
      status: '评审中',
      reviewers: input.reviewers.map((r) => ({ role: r.role, name: r.name.trim() })),
      comment: input.comment?.trim() || undefined,
      createdAt: t,
      updatedAt: t,
    }
    db.freezeReviews.push(created)
  })
  return created
}

export function decideFreezeReview(reviewId: number, role: string, name: string, decision: ReviewDecision, comment?: string) {
  let nextStatus: FreezeStatus | undefined
  mutate((db) => {
    const review = db.freezeReviews.find((x) => x.id === reviewId)
    if (!review || review.status !== '评审中') return
    const person = review.reviewers.find((r) => r.role === role && r.name === name) ?? review.reviewers.find((r) => r.role === role)
    if (!person) return
    const t = nowIso()
    person.decision = decision
    person.comment = comment?.trim() || undefined
    person.decidedAt = t
    if (review.reviewers.some((r) => r.decision === '驳回')) review.status = '已驳回'
    else if (review.reviewers.every((r) => r.decision === '同意')) review.status = '已通过'
    review.updatedAt = t
    nextStatus = review.status
    if (review.status === '已通过') {
      const p = db.projects.find((x) => x.id === review.projectId)
      if (p) {
        p.status = '已基线'
        p.updatedAt = t
        for (const r of db.requirements) {
          if (r.projectId === review.projectId) {
            r.status = '已基线'
            r.updatedAt = t
          }
        }
      }
    }
  })
  return nextStatus
}

export function startChangeRequest(projectId: number, input: { title: string; reason: string; scope?: string; initiator: string }) {
  let created!: ChangeRequest
  mutate((db) => {
    const t = nowIso()
    const by = input.initiator.trim() || currentActor()
    created = {
      id: nextId(db),
      projectId,
      title: input.title.trim(),
      reason: input.reason.trim(),
      scope: input.scope?.trim() || undefined,
      initiator: by,
      status: '审批中',
      createdAt: t,
      updatedAt: t,
      history: [{ at: t, action: '发起变更', by, comment: input.reason.trim() }],
    }
    db.changeRequests.push(created)
  })
  return created
}

export function decideChangeRequest(id: number, status: Extract<ChangeStatus, '已通过' | '已驳回'>, comment?: string) {
  mutate((db) => {
    const cr = db.changeRequests.find((x) => x.id === id)
    if (!cr || cr.status !== '审批中') return
    const t = nowIso()
    cr.status = status
    cr.updatedAt = t
    cr.history.push({ at: t, action: status === '已通过' ? '变更审批通过' : '变更驳回', by: currentActor(), comment })
    if (status === '已通过') {
      const p = db.projects.find((x) => x.id === cr.projectId)
      if (p) {
        p.status = '变更中'
        p.updatedAt = t
        for (const r of db.requirements) {
          if (r.projectId === cr.projectId) {
            r.status = '变更中'
            r.updatedAt = t
          }
        }
      }
    }
  })
}

export function closeChangeRequest(id: number, comment?: string) {
  mutate((db) => {
    const cr = db.changeRequests.find((x) => x.id === id)
    if (!cr || cr.status !== '已通过') return
    const t = nowIso()
    cr.status = '已关闭'
    cr.updatedAt = t
    cr.closedAt = t
    cr.history.push({ at: t, action: '变更关闭，产品重新基线', by: currentActor(), comment })
    const p = db.projects.find((x) => x.id === cr.projectId)
    if (p) {
      p.status = '已基线'
      p.updatedAt = t
      for (const r of db.requirements) {
        if (r.projectId === cr.projectId) {
          r.status = '已基线'
          r.updatedAt = t
        }
      }
    }
  })
}

export function submitForTest(reqId: number, testers: string[], note?: string) {
  let created!: TestSubmit
  mutate((db) => {
    const req = db.requirements.find((r) => r.id === reqId)
    if (!req) return
    const t = nowIso()
    const by = currentActor()
    const names = testers.map((s) => s.trim()).filter(Boolean)
    created = {
      id: nextId(db),
      projectId: req.projectId,
      reqId,
      testers: names,
      note: note?.trim() || undefined,
      createdAt: t,
      createdBy: by,
    }
    db.testSubmits.push(created)
    const count = db.testSubmits.filter((x) => x.reqId === reqId).length
    for (const to of names) {
      db.notifications.unshift({
        id: nextId(db),
        projectId: req.projectId,
        to,
        title: `${req.reqNo} 已提测（第 ${count} 次）`,
        body: `${by} 将「${req.spec}」提测给 ${to}${note?.trim() ? `：${note.trim()}` : ''}`,
        createdAt: t,
        read: false,
      })
    }
  })
  return created
}

export function markNotificationsRead(ids?: number[]) {
  mutate((db) => {
    for (const n of db.notifications) {
      if (!ids || ids.includes(n.id)) n.read = true
    }
  })
}

export function relatedReqNos(req: Requirement, db: Database) {
  const ids = new Set<number>()
  for (const l of db.links) {
    if (l.fromReqId === req.id) ids.add(l.toReqId)
    else if (l.toReqId === req.id) ids.add(l.fromReqId)
  }
  const nos: string[] = []
  for (const id of ids) {
    const other = db.requirements.find((r) => r.id === id)
    if (other) nos.push(other.reqNo)
  }
  return nos
}

export function linksOf(reqId: number, db: Database) {
  const outgoing: { link: RequirementLink; other: Requirement }[] = []
  const incoming: { link: RequirementLink; other: Requirement }[] = []
  for (const l of db.links) {
    if (l.fromReqId === reqId) {
      const other = db.requirements.find((r) => r.id === l.toReqId)
      if (other) outgoing.push({ link: l, other })
    } else if (l.toReqId === reqId) {
      const other = db.requirements.find((r) => r.id === l.fromReqId)
      if (other) incoming.push({ link: l, other })
    }
  }
  return { outgoing, incoming }
}

export function quickCreateRequirement(projectId: number, spec: string, level: ReqLevel, parentId?: number) {
  const parent = parentId ? cache.requirements.find((r) => r.id === parentId) : undefined
  const draft: RequirementDraft = {
    category: parent?.category || '其他',
    spec,
    characteristicSymbol: '一般',
    importance: 'Should',
    acceptanceMethod: level === '零件需求' ? '图纸/规格书' : '技术评审',
    riskLevel: '中',
    deliveryPhase: parent?.deliveryPhase ?? 'EVT',
    tr3DesignCovered: '未评估',
    tr4Verified: '未评估',
    tr4aPassed: '未评估',
    tr5Accepted: '未评估',
  }
  return createRequirement(projectId, draft, { level, parentId })
}

export function syncDfmeaFromRequirements(projectId: number) {
  const projectReqs = cache.requirements.filter((r) => r.projectId === projectId)
  const desiredKeys: string[] = []
  for (const path of dfmeaPaths(projectReqs)) {
    const fes = comboSlots(filledAnalyses(cache, path.product?.id, 'failureEffect'))
    const fms = comboSlots(filledAnalyses(cache, path.module?.id, 'failureMode'))
    const fcs = comboSlots(filledAnalyses(cache, path.part?.id, 'failureCause'))
    for (const fe of fes) {
      for (const fm of fms) {
        for (const fc of fcs) {
          desiredKeys.push(
            dfmeaComboKey(path.product?.id, path.module?.id, path.part?.id, fe.id || undefined, fm.id || undefined, fc.id || undefined),
          )
        }
      }
    }
  }
  const existing = cache.dfmeaRecords.filter((r) => r.projectId === projectId)
  const existingKeys = new Set(existing.map((r) => recordComboKey(r)))
  const sameCombos = desiredKeys.length === existingKeys.size && desiredKeys.every((k) => existingKeys.has(k))
  const needBom = existing.some((r) => {
    if (r.bomItemId) return false
    const part = r.partReqId ? projectReqs.find((x) => x.id === r.partReqId) : undefined
    return Boolean(part?.bomItemId)
  })
  if (sameCombos && !needBom) return
  mutate((db) => {
    ensureDfmeaCombos(db, projectId)
  })
}

export function updateDfmeaRecord(id: number, patch: Partial<Omit<DfmeaRecord, 'id' | 'projectId'>>) {
  mutate((db) => {
    const r = db.dfmeaRecords.find((x) => x.id === id)
    if (!r) return
    Object.assign(r, patch, { updatedAt: nowIso() })
  })
}

export function addDfmeaAnalysis(projectId: number, reqId: number, text = '') {
  let created!: DfmeaAnalysis
  mutate((db) => {
    const req = db.requirements.find((r) => r.id === reqId)
    if (!req) return
    const kind = dfmeaAnalysisMeta(reqLevel(req)).field
    created = {
      id: nextId(db),
      projectId,
      reqId,
      kind,
      text: text.trim(),
      sortOrder: nextAnalysisSort(db, reqId, kind),
      updatedAt: nowIso(),
    }
    db.dfmeaAnalyses.push(created)
    ensureDfmeaCombos(db, projectId)
  })
  return created
}

export function updateDfmeaAnalysisItem(id: number, text: string) {
  mutate((db) => {
    const item = db.dfmeaAnalyses.find((a) => a.id === id)
    if (!item) return
    item.text = text.trim()
    item.updatedAt = nowIso()
    for (const rec of db.dfmeaRecords) {
      if (rec.failureEffectId === id) rec.failureEffect = item.text || undefined
      if (rec.failureModeId === id) rec.failureMode = item.text || undefined
      if (rec.failureCauseId === id) rec.failureCause = item.text || undefined
    }
    ensureDfmeaCombos(db, item.projectId)
  })
}

export function deleteDfmeaAnalysis(id: number) {
  mutate((db) => {
    const item = db.dfmeaAnalyses.find((a) => a.id === id)
    if (!item) return
    db.dfmeaAnalyses = db.dfmeaAnalyses.filter((a) => a.id !== id)
    for (const rec of db.dfmeaRecords) {
      if (rec.failureEffectId === id) {
        rec.failureEffectId = undefined
        rec.failureEffect = undefined
      }
      if (rec.failureModeId === id) {
        rec.failureModeId = undefined
        rec.failureMode = undefined
      }
      if (rec.failureCauseId === id) {
        rec.failureCauseId = undefined
        rec.failureCause = undefined
      }
    }
    ensureDfmeaCombos(db, item.projectId)
  })
}

export function updateDfmeaAnalysis(
  projectId: number,
  kind: DfmeaAnalysisKind,
  reqId: number | undefined,
  value: string,
) {
  if (!reqId) return
  mutate((db) => {
    findOrCreateAnalysis(db, projectId, reqId, kind, value)
    ensureDfmeaCombos(db, projectId)
  })
}

export function setDfmeaRecordAnalysis(recordId: number, kind: DfmeaAnalysisKind, reqId: number | undefined, value: string) {
  mutate((db) => {
    const rec = db.dfmeaRecords.find((r) => r.id === recordId)
    if (!rec) return
    const idKey = kind === 'failureEffect' ? 'failureEffectId' : kind === 'failureMode' ? 'failureModeId' : 'failureCauseId'
    const analysisId = rec[idKey]
    const trimmed = value.trim()
    if (analysisId) {
      const item = db.dfmeaAnalyses.find((a) => a.id === analysisId)
      if (item) {
        item.text = trimmed
        item.updatedAt = nowIso()
        for (const r of db.dfmeaRecords) {
          if (r[idKey] === analysisId) r[kind] = trimmed || undefined
        }
        ensureDfmeaCombos(db, rec.projectId)
        return
      }
    }
    if (reqId && trimmed) {
      const item = findOrCreateAnalysis(db, rec.projectId, reqId, kind, trimmed)
      rec[idKey] = item?.id
      rec[kind] = trimmed
      ensureDfmeaCombos(db, rec.projectId)
      return
    }
    rec[kind] = trimmed || undefined
  })
}

