import { SodWizard } from '@/components/dfmea/SodWizard'
import { DfmeaHelp, SodDHelp, SodOHelp, SodSHelp } from '@/components/FieldHelp'
import { apClass, DFMEA_ACTION_STATUS, displayReq, scoreAp, type SodKind } from '@/lib/dfmea'
import { setDfmeaRecordAnalysis, updateDfmeaRecord, updateRequirement } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { BomItem, Database, DfmeaRecord, Project, Requirement } from '@/types'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

type PathRow = {
  record: DfmeaRecord
  product?: Requirement
  module?: Requirement
  part?: Requirement
}

function CellText({
  value,
  placeholder,
  onCommit,
}: {
  value: string
  placeholder?: string
  onCommit: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  return editing ? (
    <textarea
      className="min-h-[56px] w-full min-w-[140px] rounded border px-1 py-0.5 text-[12px]"
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        if (draft !== value) onCommit(draft)
      }}
    />
  ) : (
    <button
      type="button"
      className="min-h-[40px] w-full min-w-[140px] whitespace-normal text-left text-[12px] leading-snug text-slate-700 hover:bg-sky-50"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
    >
      {value || <span className="text-slate-300">{placeholder ?? '点击填写'}</span>}
    </button>
  )
}

function StructureSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder: string
  onChange: (v: string) => void
}) {
  return (
    <select
      className="h-8 w-full min-w-[128px] rounded border bg-white px-1 text-[12px] leading-tight"
      value={value}
      title={options.find((o) => o.value === value)?.label || placeholder}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function ScoreBtn({
  value,
  kind,
  onOpen,
}: {
  value?: number
  kind: SodKind
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 w-10 items-center justify-center rounded border text-[13px] font-semibold',
        value ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-dashed text-slate-300',
      )}
      title={`按${kind}判定表评分`}
      onClick={onOpen}
    >
      {value ?? '—'}
    </button>
  )
}

export function DfmeaTable({
  db,
  project,
  rows,
}: {
  db: Database
  project: Project
  rows: PathRow[]
}) {
  const [wiz, setWiz] = useState<{ kind: SodKind; recordId: number; field: 'severity' | 'occurrence' | 'detection' | 'severityAfter' | 'occurrenceAfter' | 'detectionAfter' } | null>(null)
  const grouped = useMemo(() => rows, [rows])
  const bomItems = useMemo(
    () => db.bomItems.filter((b) => b.projectId === project.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [db.bomItems, project.id],
  )
  const productOptions = useMemo(() => (project.name.trim() ? [{ value: project.name, label: project.name }] : []), [project.name])
  const moduleOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: { value: string; label: string }[] = []
    for (const item of bomItems) {
      const g = item.moduleGroup?.trim()
      if (!g || seen.has(g)) continue
      seen.add(g)
      out.push({ value: g, label: g })
    }
    return out
  }, [bomItems])
  const partOptions = useMemo(
    () => bomItems.map((b) => ({ value: String(b.id), label: b.name })),
    [bomItems],
  )

  const patchReq = (id: number | undefined, spec: string) => {
    if (!id) return
    try {
      updateRequirement(id, { spec })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '需求已基线，请走变更系统')
    }
  }

  const patchRec = (id: number, patch: Partial<DfmeaRecord>) => {
    updateDfmeaRecord(id, patch)
  }

  const applyBom = (recordId: number, bomItemId: number | undefined) => {
    patchRec(recordId, { bomItemId })
  }

  const pickByModule = (moduleGroup: string, current?: BomItem) => {
    const inModule = bomItems.filter((b) => b.moduleGroup === moduleGroup)
    if (current && current.moduleGroup === moduleGroup) return current.id
    return inModule[0]?.id
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 text-[12px] text-slate-500">
        结构分析三列来自产品 BOM（产品名称 / 所属模组 / 零件名称），与需求拆解无关；调整其中一列会联动更新另外两列。功能列来自需求；失效影响 / 模式 / 原因针对对应层级，一条需求可对应多条分析。S / O / D 点击后按判定表逐步打分。
        <DfmeaHelp />
      </div>
      <div className="req-table-wrap">
        <table className="req-table dfmea-table">
          <thead>
            <tr>
              <th colSpan={3} className="dfmea-step-2">
                结构分析（步骤二）
              </th>
              <th colSpan={3} className="dfmea-step-3">
                功能分析（步骤三）
              </th>
              <th colSpan={7} className="dfmea-step-4">
                失效分析（步骤四）
              </th>
              <th colSpan={2} className="dfmea-step-5">
                DFMEA 风险评估（步骤五）
              </th>
              <th colSpan={10} className="dfmea-step-6">
                DFMEA 优化（步骤六）
              </th>
            </tr>
            <tr>
              <th className="min-w-[150px]">1.上一较高级别</th>
              <th className="min-w-[130px]">2.关注要素</th>
              <th className="min-w-[150px]">3.下一较低级别或特性类型</th>
              <th className="min-w-[180px]">1.上一层级功能和性能要求/产品需求</th>
              <th className="min-w-[180px]">2.关注要素功能和要求/模块需求</th>
              <th className="min-w-[180px]">3.下一层级系统/零部件功能和性能特性</th>
              <th className="min-w-[160px]">失效影响（FE）·针对产品需求分析</th>
              <th className="min-w-[72px]">
                严重度 (S)
                <SodSHelp />
              </th>
              <th className="min-w-[160px]">失效模式（FM）·针对模块需求分析</th>
              <th className="min-w-[160px]">失效原因（FC）·针对零件需求分析</th>
              <th className="min-w-[140px]">当前预防控制措施</th>
              <th className="min-w-[72px]">
                频度 (O)·针对失效模式/失效原因
                <SodOHelp />
              </th>
              <th className="min-w-[140px]">当前探测控制措施</th>
              <th className="min-w-[72px]">
                探测度 (D)
                <SodDHelp />
              </th>
              <th className="min-w-[88px]">DFMEA 措施优先级</th>
              <th className="min-w-[140px]">DFMEA预防措施</th>
              <th className="min-w-[140px]">DFMEA探测措施</th>
              <th className="min-w-[88px]">责任人</th>
              <th className="min-w-[110px]">目标完成日期</th>
              <th className="min-w-[88px]">状态</th>
              <th className="min-w-[110px]">实际完成日期</th>
              <th className="min-w-[64px]">严重度 (S)</th>
              <th className="min-w-[64px]">频度 (O)</th>
              <th className="min-w-[64px]">探测度 (D)</th>
              <th className="min-w-[88px]">措施优先级</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 ? (
              <tr>
                <td colSpan={25} className="py-10 text-center text-slate-400">
                  暂无拆解路径。请先在结构树或需求模块完成产品 → 模块 → 零件拆解。
                </td>
              </tr>
            ) : (
              grouped.map(({ record, product, module, part }) => {
                const bom = record.bomItemId ? bomItems.find((b) => b.id === record.bomItemId) : undefined
                const fe = record.failureEffect ?? ''
                const fm = record.failureMode ?? ''
                const fc = record.failureCause ?? ''
                const ap = scoreAp(record.severity, record.occurrence, record.detection)
                const ap2 = scoreAp(record.severityAfter, record.occurrenceAfter, record.detectionAfter)
                return (
                  <tr key={record.id}>
                    <td>
                      <StructureSelect
                        value={bom ? project.name : ''}
                        options={productOptions}
                        placeholder="选择产品名称"
                        onChange={(v) => {
                          if (!v) {
                            applyBom(record.id, undefined)
                            return
                          }
                          applyBom(record.id, bom?.id ?? bomItems[0]?.id)
                        }}
                      />
                    </td>
                    <td>
                      <StructureSelect
                        value={bom?.moduleGroup ?? ''}
                        options={moduleOptions}
                        placeholder="选择所属模组"
                        onChange={(v) => {
                          if (!v) {
                            applyBom(record.id, undefined)
                            return
                          }
                          applyBom(record.id, pickByModule(v, bom))
                        }}
                      />
                    </td>
                    <td>
                      <StructureSelect
                        value={bom ? String(bom.id) : ''}
                        options={partOptions}
                        placeholder="选择零件名称"
                        onChange={(v) => applyBom(record.id, v ? Number(v) : undefined)}
                      />
                    </td>
                    <td>
                      <CellText value={displayReq(product)} placeholder="产品需求" onCommit={(v) => patchReq(product?.id, v)} />
                    </td>
                    <td>
                      <CellText value={displayReq(module)} placeholder="模块需求" onCommit={(v) => patchReq(module?.id, v)} />
                    </td>
                    <td>
                      <CellText value={displayReq(part)} placeholder="零件需求" onCommit={(v) => patchReq(part?.id, v)} />
                    </td>
                    <td>
                      <CellText
                        value={fe}
                        placeholder="针对该产品需求填写失效影响"
                        onCommit={(v) => setDfmeaRecordAnalysis(record.id, 'failureEffect', product?.id, v)}
                      />
                    </td>
                    <td>
                      <ScoreBtn
                        value={record.severity}
                        kind="S"
                        onOpen={() => setWiz({ kind: 'S', recordId: record.id, field: 'severity' })}
                      />
                    </td>
                    <td>
                      <CellText
                        value={fm}
                        placeholder="针对该模块需求填写失效模式"
                        onCommit={(v) => setDfmeaRecordAnalysis(record.id, 'failureMode', module?.id, v)}
                      />
                    </td>
                    <td>
                      <CellText
                        value={fc}
                        placeholder="针对该零件需求填写失效原因"
                        onCommit={(v) => setDfmeaRecordAnalysis(record.id, 'failureCause', part?.id, v)}
                      />
                    </td>
                    <td>
                      <CellText
                        value={record.preventionControl ?? ''}
                        placeholder="预防控制"
                        onCommit={(v) => patchRec(record.id, { preventionControl: v })}
                      />
                    </td>
                    <td>
                      <ScoreBtn
                        value={record.occurrence}
                        kind="O"
                        onOpen={() => setWiz({ kind: 'O', recordId: record.id, field: 'occurrence' })}
                      />
                    </td>
                    <td>
                      <CellText
                        value={record.detectionControl ?? ''}
                        placeholder="探测控制"
                        onCommit={(v) => patchRec(record.id, { detectionControl: v })}
                      />
                    </td>
                    <td>
                      <ScoreBtn
                        value={record.detection}
                        kind="D"
                        onOpen={() => setWiz({ kind: 'D', recordId: record.id, field: 'detection' })}
                      />
                    </td>
                    <td>
                      <span className={cn('rounded px-1.5 py-0.5 text-[12px] font-semibold', apClass(ap))}>{ap ?? '—'}</span>
                    </td>
                    <td>
                      <CellText
                        value={record.optPrevention ?? ''}
                        placeholder="优化预防措施"
                        onCommit={(v) => patchRec(record.id, { optPrevention: v })}
                      />
                    </td>
                    <td>
                      <CellText
                        value={record.optDetection ?? ''}
                        placeholder="优化探测措施"
                        onCommit={(v) => patchRec(record.id, { optDetection: v })}
                      />
                    </td>
                    <td>
                      <CellText value={record.owner ?? ''} placeholder="责任人" onCommit={(v) => patchRec(record.id, { owner: v })} />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="h-7 w-[110px] rounded border px-1 text-[12px]"
                        value={record.targetDate ?? ''}
                        onChange={(e) => patchRec(record.id, { targetDate: e.target.value || undefined })}
                      />
                    </td>
                    <td>
                      <select
                        className="h-7 rounded border px-1 text-[12px]"
                        value={record.actionStatus ?? '未开始'}
                        onChange={(e) => patchRec(record.id, { actionStatus: e.target.value as DfmeaRecord['actionStatus'] })}
                      >
                        {DFMEA_ACTION_STATUS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        className="h-7 w-[110px] rounded border px-1 text-[12px]"
                        value={record.actualDate ?? ''}
                        onChange={(e) => patchRec(record.id, { actualDate: e.target.value || undefined })}
                      />
                    </td>
                    <td>
                      <ScoreBtn
                        value={record.severityAfter}
                        kind="S"
                        onOpen={() => setWiz({ kind: 'S', recordId: record.id, field: 'severityAfter' })}
                      />
                    </td>
                    <td>
                      <ScoreBtn
                        value={record.occurrenceAfter}
                        kind="O"
                        onOpen={() => setWiz({ kind: 'O', recordId: record.id, field: 'occurrenceAfter' })}
                      />
                    </td>
                    <td>
                      <ScoreBtn
                        value={record.detectionAfter}
                        kind="D"
                        onOpen={() => setWiz({ kind: 'D', recordId: record.id, field: 'detectionAfter' })}
                      />
                    </td>
                    <td>
                      <span className={cn('rounded px-1.5 py-0.5 text-[12px] font-semibold', apClass(ap2))}>{ap2 ?? '—'}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {wiz ? (
        <SodWizard
          open
          kind={wiz.kind}
          onOpenChange={(v) => !v && setWiz(null)}
          onPick={(score) => {
            patchRec(wiz.recordId, { [wiz.field]: score })
            setWiz(null)
          }}
        />
      ) : null}
    </div>
  )
}
