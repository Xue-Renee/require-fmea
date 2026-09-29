import { buildReqTree, reqLevel, type ReqTreeNode } from '@/lib/hierarchy'
import type { ActionPriority, DfmeaAnalysis, DfmeaAnalysisKind, DfmeaRecord, Requirement } from '@/types'

export type DfmeaPath = {
  product?: Requirement
  module?: Requirement
  part?: Requirement
}

export function dfmeaPathKey(productId?: number, moduleId?: number, partId?: number) {
  return `${productId ?? 0}:${moduleId ?? 0}:${partId ?? 0}`
}

export function dfmeaComboKey(
  productId?: number,
  moduleId?: number,
  partId?: number,
  failureEffectId?: number,
  failureModeId?: number,
  failureCauseId?: number,
) {
  return `${productId ?? 0}:${moduleId ?? 0}:${partId ?? 0}:${failureEffectId ?? 0}:${failureModeId ?? 0}:${failureCauseId ?? 0}`
}

export function analysesForReq(req: Requirement, analyses: DfmeaAnalysis[]): DfmeaAnalysis[] {
  const { field } = dfmeaAnalysisMeta(reqLevel(req))
  return analyses
    .filter((a) => a.reqId === req.id && a.kind === field)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
}

export function recordComboKey(rec: Pick<DfmeaRecord, 'productReqId' | 'moduleReqId' | 'partReqId' | 'failureEffectId' | 'failureModeId' | 'failureCauseId'>) {
  return dfmeaComboKey(
    rec.productReqId,
    rec.moduleReqId,
    rec.partReqId,
    rec.failureEffectId,
    rec.failureModeId,
    rec.failureCauseId,
  )
}

export function dfmeaAnalysisMeta(level: ReturnType<typeof reqLevel>): {
  label: string
  verb: string
  field: DfmeaAnalysisKind
  reqKey: 'productReqId' | 'moduleReqId' | 'partReqId'
} {
  if (level === '产品需求') {
    return { label: '失效影响', verb: '失效影响分析', field: 'failureEffect', reqKey: 'productReqId' }
  }
  if (level === '模块需求') {
    return { label: '失效模式', verb: '失效模式分析', field: 'failureMode', reqKey: 'moduleReqId' }
  }
  return { label: '失效原因', verb: '失效原因分析', field: 'failureCause', reqKey: 'partReqId' }
}

export function readDfmeaAnalysis(req: Requirement, records: DfmeaRecord[]): string {
  const { field, reqKey } = dfmeaAnalysisMeta(reqLevel(req))
  for (const r of records) {
    if (r[reqKey] !== req.id) continue
    const v = r[field]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

export function dfmeaPaths(requirements: Requirement[]): DfmeaPath[] {
  const tree = buildReqTree(requirements)
  const out: DfmeaPath[] = []
  const walk = (product: Requirement | undefined, module: Requirement | undefined, nodes: ReqTreeNode[]) => {
    if (nodes.length === 0) {
      out.push({ product, module })
      return
    }
    for (const n of nodes) {
      const level = reqLevel(n.req)
      if (level === '产品需求') walk(n.req, undefined, n.children)
      else if (level === '模块需求') walk(product, n.req, n.children)
      else out.push({ product, module, part: n.req })
    }
  }
  if (tree.length === 0) return out
  walk(undefined, undefined, tree)
  return out
}

export function emptyDfmeaPatch(): Partial<DfmeaRecord> {
  return {
    actionStatus: '未开始',
  }
}

export function scoreAp(s?: number, o?: number, d?: number): ActionPriority | undefined {
  if (!s || !o || !d) return undefined
  const dBand = d === 1 ? 3 : d <= 4 ? 2 : d <= 6 ? 1 : 0
  const oBand = o === 1 ? 4 : o <= 3 ? 3 : o <= 5 ? 2 : o <= 7 ? 1 : 0
  const table: ActionPriority[][][] = [
    // S 9-10
    [
      ['H', 'H', 'H', 'H'],
      ['H', 'H', 'H', 'M'],
      ['H', 'H', 'M', 'M'],
      ['H', 'M', 'M', 'L'],
      ['L', 'L', 'L', 'L'],
    ],
    // S 7-8
    [
      ['H', 'H', 'H', 'M'],
      ['H', 'H', 'M', 'M'],
      ['H', 'M', 'M', 'L'],
      ['M', 'M', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
    ],
    // S 4-6
    [
      ['H', 'H', 'M', 'M'],
      ['M', 'M', 'M', 'L'],
      ['M', 'M', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
    ],
    // S 2-3
    [
      ['M', 'M', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
    ],
    // S 1
    [
      ['L', 'L', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
      ['L', 'L', 'L', 'L'],
    ],
  ]
  const sBand = s >= 9 ? 0 : s >= 7 ? 1 : s >= 4 ? 2 : s >= 2 ? 3 : 4
  return table[sBand][oBand][dBand]
}

export function apClass(ap?: ActionPriority) {
  if (ap === 'H') return 'bg-red-100 text-red-700'
  if (ap === 'M') return 'bg-amber-100 text-amber-800'
  if (ap === 'L') return 'bg-emerald-100 text-emerald-700'
  return 'text-slate-300'
}

export type SodKind = 'S' | 'O' | 'D'

export type SodStep = {
  id: string
  question: string
  hint?: string
  options: { label: string; next?: string; score?: number; note: string }[]
}

export const SOD_FLOWS: Record<SodKind, { title: string; start: string; steps: Record<string, SodStep> }> = {
  S: {
    title: '严重度评估 (S)',
    start: 'safety',
    steps: {
      safety: {
        id: 'safety',
        question: '影响安全 / 法规符合性吗？',
        hint: '评估对象：失效后果。沿判定路径确定严重度评分。',
        options: [
          { label: '是', next: 'safetyKind', note: '影响安全或不符合法规' },
          { label: '否', next: 'basic', note: '不影响安全/法规' },
        ],
      },
      safetyKind: {
        id: 'safetyKind',
        question: '属于哪一类？',
        options: [
          { label: '影响安全', score: 10, note: '影响安全' },
          { label: '不符合法规', score: 9, note: '不符合法规' },
        ],
      },
      basic: {
        id: 'basic',
        question: '影响基本功能吗？',
        options: [
          { label: '是', next: 'basicKind', note: '影响基本功能' },
          { label: '否', next: 'secondary', note: '不影响基本功能' },
        ],
      },
      basicKind: {
        id: 'basicKind',
        question: '基本功能如何受影响？',
        options: [
          { label: '丧失（基本功能）', score: 8, note: '丧失（基本功能）' },
          { label: '降低（基本功能）', score: 7, note: '降低（基本功能）' },
        ],
      },
      secondary: {
        id: 'secondary',
        question: '影响次要功能吗？',
        options: [
          { label: '是', next: 'secondaryKind', note: '影响次要功能' },
          { label: '否', next: 'annoy', note: '不影响次要功能' },
        ],
      },
      secondaryKind: {
        id: 'secondaryKind',
        question: '次要功能如何受影响？',
        options: [
          { label: '丧失（次要功能）', score: 6, note: '丧失（次要功能）' },
          { label: '降低（次要功能）', score: 5, note: '降低（次要功能）' },
        ],
      },
      annoy: {
        id: 'annoy',
        question: '会引起用户恼怒吗？',
        options: [
          { label: '是', next: 'annoyKind', note: '会引起用户恼怒' },
          { label: '否', score: 1, note: '没有可辨识的影响' },
        ],
      },
      annoyKind: {
        id: 'annoyKind',
        question: '恼怒范围？',
        options: [
          { label: '多数用户恼怒', score: 4, note: '多数用户恼怒' },
          { label: '部分用户恼怒', score: 3, note: '部分用户恼怒' },
          { label: '少数用户恼怒', score: 2, note: '少数用户恼怒' },
        ],
      },
    },
  },
  O: {
    title: '发生度评估 (O)',
    start: 'innovate',
    steps: {
      innovate: {
        id: 'innovate',
        question: '是否为创新设计？（行业内第一）',
        hint: '评估对象：失效模式 / 失效原因。沿判定路径确定发生度评分。',
        options: [
          { label: '是', next: 'innovateKind', note: '行业内第一的创新设计' },
          { label: '否', next: 'companyNew', note: '非行业首创' },
        ],
      },
      innovateKind: {
        id: 'innovateKind',
        question: '经验与预防措施情况？',
        options: [
          { label: '无任何经验、无预防措施', score: 10, note: '无任何经验、无预防措施' },
          { label: '无经验', score: 9, note: '无经验' },
        ],
      },
      companyNew: {
        id: 'companyNew',
        question: '是否为新设计？（公司内第一）',
        options: [
          { label: '是', next: 'companyNewKind', note: '公司内第一的新设计' },
          { label: '否', next: 'similar', note: '非公司首创' },
        ],
      },
      companyNewKind: {
        id: 'companyNewKind',
        question: '经验与准则情况？',
        options: [
          { label: '有极少经验、标准', score: 8, note: '有极少经验、标准' },
          { label: '经验、设计准则与实践符合设计要求', score: 7, note: '经验、设计准则与实践符合设计要求' },
        ],
      },
      similar: {
        id: 'similar',
        question: '是否为相似设计？',
        options: [
          { label: '是', next: 'similarKind', note: '相似设计' },
          { label: '否', next: 'mature', note: '非相似设计' },
        ],
      },
      similarKind: {
        id: 'similarKind',
        question: '经验情况？',
        options: [
          { label: '有极少经验', score: 6, note: '有极少经验' },
          { label: '一定的经验和最佳实践', score: 5, note: '一定的经验和最佳实践' },
          { label: '经验、设计准则与实践符合设计要求', score: 4, note: '经验、设计准则与实践符合设计要求' },
        ],
      },
      mature: {
        id: 'mature',
        question: '是否为相同或成熟设计？',
        options: [
          { label: '是', next: 'matureKind', note: '相同或成熟设计' },
          { label: '否', score: 1, note: '失效通过预防控制消除' },
        ],
      },
      matureKind: {
        id: 'matureKind',
        question: '经验情况？',
        options: [
          { label: '一定的经验和最佳实践', score: 3, note: '一定的经验和最佳实践' },
          { label: '经验、设计准则与实践符合设计要求', score: 2, note: '经验、设计准则与实践符合设计要求' },
        ],
      },
    },
  },
  D: {
    title: '探测度评估 (D)',
    start: 'has',
    steps: {
      has: {
        id: 'has',
        question: '是否有探测措施吗？',
        hint: '评估对象：失效影响、失效模式与失效原因共同对应探测度。',
        options: [
          { label: '无', next: 'noDetect', note: '无探测措施' },
          { label: '有', next: 'newMethod', note: '已有探测措施' },
        ],
      },
      noDetect: {
        id: 'noDetect',
        question: '测试方法情况？',
        options: [
          { label: '未制定测试方法', score: 10, note: '未制定测试方法' },
          { label: '没有特别的制定测试方法', score: 9, note: '没有特别的制定测试方法' },
        ],
      },
      newMethod: {
        id: 'newMethod',
        question: '是否为新的测试方法？',
        options: [
          { label: '是', score: 8, note: '新的测试方法' },
          { label: '否', next: 'afterFreeze', note: '非新测试方法' },
        ],
      },
      afterFreeze: {
        id: 'afterFreeze',
        question: '是否为设计冻结后进行探测？',
        options: [
          { label: '是', next: 'afterKind', note: '设计冻结后探测' },
          { label: '否', next: 'beforeFreeze', note: '非冻结后探测' },
        ],
      },
      afterKind: {
        id: 'afterKind',
        question: '冻结后探测方式？',
        options: [
          { label: '通过/不通过测试', score: 7, note: '通过/不通过测试' },
          { label: '失效测试', score: 6, note: '失效测试' },
          { label: '老化测试', score: 5, note: '老化测试' },
        ],
      },
      beforeFreeze: {
        id: 'beforeFreeze',
        question: '是否为设计冻结前进行探测？（开模之前）',
        options: [
          { label: '是', next: 'beforeKind', note: '开模前探测' },
          { label: '否', score: 1, note: '失效通过预防控制消除，经过实践验证总是能探测到失效' },
        ],
      },
      beforeKind: {
        id: 'beforeKind',
        question: '冻结前探测方式？',
        options: [
          { label: '通过/不通过测试', score: 4, note: '通过/不通过测试' },
          { label: '失效测试', score: 3, note: '失效测试' },
          { label: '老化测试', score: 2, note: '老化测试' },
        ],
      },
    },
  },
}

export const DFMEA_ACTION_STATUS = ['未开始', '进行中', '已完成', '已取消'] as const

export function displayReq(req?: Requirement) {
  if (!req) return ''
  return req.spec
}

export function displayReqTitle(req?: Requirement) {
  if (!req) return ''
  return req.feature ? `${req.reqNo} ${req.feature}` : req.reqNo
}
