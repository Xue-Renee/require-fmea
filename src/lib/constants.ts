import type {
  CharacteristicSymbol,
  DeliveryPhase,
  Importance,
  LinkType,
  ReqLevel,
  ReqStatus,
  RiskLevel,
  TrState,
} from '@/types'

export const REQ_STATUS = ['草稿', '已评审', '已基线', '变更中', '已关闭'] as const satisfies readonly ReqStatus[]

export const TR_STATES = ['未评估', '是', '否', '不涉及'] as const satisfies readonly TrState[]

export const CHARACTERISTIC_SYMBOLS = ['CC', 'SC', '一般'] as const satisfies readonly CharacteristicSymbol[]

export const IMPORTANCE_LEVELS = ['MUST', 'Should', 'Nice to have'] as const satisfies readonly Importance[]

export const RISK_LEVELS = ['高', '中', '低'] as const satisfies readonly RiskLevel[]

export const DELIVERY_PHASES = ['EVT', 'DVT', 'PVT', 'MP'] as const satisfies readonly DeliveryPhase[]

export const LINK_TYPES = ['依赖', '分解', '满足', '关联', '冲突'] as const satisfies readonly LinkType[]

export const REQ_LEVELS = ['产品需求', '模块需求', '零件需求'] as const satisfies readonly ReqLevel[]

export const CHILD_LEVEL: Record<ReqLevel, ReqLevel | null> = {
  产品需求: '模块需求',
  模块需求: '零件需求',
  零件需求: null,
}

export const PARENT_LEVEL: Record<ReqLevel, ReqLevel | null> = {
  产品需求: null,
  模块需求: '产品需求',
  零件需求: '模块需求',
}

export const DEFAULT_CATEGORIES = [
  '光学成像',
  '结构硬件',
  '电子电气',
  '嵌入式软件',
  '算法',
  '接口通信',
  '上位机软件',
  '可靠性',
  '环境适应性',
  '安规认证',
  '生产工艺',
  '成本',
  '整机外观',
  '精度',
  'Benchmark',
  '产品资料',
  '配件',
  '软硬件环境',
  '采集',
  '其他',
]

export const DEFAULT_MODULES = [
  '投影（投影硬件、投影控制）',
  '采集（相机硬件、采集控制与传输、图像效果）',
  '重建',
  '计算（DAS架构、CIS架构）',
  '通信',
  '结构防护与热设计',
  '硬件外部交互',
  '软件功能',
]

export const DEFAULT_DISCIPLINES = ['光学', '结构', '电路', 'FPGA', '嵌入式', '软件', '算法']

export const DEFAULT_ACCEPTANCE_METHODS = ['型式试验', '下线测试', '原型确认', '供方测试', '技术评审']

export const DEFAULT_PART_ACCEPTANCE_METHODS = [
  '供应商测试',
  '我司测试',
  '检验',
  '图纸/规格书',
  '供应商保证',
  '文档保证',
]

export const BOM_MODULE_GROUPS = [
  '投射模组',
  '采集模组',
  '主控与处理模组',
  '电源管理模组',
  '接口与通信模组',
  '结构件与外壳',
  '散热模组',
] as const

export const FREEZE_REVIEW_ROLES = [
  'SE',
  '项目经理',
  '新产品质量',
  '软件代表',
  '硬件项目经理',
  '测试代表',
  '产品经理',
] as const

export const TR_GATES = [
  { key: 'tr3', valueField: 'tr3DesignCovered', evidenceField: 'tr3Evidence', short: 'TR3', label: 'TR3设计是否已包含实现' },
  { key: 'tr4', valueField: 'tr4Verified', evidenceField: 'tr4Evidence', short: 'TR4', label: 'TR4验证是否通过' },
  { key: 'tr4a', valueField: 'tr4aPassed', evidenceField: 'tr4aEvidence', short: 'TR4A', label: 'TR4A需求是否通过' },
  { key: 'tr5', valueField: 'tr5Accepted', evidenceField: 'tr5Evidence', short: 'TR5', label: 'TR5需求验收是否通过' },
] as const

export const DEFAULT_TESTERS = ['测试代表', '软件测试', '硬件测试', '系统测试']

export const EXCEL_HEADERS = [
  '产品需求ID',
  '需求分类',
  '需求特性',
  '需求规格',
  '需求规格描述',
  '需求依据/需求来源',
  '特性符号',
  '需求重要度',
  '关联需求',
  '验收方式',
  '设计实现难度',
  '涉及模块',
  '涉及专业',
  '交付阶段',
  'TR3设计是否已包含实现',
  'TR4验证是否通过',
  'TR4A需求是否通过',
  'TR5需求验收是否通过',
  '状态',
  '通用要求/备注',
  '需求层级',
  '父需求ID',
  '关联BOM零件编码',
] as const

export const EXCEL_COL_WIDTHS = [
  12.32, 12.38, 18.83, 32.84, 13, 18.83, 7.75, 10.75, 12.68, 11.61, 8.03, 18.83, 13, 9.11, 10.97, 9, 9, 9, 10.17,
  24.64, 12, 16, 16,
]

export const BOM_EXCEL_HEADERS = ['物料编码', '所属模组', '零件名称', '规格型号', '数量', '单位', '备注'] as const

export const LS_DB = 'sysre.db.v1'
export const LS_ROLE = 'sysre.role'
export const LS_OPTIONS = 'sysre.options'
export const LS_SIDEBAR = 'sysre.sidebar'
export const LS_LIST_VIEW = 'sysre.listView.v1'

export function isReqStatus(v: string): v is ReqStatus {
  return (REQ_STATUS as readonly string[]).includes(v)
}

export function isTrState(v: string): v is TrState {
  return (TR_STATES as readonly string[]).includes(v)
}

export function isCharacteristic(v: string): v is CharacteristicSymbol {
  return (CHARACTERISTIC_SYMBOLS as readonly string[]).includes(v)
}

export function isImportance(v: string): v is Importance {
  return (IMPORTANCE_LEVELS as readonly string[]).includes(v)
}

export function isRiskLevel(v: string): v is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(v)
}

export function isDeliveryPhase(v: string): v is DeliveryPhase {
  return (DELIVERY_PHASES as readonly string[]).includes(v)
}

export function isLinkType(v: string): v is LinkType {
  return (LINK_TYPES as readonly string[]).includes(v)
}

export function isReqLevel(v: string): v is ReqLevel {
  return (REQ_LEVELS as readonly string[]).includes(v)
}

export function isBomModuleGroup(v: string): boolean {
  return (BOM_MODULE_GROUPS as readonly string[]).includes(v)
}
