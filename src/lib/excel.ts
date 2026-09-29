import {
  BOM_EXCEL_HEADERS,
  EXCEL_COL_WIDTHS,
  EXCEL_HEADERS,
  isCharacteristic,
  isDeliveryPhase,
  isImportance,
  isReqLevel,
  isReqStatus,
  isRiskLevel,
  isTrState,
} from '@/lib/constants'
import { inferParentReqNo, reqLevel } from '@/lib/hierarchy'
import { DFMEA_ACTION_STATUS } from '@/lib/dfmea'
import {
  addLink,
  canEditRequirements,
  createBomItem,
  createRequirement,
  getDb,
  nextReqNo,
  relatedReqNos,
  syncDfmeaFromRequirements,
  updateBomItem,
  updateDfmeaAnalysis,
  updateDfmeaRecord,
  updateRequirement,
  type RequirementDraft,
} from '@/lib/store'
import { displayMulti, splitMulti } from '@/lib/utils'
import type { Project, Requirement, TrState } from '@/types'
import ExcelJS from 'exceljs'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

const FILL = 'FFD2DBE5'
const THIN: ExcelJS.BorderStyle = 'thin'
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: THIN, color: { argb: 'FF000000' } },
  left: { style: THIN, color: { argb: 'FF000000' } },
  bottom: { style: THIN, color: { argb: 'FF000000' } },
  right: { style: THIN, color: { argb: 'FF000000' } },
}

function styleTitleCell(cell: ExcelJS.Cell) {
  cell.font = { name: '微软雅黑', size: 20, bold: true, color: { argb: 'FF000000' } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL } }
  cell.border = BORDER
}

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { name: '微软雅黑', size: 10, bold: true, color: { argb: 'FF000000' } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL } }
  cell.border = BORDER
}

function styleDataCell(cell: ExcelJS.Cell, red = false) {
  cell.font = {
    name: '微软雅黑',
    size: 10,
    color: { argb: red ? 'FFFF0000' : 'FF000000' },
  }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = BORDER
}

function applyWidths(ws: ExcelJS.Worksheet) {
  EXCEL_COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
}

const COL_COUNT = EXCEL_HEADERS.length

function paintRow(ws: ExcelJS.Worksheet, rowNumber: number, values: Array<string | number>, kind: 'title' | 'header' | 'data' | 'example') {
  const row = ws.getRow(rowNumber)
  if (kind === 'title') row.height = 79
  else row.height = 33
  for (let c = 1; c <= COL_COUNT; c++) {
    const cell = row.getCell(c)
    if (kind !== 'title') cell.value = values[c - 1] ?? ''
    if (kind === 'title') styleTitleCell(cell)
    else if (kind === 'header') styleHeaderCell(cell)
    else styleDataCell(cell, kind === 'example')
  }
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const EXAMPLE_ROW = [
  '示例：CAM3D-0001',
  '光学成像',
  '测量精度',
  'Z 向重复测量精度 ≤ 0.05 mm @ 1 m 工作距离',
  '测试条件：1 m 工作距离，陶瓷标准球；目标值 0.05 mm；底线值 0.08 mm',
  '产品规格书 V1.0',
  '一般',
  'Should',
  '',
  '型式试验',
  '低',
  '投影、采集',
  '光学、算法',
  'EVT',
  '未评估',
  '未评估',
  '未评估',
  '未评估',
  '草稿',
  '',
  '产品需求',
  '',
  '',
]

function buildSheet(ws: ExcelJS.Worksheet, title: string) {
  applyWidths(ws)
  ws.mergeCells(`A1:${excelColName(COL_COUNT)}1`)
  ws.getCell('A1').value = title
  paintRow(ws, 1, [], 'title')
  paintRow(ws, 2, [...EXCEL_HEADERS], 'header')
}

export async function downloadTemplate() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('需求规格书')
  buildSheet(ws, '项目名称')
  paintRow(ws, 3, EXAMPLE_ROW, 'example')
  for (let i = 0; i < 30; i++) {
  paintRow(ws, 4 + i, Array(COL_COUNT).fill(''), 'data')
  }
  await downloadWorkbook(wb, '需求导入模板.xlsx')
}

function excelColName(n: number) {
  let s = ''
  let x = n
  while (x > 0) {
    const m = (x - 1) % 26
    s = String.fromCharCode(65 + m) + s
    x = Math.floor((x - 1) / 26)
  }
  return s
}

function reqToRow(req: Requirement, related: string, parentNo: string, bomPartNo: string): Array<string | number> {
  const level = reqLevel(req)
  const isProduct = level === '产品需求'
  const isPart = level === '零件需求'
  return [
    req.reqNo,
    isPart ? '' : req.category,
    req.feature ?? '',
    req.spec,
    req.specDescription ?? '',
    isProduct ? (req.source ?? '') : '',
    req.characteristicSymbol,
    isProduct ? req.importance : '',
    related,
    displayMulti(req.acceptanceMethod) || req.acceptanceMethod,
    req.riskLevel,
    isProduct ? displayMulti(req.module) : '',
    displayMulti(req.discipline),
    req.deliveryPhase,
    req.tr3DesignCovered,
    req.tr4Verified,
    req.tr4aPassed,
    req.tr5Accepted,
    req.status,
    req.remark ?? '',
    level,
    parentNo,
    bomPartNo,
  ]
}

export async function exportProjectExcel(project: Project) {
  const db = getDb()
  const reqs = db.requirements.filter((r) => r.projectId === project.id).sort((a, b) => a.sortOrder - b.sortOrder)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('需求规格书')
  buildSheet(ws, project.name)
  reqs.forEach((req, i) => {
    const related = relatedReqNos(req, db).join(',')
    const parentNo = req.parentId ? (db.requirements.find((r) => r.id === req.parentId)?.reqNo ?? '') : ''
    const bomPartNo = req.bomItemId ? (db.bomItems.find((b) => b.id === req.bomItemId)?.partNo ?? '') : ''
    paintRow(ws, 3 + i, reqToRow(req, related, parentNo, bomPartNo), 'data')
  })
  await downloadWorkbook(wb, `${project.name}-需求规格书.xlsx`)
}

function cellStr(v: unknown) {
  if (v == null) return ''
  return String(v).trim()
}

function coerceTr(v: string): TrState {
  return isTrState(v) ? v : '未评估'
}

export async function importProjectExcel(project: Project, file: File) {
  const gate = canEditRequirements(project.id)
  if (!gate.ok) {
    toast.error(gate.reason)
    return
  }
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) {
    toast.error('未解析到有效工作表')
    return
  }
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    if (cellStr(rows[i]?.[0]) === '产品需求ID' || cellStr(rows[i]?.[0]) === '需求ID') {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) {
    toast.error('未找到表头行（首列应为「产品需求ID」或「需求ID」）')
    return
  }

  const header = (rows[headerIdx] ?? []).map((h) => cellStr(h))
  const col = (name: string) => header.indexOf(name)

  const idx = {
    reqNo: col('产品需求ID') >= 0 ? col('产品需求ID') : col('需求ID'),
    category: col('需求分类'),
    feature: col('需求特性'),
    spec: col('需求规格'),
    specDescription: col('需求规格描述'),
    source: col('需求依据/需求来源'),
    characteristicSymbol: col('特性符号'),
    importance: col('需求重要度'),
    related: col('关联需求'),
    acceptanceMethod: col('验收方式'),
    riskLevel: col('设计实现难度'),
    module: col('涉及模块'),
    discipline: col('涉及专业'),
    deliveryPhase: col('交付阶段'),
    tr3: col('TR3设计是否已包含实现'),
    tr4: col('TR4验证是否通过'),
    tr4a: col('TR4A需求是否通过'),
    tr5: col('TR5需求验收是否通过'),
    status: col('状态'),
    remark: col('通用要求/备注'),
    level: col('需求层级'),
    parentNo: col('父需求ID'),
    bomPartNo: col('关联BOM零件编码'),
  }

  const created: Requirement[] = []
  const pendingLinks: { fromNo: string; toNos: string[] }[] = []
  const pendingParents: { childNo: string; parentNo: string; level: string }[] = []
  const pendingBom: { childNo: string; partNo: string }[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const excelRow = i + 1
    const get = (key: keyof typeof idx) => (idx[key] >= 0 ? cellStr(row[idx[key]]) : '')
    const allEmpty = row.every((c) => cellStr(c) === '')
    if (allEmpty) continue

    const reqNoRaw = get('reqNo')
    if (reqNoRaw.startsWith('示例')) continue

    const spec = get('spec')
    if (!spec) {
      const hasAny = row.some((c) => cellStr(c) !== '')
      if (hasAny) toast.warning(`第 ${excelRow} 行缺少「需求规格」，已跳过`)
      continue
    }

    const charRaw = get('characteristicSymbol')
    const impRaw = get('importance')
    const riskRaw = get('riskLevel')
    const phaseRaw = get('deliveryPhase')
    const statusRaw = get('status')
    const db = getDb()
    const projectNow = db.projects.find((p) => p.id === project.id) ?? project

    const draft: RequirementDraft = {
      category: get('category') || '其他',
      feature: get('feature') || undefined,
      spec,
      specDescription: get('specDescription') || undefined,
      source: get('source') || undefined,
      characteristicSymbol: isCharacteristic(charRaw) ? charRaw : '一般',
      importance: isImportance(impRaw) ? impRaw : 'Should',
      acceptanceMethod: get('acceptanceMethod') || '型式试验',
      riskLevel: isRiskLevel(riskRaw) ? riskRaw : '低',
      module: splitMulti(get('module')).join(',') || undefined,
      discipline: splitMulti(get('discipline')).join(',') || undefined,
      deliveryPhase: isDeliveryPhase(phaseRaw) ? phaseRaw : 'EVT',
      tr3DesignCovered: coerceTr(get('tr3')),
      tr4Verified: coerceTr(get('tr4')),
      tr4aPassed: coerceTr(get('tr4a')),
      tr5Accepted: coerceTr(get('tr5')),
      remark: get('remark') || undefined,
    }

    const reqNo = reqNoRaw || nextReqNo(projectNow, getDb().requirements)
    const levelRaw = get('level')
    const inferredLevel =
      isReqLevel(levelRaw)
        ? levelRaw
        : /-(?:P)\d+$/.test(reqNo)
          ? '零件需求'
          : /-(?:M)\d+$/.test(reqNo)
            ? '模块需求'
            : '产品需求'
    const createdReq = createRequirement(project.id, draft, {
      reqNo,
      status: isReqStatus(statusRaw) ? statusRaw : projectNow.status,
      level: inferredLevel,
    })
    if (createdReq) {
      created.push(createdReq)
      pendingLinks.push({ fromNo: createdReq.reqNo, toNos: splitMulti(get('related')) })
      const parentNo = get('parentNo') || inferParentReqNo(reqNo) || ''
      if (parentNo && inferredLevel !== '产品需求') {
        pendingParents.push({ childNo: createdReq.reqNo, parentNo, level: inferredLevel })
      }
      const bomPartNo = get('bomPartNo')
      if (bomPartNo && inferredLevel === '零件需求') {
        pendingBom.push({ childNo: createdReq.reqNo, partNo: bomPartNo })
      }
    }
  }

  if (created.length === 0) {
    toast.message('未解析到有效需求行')
    return
  }

  const dbAfter = getDb()
  const importedByNo = new Map<string, Requirement[]>()
  for (const r of created) {
    const list = importedByNo.get(r.reqNo) ?? []
    list.push(r)
    importedByNo.set(r.reqNo, list)
  }

  let linkCount = 0
  for (const item of pendingLinks) {
    const fromList = importedByNo.get(item.fromNo) ?? []
    const from = fromList[fromList.length - 1]
    if (!from) continue
    for (const toNo of item.toNos) {
      if (toNo === from.reqNo) continue
      const importedTargets = importedByNo.get(toNo)
      const target =
        importedTargets?.find((r) => r.id !== from.id) ??
        dbAfter.requirements.find((r) => r.projectId === project.id && r.reqNo === toNo && r.id !== from.id)
      if (!target) continue
      const res = addLink({
        projectId: project.id,
        fromReqId: from.id,
        toReqId: target.id,
        linkType: '关联',
      })
      if (res.ok) linkCount += 1
    }
  }

  let parentLinks = 0
  const latestDb = getDb()
  for (const item of pendingParents) {
    const childList = importedByNo.get(item.childNo) ?? []
    const child = childList[childList.length - 1]
    if (!child) continue
    const parent =
      (importedByNo.get(item.parentNo) ?? []).find((r) => r.id !== child.id) ??
      latestDb.requirements.find((r) => r.projectId === project.id && r.reqNo === item.parentNo && r.id !== child.id)
    if (!parent) continue
    updateRequirement(child.id, { parentId: parent.id, level: isReqLevel(item.level) ? item.level : child.level })
    parentLinks += 1
  }

  let bomLinks = 0
  const dbBom = getDb()
  for (const item of pendingBom) {
    const childList = importedByNo.get(item.childNo) ?? []
    const child = childList[childList.length - 1]
    if (!child) continue
    const bom = dbBom.bomItems.find(
      (b) => b.projectId === project.id && b.partNo.trim().toLowerCase() === item.partNo.trim().toLowerCase(),
    )
    if (!bom) continue
    updateRequirement(child.id, { bomItemId: bom.id })
    bomLinks += 1
  }

  toast.success(`已导入 ${created.length} 条需求`)
  toast.success(`已建立 ${linkCount} 条关联`)
  if (parentLinks) toast.success(`已建立 ${parentLinks} 条父子拆解`)
  if (bomLinks) toast.success(`已关联 ${bomLinks} 条零件到涉及零件`)
}

const BOM_WIDTHS = [16, 16, 18, 28, 10, 10, 28]

function paintBomSheet(ws: ExcelJS.Worksheet, title: string) {
  BOM_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
  const colCount = BOM_EXCEL_HEADERS.length
  ws.mergeCells(`A1:${excelColName(colCount)}1`)
  ws.getCell('A1').value = title
  const titleRow = ws.getRow(1)
  titleRow.height = 40
  for (let c = 1; c <= colCount; c++) styleTitleCell(titleRow.getCell(c))
  const headerRow = ws.getRow(2)
  headerRow.height = 24
  BOM_EXCEL_HEADERS.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
    styleHeaderCell(headerRow.getCell(i + 1))
  })
}

function paintBomRow(ws: ExcelJS.Worksheet, rowNumber: number, values: Array<string | number>, example = false) {
  const row = ws.getRow(rowNumber)
  row.height = 24
  for (let c = 1; c <= BOM_EXCEL_HEADERS.length; c++) {
    const cell = row.getCell(c)
    cell.value = values[c - 1] ?? ''
    styleDataCell(cell, example)
  }
}

export async function downloadBomTemplate() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('涉及零件')
  paintBomSheet(ws, '涉及零件')
  paintBomRow(ws, 3, ['CAM3D-P-001', '投射模组', '投影镜头', '结构光投影镜头 f=12mm', 1, 'pcs', '示例行，导入时会跳过'], true)
  for (let i = 0; i < 20; i++) paintBomRow(ws, 4 + i, Array(BOM_EXCEL_HEADERS.length).fill(''))
  await downloadWorkbook(wb, 'BOM导入模板.xlsx')
}

export async function exportProjectBom(project: Project) {
  const db = getDb()
  const items = db.bomItems.filter((b) => b.projectId === project.id).sort((a, b) => a.sortOrder - b.sortOrder)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('涉及零件')
  paintBomSheet(ws, `${project.name}-涉及零件`)
  items.forEach((item, i) => {
    paintBomRow(ws, 3 + i, [item.partNo, item.moduleGroup ?? '', item.name, item.spec ?? '', item.qty ?? '', item.unit ?? '', item.remark ?? ''])
  })
  await downloadWorkbook(wb, `${project.name}-涉及零件.xlsx`)
}

export async function importProjectBom(project: Project, file: File) {
  const gate = canEditRequirements(project.id)
  if (!gate.ok) {
    toast.error(gate.reason)
    return
  }
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) {
    toast.error('未解析到有效工作表')
    return
  }
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    if (cellStr(rows[i]?.[0]) === '物料编码') {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) {
    toast.error('未找到表头行（首列应为「物料编码」）')
    return
  }

  const header = (rows[headerIdx] ?? []).map((h) => cellStr(h))
  const col = (name: string) => header.indexOf(name)
  const idx = {
    partNo: col('物料编码'),
    moduleGroup: col('所属模组') >= 0 ? col('所属模组') : col('零件模组'),
    name: col('零件名称'),
    spec: col('规格型号'),
    qty: col('数量'),
    unit: col('单位'),
    remark: col('备注'),
  }

  const db = getDb()
  const existing = db.bomItems.filter((b) => b.projectId === project.id)
  const byNo = new Map(existing.map((b) => [b.partNo.trim().toLowerCase(), b]))
  let created = 0
  let updated = 0

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const get = (key: keyof typeof idx) => (idx[key] >= 0 ? cellStr(row[idx[key]]) : '')
    const partNo = get('partNo')
    const name = get('name')
    if (!partNo && !name) continue
    if (partNo.startsWith('示例') || name.startsWith('示例')) continue
    if (!partNo || !name) {
      toast.warning(`第 ${i + 1} 行缺少物料编码或零件名称，已跳过`)
      continue
    }
    const qtyRaw = get('qty')
    const qty = qtyRaw === '' ? undefined : Number(qtyRaw)
    const draft = {
      partNo,
      name,
      moduleGroup: get('moduleGroup') || undefined,
      spec: get('spec') || undefined,
      qty: qtyRaw !== '' && Number.isFinite(qty) ? qty : undefined,
      unit: get('unit') || undefined,
      remark: get('remark') || undefined,
    }
    const found = byNo.get(partNo.trim().toLowerCase())
    if (found) {
      updateBomItem(found.id, draft)
      updated += 1
    } else {
      const item = createBomItem(project.id, draft)
      byNo.set(partNo.trim().toLowerCase(), item)
      created += 1
    }
  }

  if (created + updated === 0) {
    toast.message('未解析到有效BOM行')
    return
  }
  toast.success(`已导入 BOM：新增 ${created} 项，更新 ${updated} 项`)
}

const DFMEA_EXCEL_HEADERS = [
  '上一较高级别',
  '关注要素',
  '下一较低级别或特性类型',
  '产品需求编号',
  '模块需求编号',
  '零件需求编号',
  '失效影响（FE）',
  '严重度S',
  '失效模式（FM）',
  '失效原因（FC）',
  '当前预防控制措施',
  '频度O',
  '当前探测控制措施',
  '探测度D',
  'DFMEA预防措施',
  'DFMEA探测措施',
  '责任人',
  '目标完成日期',
  '状态',
  '实际完成日期',
  '优化后严重度S',
  '优化后频度O',
  '优化后探测度D',
]

const DFMEA_WIDTHS = [22, 16, 22, 18, 20, 22, 28, 10, 28, 28, 22, 10, 22, 10, 22, 22, 12, 14, 12, 14, 14, 14, 14]

function paintDfmeaSheet(ws: ExcelJS.Worksheet, title: string) {
  DFMEA_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
  const colCount = DFMEA_EXCEL_HEADERS.length
  ws.mergeCells(`A1:${excelColName(colCount)}1`)
  ws.getCell('A1').value = title
  const titleRow = ws.getRow(1)
  titleRow.height = 40
  for (let c = 1; c <= colCount; c++) styleTitleCell(titleRow.getCell(c))
  const headerRow = ws.getRow(2)
  headerRow.height = 28
  DFMEA_EXCEL_HEADERS.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
    styleHeaderCell(headerRow.getCell(i + 1))
  })
}

function paintDfmeaRow(ws: ExcelJS.Worksheet, rowNumber: number, values: Array<string | number>, example = false) {
  const row = ws.getRow(rowNumber)
  row.height = 28
  for (let c = 1; c <= DFMEA_EXCEL_HEADERS.length; c++) {
    const cell = row.getCell(c)
    cell.value = values[c - 1] ?? ''
    styleDataCell(cell, example)
  }
}

function sodNum(raw: string): number | undefined {
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  const r = Math.round(n)
  if (r < 1 || r > 10) return undefined
  return r
}

export async function downloadDfmeaTemplate() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('DFMEA')
  paintDfmeaSheet(ws, 'DFMEA导入模板')
  paintDfmeaRow(
    ws,
    3,
    [
      '结构光 3D 工业相机（CAM3D-2000）',
      '投射模组',
      '投影镜头',
      '示例：CAM3D-0001',
      'CAM3D-0001-M01',
      'CAM3D-0001-M01-P01',
      'Z 向精度超差导致客户验收失败',
      8,
      '投影光机热漂移',
      '镜头装配偏心超差',
      '装配工装与公差抽检',
      5,
      '光轴检测与温漂试验',
      4,
      '增加热补偿算法',
      'EVT 温漂复测',
      '王工',
      '2026-12-31',
      '进行中',
      '',
      '',
      '',
      '',
    ],
    true,
  )
  for (let i = 0; i < 20; i++) paintDfmeaRow(ws, 4 + i, Array(DFMEA_EXCEL_HEADERS.length).fill(''))
  await downloadWorkbook(wb, 'DFMEA导入模板.xlsx')
}

export async function exportProjectDfmea(project: Project) {
  const db = getDb()
  const reqs = db.requirements.filter((r) => r.projectId === project.id)
  const byId = new Map(reqs.map((r) => [r.id, r]))
  const recs = db.dfmeaRecords.filter((r) => r.projectId === project.id)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('DFMEA')
  paintDfmeaSheet(ws, `${project.name}-DFMEA`)
  recs.forEach((rec, i) => {
    const product = rec.productReqId ? byId.get(rec.productReqId) : undefined
    const module = rec.moduleReqId ? byId.get(rec.moduleReqId) : undefined
    const part = rec.partReqId ? byId.get(rec.partReqId) : undefined
    const bom =
      (rec.bomItemId ? db.bomItems.find((b) => b.id === rec.bomItemId) : undefined) ??
      (part?.bomItemId ? db.bomItems.find((b) => b.id === part.bomItemId) : undefined)
    paintDfmeaRow(ws, 3 + i, [
      bom ? project.name : '',
      bom?.moduleGroup ?? '',
      bom?.name ?? '',
      product?.reqNo ?? '',
      module?.reqNo ?? '',
      part?.reqNo ?? '',
      rec.failureEffect ?? '',
      rec.severity ?? '',
      rec.failureMode ?? '',
      rec.failureCause ?? '',
      rec.preventionControl ?? '',
      rec.occurrence ?? '',
      rec.detectionControl ?? '',
      rec.detection ?? '',
      rec.optPrevention ?? '',
      rec.optDetection ?? '',
      rec.owner ?? '',
      rec.targetDate ?? '',
      rec.actionStatus ?? '',
      rec.actualDate ?? '',
      rec.severityAfter ?? '',
      rec.occurrenceAfter ?? '',
      rec.detectionAfter ?? '',
    ])
  })
  await downloadWorkbook(wb, `${project.name}-DFMEA.xlsx`)
}

export async function importProjectDfmea(project: Project, file: File) {
  const gate = canEditRequirements(project.id)
  if (!gate.ok) {
    toast.error(gate.reason)
    return
  }
  syncDfmeaFromRequirements(project.id)
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) {
    toast.error('未解析到有效工作表')
    return
  }
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const first = cellStr(rows[i]?.[0])
    if (first === '产品需求编号' || first === '上一较高级别') {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) {
    toast.error('未找到表头行（首列应为「上一较高级别」或「产品需求编号」）')
    return
  }
  const header = (rows[headerIdx] ?? []).map((h) => cellStr(h))
  const col = (name: string) => header.indexOf(name)
  const idx = {
    structureProduct: col('上一较高级别'),
    structureModule: col('关注要素'),
    structurePart: col('下一较低级别或特性类型'),
    product: col('产品需求编号'),
    module: col('模块需求编号'),
    part: col('零件需求编号'),
    fe: col('失效影响（FE）'),
    s: col('严重度S'),
    fm: col('失效模式（FM）'),
    fc: col('失效原因（FC）'),
    prevention: col('当前预防控制措施'),
    o: col('频度O'),
    detection: col('当前探测控制措施'),
    d: col('探测度D'),
    optP: col('DFMEA预防措施'),
    optD: col('DFMEA探测措施'),
    owner: col('责任人'),
    target: col('目标完成日期'),
    status: col('状态'),
    actual: col('实际完成日期'),
    s2: col('优化后严重度S'),
    o2: col('优化后频度O'),
    d2: col('优化后探测度D'),
  }

  const db = getDb()
  const reqs = db.requirements.filter((r) => r.projectId === project.id)
  const byNo = new Map(reqs.map((r) => [r.reqNo.trim().toLowerCase(), r]))
  const bomItems = db.bomItems.filter((b) => b.projectId === project.id)
  let updated = 0
  let skipped = 0

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const get = (key: keyof typeof idx) => (idx[key] >= 0 ? cellStr(row[idx[key]]) : '')
    const productNo = get('product')
    const moduleNo = get('module')
    const partNo = get('part')
    if (!productNo && !moduleNo && !partNo && !get('structurePart') && !get('structureModule')) continue
    if (productNo.startsWith('示例') || get('structureProduct').startsWith('示例')) {
      skipped += 1
      continue
    }
    const product = productNo ? byNo.get(productNo.trim().toLowerCase()) : undefined
    const module = moduleNo ? byNo.get(moduleNo.trim().toLowerCase()) : undefined
    const part = partNo ? byNo.get(partNo.trim().toLowerCase()) : undefined
    if (productNo && !product) {
      toast.warning(`第 ${i + 1} 行未找到产品需求 ${productNo}，已跳过`)
      skipped += 1
      continue
    }
    const fe = get('fe')
    const fm = get('fm')
    const fc = get('fc')
    if (product && fe) updateDfmeaAnalysis(project.id, 'failureEffect', product.id, fe)
    if (module && fm) updateDfmeaAnalysis(project.id, 'failureMode', module.id, fm)
    if (part && fc) updateDfmeaAnalysis(project.id, 'failureCause', part.id, fc)
    const latest = getDb().dfmeaRecords.filter((r) => r.projectId === project.id)
    const rec =
      latest.find(
        (r) =>
          r.productReqId === product?.id &&
          r.moduleReqId === module?.id &&
          r.partReqId === part?.id &&
          (fe ? r.failureEffect === fe : !r.failureEffect) &&
          (fm ? r.failureMode === fm : !r.failureMode) &&
          (fc ? r.failureCause === fc : !r.failureCause),
      ) ?? latest.find((r) => r.productReqId === product?.id && r.moduleReqId === module?.id && r.partReqId === part?.id)
    if (!rec) {
      toast.warning(`第 ${i + 1} 行没有对应的 DFMEA 路径，请先在结构树中拆解需求`)
      skipped += 1
      continue
    }
    const statusRaw = get('status')
    const status = DFMEA_ACTION_STATUS.includes(statusRaw as (typeof DFMEA_ACTION_STATUS)[number])
      ? (statusRaw as (typeof DFMEA_ACTION_STATUS)[number])
      : undefined
    const partName = get('structurePart')
    const moduleGroup = get('structureModule')
    let bomItemId = rec.bomItemId
    if (partName) {
      const match =
        bomItems.find((b) => b.name === partName && (!moduleGroup || b.moduleGroup === moduleGroup)) ??
        bomItems.find((b) => b.name === partName)
      if (match) bomItemId = match.id
    } else if (moduleGroup) {
      bomItemId = bomItems.find((b) => b.moduleGroup === moduleGroup)?.id
    }
    updateDfmeaRecord(rec.id, {
      bomItemId,
      severity: sodNum(get('s')),
      preventionControl: get('prevention') || undefined,
      occurrence: sodNum(get('o')),
      detectionControl: get('detection') || undefined,
      detection: sodNum(get('d')),
      optPrevention: get('optP') || undefined,
      optDetection: get('optD') || undefined,
      owner: get('owner') || undefined,
      targetDate: get('target') || undefined,
      actionStatus: status,
      actualDate: get('actual') || undefined,
      severityAfter: sodNum(get('s2')),
      occurrenceAfter: sodNum(get('o2')),
      detectionAfter: sodNum(get('d2')),
    })
    updated += 1
  }

  if (updated === 0) {
    toast.message(skipped ? `未导入有效 DFMEA 行（跳过 ${skipped} 行）` : '未解析到有效 DFMEA 行')
    return
  }
  toast.success(`已导入 DFMEA：更新 ${updated} 行${skipped ? `，跳过 ${skipped} 行` : ''}`)
}
