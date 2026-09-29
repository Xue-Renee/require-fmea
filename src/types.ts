export type ReqStatus = '草稿' | '已评审' | '已基线' | '变更中' | '已关闭'
export type TrState = '未评估' | '是' | '否' | '不涉及'
export type CharacteristicSymbol = 'CC' | 'SC' | '一般'
export type Importance = 'MUST' | 'Should' | 'Nice to have'
export type RiskLevel = '高' | '中' | '低'
export type DeliveryPhase = 'EVT' | 'DVT' | 'PVT' | 'MP'
export type LinkType = '依赖' | '分解' | '满足' | '关联' | '冲突'
export type ReqLevel = '产品需求' | '模块需求' | '零件需求'
export type Role = 'admin' | 'member'
export type TrEvidenceKind = 'attachment' | 'plm'
export type FreezeStatus = '未发起' | '评审中' | '已通过' | '已驳回'
export type ChangeStatus = '审批中' | '已通过' | '已驳回' | '已关闭'
export type ReviewDecision = '同意' | '驳回'
export type DfmeaActionStatus = '未开始' | '进行中' | '已完成' | '已取消'
export type ActionPriority = 'H' | 'M' | 'L'
export type DfmeaAnalysisKind = 'failureEffect' | 'failureMode' | 'failureCause'

export type TrEvidence = {
  kind?: TrEvidenceKind
  name?: string
  url?: string
  naReason?: string
}

export interface Project {
  id: number
  name: string
  code: string
  coreDesigners?: string
  description?: string
  status: ReqStatus
  createdAt: string
  updatedAt: string
}

export interface Requirement {
  id: number
  projectId: number
  reqNo: string
  level: ReqLevel
  parentId?: number
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
  status: ReqStatus
  remark?: string
  bomItemId?: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface BomItem {
  id: number
  projectId: number
  partNo: string
  name: string
  moduleGroup?: string
  spec?: string
  qty?: number
  unit?: string
  remark?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface FreezeReviewer {
  role: string
  name: string
  decision?: ReviewDecision
  comment?: string
  decidedAt?: string
}

export interface FreezeReview {
  id: number
  projectId: number
  initiator: string
  status: FreezeStatus
  reviewers: FreezeReviewer[]
  comment?: string
  createdAt: string
  updatedAt: string
}

export interface ChangeEvent {
  at: string
  action: string
  by: string
  comment?: string
}

export interface ChangeRequest {
  id: number
  projectId: number
  title: string
  reason: string
  scope?: string
  initiator: string
  status: ChangeStatus
  createdAt: string
  updatedAt: string
  closedAt?: string
  history: ChangeEvent[]
}

export interface TestSubmit {
  id: number
  projectId: number
  reqId: number
  testers: string[]
  note?: string
  createdAt: string
  createdBy: string
}

export interface AppNotification {
  id: number
  projectId: number
  to: string
  title: string
  body: string
  createdAt: string
  read: boolean
}

export interface DfmeaAnalysis {
  id: number
  projectId: number
  reqId: number
  kind: DfmeaAnalysisKind
  text: string
  sortOrder: number
  updatedAt: string
}

export interface DfmeaRecord {
  id: number
  projectId: number
  productReqId?: number
  moduleReqId?: number
  partReqId?: number
  /** 结构分析绑定的产品 BOM 零件；与需求拆解无关 */
  bomItemId?: number
  failureEffectId?: number
  failureModeId?: number
  failureCauseId?: number
  failureCharacteristic?: string
  failureEffect?: string
  severity?: number
  failureMode?: string
  failureCause?: string
  preventionControl?: string
  occurrence?: number
  detectionControl?: string
  detection?: number
  specialChar?: string
  optPrevention?: string
  optDetection?: string
  owner?: string
  targetDate?: string
  actionStatus?: DfmeaActionStatus
  actualDate?: string
  severityAfter?: number
  occurrenceAfter?: number
  detectionAfter?: number
  updatedAt: string
}

export interface RequirementLink {
  id: number
  projectId: number
  fromReqId: number
  toReqId: number
  linkType: LinkType
}

export interface Database {
  projects: Project[]
  requirements: Requirement[]
  links: RequirementLink[]
  bomItems: BomItem[]
  freezeReviews: FreezeReview[]
  changeRequests: ChangeRequest[]
  testSubmits: TestSubmit[]
  notifications: AppNotification[]
  dfmeaRecords: DfmeaRecord[]
  dfmeaAnalyses: DfmeaAnalysis[]
  seq: number
}

export interface CustomOptions {
  categories?: string[]
  modules?: string[]
  disciplines?: string[]
  acceptanceMethods?: string[]
  partAcceptanceMethods?: string[]
}

export type OptionItem = {
  value: string
  hint?: string
  raw: string
}
