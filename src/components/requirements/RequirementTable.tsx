import { AcceptanceHelp, CharacteristicHelp, ImportanceHelp, RiskHelp, TrHelp } from '@/components/FieldHelp'
import { CharacteristicBadge, ImportanceBadge, LevelBadge, RiskBadge, StatusBadge } from '@/components/StatusBadges'
import { TrAssessCell } from '@/components/requirements/TrAssessCell'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TR_GATES } from '@/lib/constants'
import { descendantIds, reqLevel } from '@/lib/hierarchy'
import { COLUMN_MAP, colWidthOf, columnOwner, ownerSpans, type ColKey } from '@/lib/listView'
import { deleteRequirement, formatBomLabel, relatedReqNos, updateRequirement } from '@/lib/store'
import { clamp, cn, displayMulti } from '@/lib/utils'
import type { Database, Requirement } from '@/types'
import { FlaskConical, GitFork, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

function EmptyCell() {
  return <span className="text-slate-300">—</span>
}

function OptionalCell({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <>{children}</> : <EmptyCell />
}

function headerLabel(key: ColKey) {
  if (key === 'characteristicSymbol') {
    return (
      <span className="inline-flex items-center">
        特性符号
        <CharacteristicHelp />
      </span>
    )
  }
  if (key === 'importance') {
    return (
      <span className="inline-flex items-center">
        需求重要度
        <ImportanceHelp />
      </span>
    )
  }
  if (key === 'acceptanceMethod') {
    return (
      <span className="inline-flex items-center">
        验收方式
        <AcceptanceHelp />
      </span>
    )
  }
  if (key === 'riskLevel') {
    return (
      <span className="inline-flex items-center whitespace-normal">
        设计实现难度
        <RiskHelp />
      </span>
    )
  }
  if (key === 'tr3' || key === 'tr4' || key === 'tr4a' || key === 'tr5') {
    const gate = TR_GATES.find((g) => g.key === key)
    return (
      <span className="inline-flex max-w-[140px] items-start whitespace-normal text-left leading-tight">
        {gate?.label ?? key}
        <TrHelp />
      </span>
    )
  }
  return COLUMN_MAP[key]?.label ?? key
}

export function RequirementTable({
  db,
  rows,
  columns,
  colWidths,
  onColWidthsChange,
  onEdit,
  onOpenLinks,
  onDecompose,
  onSubmitTest,
  testCounts,
}: {
  db: Database
  rows: Requirement[]
  columns: ColKey[]
  colWidths?: Partial<Record<ColKey, number>>
  onColWidthsChange?: (next: Partial<Record<ColKey, number>>) => void
  onEdit: (req: Requirement) => void
  onOpenLinks: (req: Requirement) => void
  onDecompose?: (req: Requirement) => void
  onSubmitTest?: (req: Requirement) => void
  testCounts?: Map<number, number>
}) {
  const [deleting, setDeleting] = useState<Requirement | null>(null)
  const [liveWidths, setLiveWidths] = useState<Partial<Record<ColKey, number>> | null>(null)
  const drag = useRef<{ key: ColKey; startX: number; startW: number } | null>(null)
  const liveRef = useRef<Partial<Record<ColKey, number>>>({})

  const widthOf = (key: ColKey) => colWidthOf(key, liveWidths ?? colWidths)

  const resetWidth = (key: ColKey) => {
    if (!onColWidthsChange) return
    const next = { ...(liveWidths ?? colWidths ?? {}) }
    delete next[key]
    liveRef.current = next
    setLiveWidths(null)
    onColWidthsChange(next)
  }

  const onResizeStart = (key: ColKey, e: MouseEvent) => {
    if (e.button !== 0) return
    if (e.detail > 1) {
      e.preventDefault()
      e.stopPropagation()
      resetWidth(key)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const start = { ...(colWidths ?? {}) }
    liveRef.current = start
    drag.current = { key, startX: e.clientX, startW: widthOf(key) }
    setLiveWidths(start)
    const move = (ev: globalThis.MouseEvent) => {
      const cur = drag.current
      if (!cur) return
      const next = clamp(cur.startW + ev.clientX - cur.startX, 64, 800)
      liveRef.current = { ...liveRef.current, [cur.key]: next }
      setLiveWidths(liveRef.current)
    }
    const up = () => {
      drag.current = null
      onColWidthsChange?.(liveRef.current)
      setLiveWidths(null)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-md border border-dashed bg-white text-sm text-slate-500">
        暂无匹配的需求条目。可清空筛选，或点击「新建需求」开始编制
      </div>
    )
  }

  const renderCell = (key: ColKey, req: Requirement) => {
    const related = relatedReqNos(req, db)
    const parent = req.parentId ? db.requirements.find((r) => r.id === req.parentId) : undefined
    const bom = req.bomItemId ? db.bomItems?.find((b) => b.id === req.bomItemId) : undefined
    const level = reqLevel(req)
    const canDecompose = level !== '零件需求'
    const isProduct = level === '产品需求'
    const isPart = level === '零件需求'
    const pad = level === '模块需求' ? 14 : level === '零件需求' ? 28 : 0

    switch (key) {
      case 'reqNo':
        return (
          <span className="font-medium text-slate-800" style={{ paddingLeft: pad }}>
            {req.reqNo}
          </span>
        )
      case 'level':
        return <LevelBadge value={level} />
      case 'parent':
        return parent ? (
          <button type="button" className="text-primary hover:underline" onClick={() => onEdit(parent)}>
            {parent.reqNo}
          </button>
        ) : (
          <EmptyCell />
        )
      case 'bom':
        return bom ? <span title={formatBomLabel(bom)}>{`${bom.partNo} ${bom.name}`}</span> : <EmptyCell />
      case 'category':
        return <OptionalCell show={!isPart}>{req.category}</OptionalCell>
      case 'feature':
        return req.feature || <EmptyCell />
      case 'spec':
        return (
          <div className="min-w-[220px] max-w-[360px] whitespace-normal">
            <button type="button" className="text-left text-primary hover:underline" onClick={() => onEdit(req)}>
              {req.spec}
            </button>
            {req.specDescription ? (
              <div className="mt-0.5 truncate text-[11px] text-slate-400" title={req.specDescription}>
                {req.specDescription}
              </div>
            ) : null}
          </div>
        )
      case 'specDescription':
        return req.specDescription || <EmptyCell />
      case 'source':
        return (
          <span className="max-w-[180px] truncate" title={req.source}>
            <OptionalCell show={isProduct}>{req.source}</OptionalCell>
          </span>
        )
      case 'characteristicSymbol':
        return <CharacteristicBadge value={req.characteristicSymbol} />
      case 'importance':
        return (
          <OptionalCell show={isProduct}>
            <ImportanceBadge value={req.importance} />
          </OptionalCell>
        )
      case 'related':
        return related.length === 0 ? (
          <button type="button" className="text-primary hover:underline" onClick={() => onOpenLinks(req)}>
            🔗 添加
          </button>
        ) : (
          <div className="flex flex-wrap gap-1">
            {related.map((no) => (
              <button
                key={no}
                type="button"
                className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0 text-[11px] text-sky-700"
                onClick={() => onOpenLinks(req)}
              >
                {no}
              </button>
            ))}
          </div>
        )
      case 'acceptanceMethod':
        return displayMulti(req.acceptanceMethod) || req.acceptanceMethod || <EmptyCell />
      case 'riskLevel':
        return <RiskBadge value={req.riskLevel} />
      case 'module':
        return <OptionalCell show={isProduct}>{displayMulti(req.module)}</OptionalCell>
      case 'discipline':
        return displayMulti(req.discipline) || <EmptyCell />
      case 'deliveryPhase':
        return req.deliveryPhase
      case 'tr3':
        return (
          <TrAssessCell
            label="TR3设计是否已包含实现"
            value={req.tr3DesignCovered}
            evidence={req.tr3Evidence}
            onCommit={(v, ev) => {
              try {
                updateRequirement(req.id, { tr3DesignCovered: v, tr3Evidence: ev })
              } catch (e) {
                toast.error(e instanceof Error ? e.message : '保存失败')
              }
            }}
          />
        )
      case 'tr4':
        return (
          <TrAssessCell
            label="TR4验证是否通过"
            value={req.tr4Verified}
            evidence={req.tr4Evidence}
            onCommit={(v, ev) => {
              try {
                updateRequirement(req.id, { tr4Verified: v, tr4Evidence: ev })
              } catch (e) {
                toast.error(e instanceof Error ? e.message : '保存失败')
              }
            }}
          />
        )
      case 'tr4a':
        return (
          <TrAssessCell
            label="TR4A需求是否通过"
            value={req.tr4aPassed}
            evidence={req.tr4aEvidence}
            onCommit={(v, ev) => {
              try {
                updateRequirement(req.id, { tr4aPassed: v, tr4aEvidence: ev })
              } catch (e) {
                toast.error(e instanceof Error ? e.message : '保存失败')
              }
            }}
          />
        )
      case 'tr5':
        return (
          <TrAssessCell
            label="TR5需求验收是否通过"
            value={req.tr5Accepted}
            evidence={req.tr5Evidence}
            onCommit={(v, ev) => {
              try {
                updateRequirement(req.id, { tr5Accepted: v, tr5Evidence: ev })
              } catch (e) {
                toast.error(e instanceof Error ? e.message : '保存失败')
              }
            }}
          />
        )
      case 'status':
        return <StatusBadge value={req.status} />
      case 'remark':
        return req.remark || <EmptyCell />
      case 'actions':
        return (
          <div className="flex items-center gap-1">
            {canDecompose && onDecompose ? (
              <button
                type="button"
                className="rounded p-1 text-slate-500 hover:bg-sky-50 hover:text-primary"
                title="向下拆解"
                onClick={() => onDecompose(req)}
              >
                <GitFork className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {canDecompose && onSubmitTest ? (
              <button
                type="button"
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-slate-500 hover:bg-sky-50 hover:text-primary"
                title="提测"
                onClick={() => onSubmitTest(req)}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                提测{testCounts?.get(req.id) ? `(${testCounts.get(req.id)})` : ''}
              </button>
            ) : null}
            <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => onEdit(req)}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setDeleting(req)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <div className="req-table-wrap">
        <table className="req-table">
          <colgroup>
            {columns.map((key) => (
              <col key={key} style={{ width: widthOf(key) }} />
            ))}
          </colgroup>
          <thead>
            <tr className="req-owner-row">
              {ownerSpans(columns).map((span, i) => (
                <th
                  key={`${span.owner}-${i}`}
                  colSpan={span.count}
                  className={cn(
                    span.owner === 'pm' && 'req-owner-pm',
                    span.owner === 'se' && 'req-owner-se',
                    span.owner === 'none' && 'req-owner-none',
                  )}
                >
                  {span.owner === 'pm' ? '产品经理填写' : span.owner === 'se' ? '系统工程师填写' : ''}
                </th>
              ))}
            </tr>
            <tr className="req-col-row">
              {columns.map((key, idx) => {
                const meta = COLUMN_MAP[key]
                const w = widthOf(key)
                const owner = columnOwner(key)
                const prev = columns[idx - 1]
                const seStart = owner === 'se' && (prev == null || columnOwner(prev) !== 'se')
                return (
                  <th
                    key={key}
                    className={cn('relative', meta?.sticky && 'sticky-col', seStart && 'req-owner-se-start')}
                    style={{ width: w, minWidth: w, maxWidth: w }}
                  >
                    {headerLabel(key)}
                    {onColWidthsChange ? (
                      <span
                        className="req-col-resizer"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`调整${meta?.label ?? ''}列宽`}
                        title="拖动调整列宽，双击恢复默认"
                        onMouseDown={(e) => onResizeStart(key, e)}
                      />
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((req) => {
              const level = reqLevel(req)
              return (
                <tr
                  key={req.id}
                  className={level === '模块需求' ? 'req-row-module' : level === '零件需求' ? 'req-row-part' : undefined}
                >
                  {columns.map((key, idx) => {
                    const w = widthOf(key)
                    const owner = columnOwner(key)
                    const prev = columns[idx - 1]
                    const seStart = owner === 'se' && (prev == null || columnOwner(prev) !== 'se')
                    return (
                      <td
                        key={key}
                        className={cn(
                          COLUMN_MAP[key]?.sticky && 'sticky-col',
                          seStart && 'req-owner-se-start',
                          (key === 'spec' || key === 'specDescription' || key === 'remark' || key === 'source') &&
                            'req-cell-wrap',
                        )}
                        style={{ width: w, minWidth: w, maxWidth: w }}
                      >
                        {renderCell(key, req)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除需求</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `确定删除「${deleting.reqNo}」？${
                    descendantIds(deleting.id, db.requirements).length
                      ? `将同时删除其 ${descendantIds(deleting.id, db.requirements).length} 条子需求，以及相关关联。`
                      : '与其相关的关联将一并删除。'
                  }`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleting) return
                try {
                  deleteRequirement(deleting.id)
                  toast.success(`已删除 ${deleting.reqNo}`)
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : '删除失败')
                }
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
