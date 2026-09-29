import { AcceptanceHelp, CharacteristicHelp, ImportanceHelp, PartAcceptanceHelp, RiskHelp, TrHelp } from '@/components/FieldHelp'
import { TrAssessCell } from '@/components/requirements/TrAssessCell'
import { MultiSelect } from '@/components/MultiSelect'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  CHARACTERISTIC_SYMBOLS,
  DELIVERY_PHASES,
  IMPORTANCE_LEVELS,
  REQ_LEVELS,
  RISK_LEVELS,
  TR_GATES,
} from '@/lib/constants'
import { childrenOf, descendantIds, parentLevelOf, previewReqNo, reqLevel } from '@/lib/hierarchy'
import { formatBomLabel, createRequirement, updateRequirement, type RequirementDraft } from '@/lib/store'
import { validateAllTr } from '@/lib/tr'
import { splitMulti } from '@/lib/utils'
import type { BomItem, OptionItem, Project, ReqLevel, Requirement } from '@/types'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

function emptyDraft(): RequirementDraft {
  return {
    category: '其他',
    feature: '',
    spec: '',
    specDescription: '',
    source: '',
    characteristicSymbol: '一般',
    importance: 'Should',
    acceptanceMethod: '型式试验',
    riskLevel: '低',
    module: '',
    discipline: '',
    deliveryPhase: 'EVT',
    tr3DesignCovered: '未评估',
    tr4Verified: '未评估',
    tr4aPassed: '未评估',
    tr5Accepted: '未评估',
    remark: '',
  }
}

function fromReq(req: Requirement): RequirementDraft {
  return {
    category: req.category,
    feature: req.feature ?? '',
    spec: req.spec,
    specDescription: req.specDescription ?? '',
    source: req.source ?? '',
    characteristicSymbol: req.characteristicSymbol,
    importance: req.importance,
    acceptanceMethod: req.acceptanceMethod,
    riskLevel: req.riskLevel,
    module: req.module ?? '',
    discipline: req.discipline ?? '',
    deliveryPhase: req.deliveryPhase,
    tr3DesignCovered: req.tr3DesignCovered,
    tr4Verified: req.tr4Verified,
    tr4aPassed: req.tr4aPassed,
    tr5Accepted: req.tr5Accepted,
    tr3Evidence: req.tr3Evidence,
    tr4Evidence: req.tr4Evidence,
    tr4aEvidence: req.tr4aEvidence,
    tr5Evidence: req.tr5Evidence,
    remark: req.remark ?? '',
    bomItemId: req.bomItemId,
  }
}

export function RequirementFormDialog({
  open,
  onOpenChange,
  project,
  editing,
  categories,
  modules,
  disciplines,
  acceptanceMethods,
  partAcceptanceMethods,
  allReqs,
  bomItems,
  initialLevel,
  initialParentId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: Project
  editing: Requirement | null
  categories: string[]
  modules: OptionItem[]
  disciplines: OptionItem[]
  acceptanceMethods: string[]
  partAcceptanceMethods: string[]
  allReqs: Requirement[]
  bomItems: BomItem[]
  initialLevel?: ReqLevel
  initialParentId?: number
}) {
  const [draft, setDraft] = useState<RequirementDraft>(emptyDraft)
  const [level, setLevel] = useState<ReqLevel>('产品需求')
  const [parentId, setParentId] = useState<number | undefined>(undefined)
  const hasChildren = editing ? childrenOf(editing.id, allReqs).length > 0 : false
  const blockedIds = useMemo(() => {
    if (!editing) return new Set<number>()
    return new Set([editing.id, ...descendantIds(editing.id, allReqs)])
  }, [editing, allReqs])
  const parentCandidates = allReqs.filter((r) => reqLevel(r) === (parentLevelOf(level) ?? '') && !blockedIds.has(r.id))
  const parent = parentId ? allReqs.find((r) => r.id === parentId) : undefined
  const previewNo = editing?.reqNo ?? previewReqNo(project.code, allReqs, level, parent)
  const isProduct = level === '产品需求'
  const isPart = level === '零件需求'
  const partAcceptanceOptions = useMemo(
    () => partAcceptanceMethods.map((v) => ({ value: v, raw: v })),
    [partAcceptanceMethods],
  )

  useEffect(() => {
    if (!open) return
    const nextLevel = editing ? reqLevel(editing) : (initialLevel ?? '产品需求')
    const nextParentId = editing ? editing.parentId : initialParentId
    const nextParent = nextParentId ? allReqs.find((r) => r.id === nextParentId) : undefined
    if (editing) {
      setDraft(fromReq(editing))
    } else {
      setDraft({
        ...emptyDraft(),
        category: nextParent?.category ?? (categories.includes('其他') ? '其他' : (categories[0] ?? '其他')),
        acceptanceMethod: nextLevel === '零件需求' ? '' : '型式试验',
      })
    }
    setLevel(nextLevel)
    setParentId(nextParentId)
  }, [open, editing, initialLevel, initialParentId, categories, allReqs])

  const set = <K extends keyof RequirementDraft>(key: K, value: RequirementDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const changeParent = (nextId: number | undefined) => {
    setParentId(nextId)
    if (isPart || !nextId) return
    const nextParent = allReqs.find((r) => r.id === nextId)
    if (nextParent?.category) set('category', nextParent.category)
  }

  const changeLevel = (next: ReqLevel) => {
    setLevel(next)
    if (next === '产品需求') setParentId(undefined)
    else if (parent && reqLevel(parent) !== parentLevelOf(next)) {
      setParentId(undefined)
    } else if (parent && next !== '零件需求') {
      set('category', parent.category)
    }
    setDraft((d) => {
      const methods = splitMulti(d.acceptanceMethod)
      const isPartMethod = methods.length > 0 && methods.every((m) => partAcceptanceMethods.includes(m))
      if (next === '零件需求') {
        return { ...d, acceptanceMethod: isPartMethod ? d.acceptanceMethod : '' }
      }
      return {
        ...d,
        acceptanceMethod: isPartMethod || !d.acceptanceMethod ? '型式试验' : d.acceptanceMethod,
        bomItemId: undefined,
      }
    })
  }

  const save = () => {
    if (!draft.spec.trim()) {
      toast.error('请填写需求规格')
      return
    }
    if (level !== '产品需求' && !parentId) {
      toast.error(`请选择${parentLevelOf(level)}作为父需求`)
      return
    }
    if (isPart && !draft.bomItemId) {
      toast.error(bomItems.length === 0 ? '请先在「涉及零件」中维护零件，再创建零件需求' : '请选择关联的BOM零件')
      return
    }
    if (isPart && splitMulti(draft.acceptanceMethod).length === 0) {
      toast.error('请选择验收方式')
      return
    }
    const trErr = validateAllTr(draft)
    if (trErr) {
      toast.error(trErr)
      return
    }
    const payload = {
      ...draft,
      level,
      parentId: level === '产品需求' ? undefined : parentId,
      bomItemId: isPart ? draft.bomItemId : undefined,
    }
    try {
      if (editing) {
        updateRequirement(editing.id, payload)
        toast.success(`已保存 ${editing.reqNo}`)
      } else {
        const created = createRequirement(project.id, draft, payload)
        toast.success(`已新建需求 ${created.reqNo}`)
      }
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? '编辑需求' : '新建需求'} {previewNo}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="col-span-2 rounded border border-sky-100 bg-sky-50/80 px-2.5 py-1.5 text-[12px] leading-snug text-slate-600">
            「需求重要度」及之前的字段（含需求重要度）由产品经理填写；之后的字段由系统工程师填写。
          </div>
          <div className="col-span-2 text-[12px] font-semibold text-sky-800">产品经理填写</div>
          <div className="grid gap-1">
            <Label>需求层级</Label>
            <Select value={level} onValueChange={(v) => changeLevel(v as ReqLevel)} disabled={hasChildren}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQ_LEVELS.map((lv) => (
                  <SelectItem key={lv} value={lv}>
                    {lv}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasChildren ? <div className="text-[11px] text-slate-400">已有子需求，不可变更层级</div> : null}
          </div>
          <div className="grid gap-1">
            <Label>
              父需求{level !== '产品需求' ? <span className="text-red-500"> *</span> : null}
            </Label>
            <Select
              value={parentId ? String(parentId) : 'none'}
              onValueChange={(v) => changeParent(v === 'none' ? undefined : Number(v))}
              disabled={level === '产品需求'}
            >
              <SelectTrigger>
                <SelectValue placeholder={level === '产品需求' ? '产品需求无父级' : '选择父需求'} />
              </SelectTrigger>
              <SelectContent>
                {level === '产品需求' ? (
                  <SelectItem value="none">无</SelectItem>
                ) : parentCandidates.length === 0 ? (
                  <SelectItem value="none" disabled>
                    暂无可用{parentLevelOf(level)}
                  </SelectItem>
                ) : (
                  parentCandidates.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.reqNo} {r.spec}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {isPart ? (
            <div className="col-span-2 grid gap-1">
              <Label>
                关联BOM零件 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={draft.bomItemId ? String(draft.bomItemId) : 'none'}
                onValueChange={(v) => set('bomItemId', v === 'none' ? undefined : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={bomItems.length === 0 ? '暂无BOM零件' : '选择BOM中的具体零件'} />
                </SelectTrigger>
                <SelectContent>
                  {bomItems.length === 0 ? (
                    <SelectItem value="none" disabled>
                      请先在「涉及零件」中维护零件
                    </SelectItem>
                  ) : (
                    bomItems.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {formatBomLabel(item)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-1">
              <Label>
                需求分类 <span className="text-red-500">*</span>
              </Label>
              <Select value={draft.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isProduct && parent ? (
                <div className="text-[11px] text-slate-400">默认与父需求「{parent.category}」一致，可修改</div>
              ) : null}
            </div>
          )}
          <div className={isPart ? 'col-span-2 grid gap-1' : 'grid gap-1'}>
            <Label>需求特性</Label>
            <Input value={draft.feature ?? ''} onChange={(e) => set('feature', e.target.value)} placeholder="如：测量精度" />
          </div>
          <div className="col-span-2 grid gap-1">
            <Label>
              需求规格 <span className="text-red-500">*</span>
            </Label>
            <Input value={draft.spec} onChange={(e) => set('spec', e.target.value)} placeholder="一句话指标" />
          </div>
          <div className="col-span-2 grid gap-1">
            <Label>需求规格描述</Label>
            <Textarea value={draft.specDescription ?? ''} onChange={(e) => set('specDescription', e.target.value)} placeholder="测试条件 / 目标值 / 底线值" />
          </div>
          {isProduct ? (
            <div className="grid gap-1">
              <Label>需求依据/来源</Label>
              <Input value={draft.source ?? ''} onChange={(e) => set('source', e.target.value)} />
            </div>
          ) : null}
          <div className="grid gap-1">
            <Label className="flex items-center">
              特性符号 <CharacteristicHelp />
            </Label>
            <Select value={draft.characteristicSymbol} onValueChange={(v) => set('characteristicSymbol', v as RequirementDraft['characteristicSymbol'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHARACTERISTIC_SYMBOLS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isProduct ? (
            <div className="grid gap-1">
              <Label className="flex items-center">
                需求重要度 <ImportanceHelp />
              </Label>
              <Select value={draft.importance} onValueChange={(v) => set('importance', v as RequirementDraft['importance'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTANCE_LEVELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="col-span-2 border-t pt-2 text-[12px] font-semibold text-emerald-800">系统工程师填写</div>
          <div className={isPart ? 'col-span-2 grid gap-1' : 'grid gap-1'}>
            <Label className="flex items-center">
              验收方式 {isPart ? <PartAcceptanceHelp /> : <AcceptanceHelp />}
              {isPart ? <span className="ml-1 text-red-500">*</span> : null}
            </Label>
            {isPart ? (
              <MultiSelect
                options={partAcceptanceOptions}
                value={splitMulti(draft.acceptanceMethod)}
                onChange={(v) => set('acceptanceMethod', v.join(','))}
                placeholder="可多选：供应商测试、我司测试、检验等"
              />
            ) : (
              <Select value={draft.acceptanceMethod} onValueChange={(v) => set('acceptanceMethod', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {acceptanceMethods.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-1">
            <Label className="flex items-center">
              设计实现难度 <RiskHelp />
            </Label>
            <Select value={draft.riskLevel} onValueChange={(v) => set('riskLevel', v as RequirementDraft['riskLevel'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>交付阶段</Label>
            <Select value={draft.deliveryPhase} onValueChange={(v) => set('deliveryPhase', v as RequirementDraft['deliveryPhase'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_PHASES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isProduct ? (
            <div className="col-span-2 grid gap-1">
              <Label>涉及模块</Label>
              <MultiSelect options={modules} value={splitMulti(draft.module)} onChange={(v) => set('module', v.join(','))} />
            </div>
          ) : null}
          <div className="col-span-2 grid gap-1">
            <Label>涉及专业</Label>
            <MultiSelect options={disciplines} value={splitMulti(draft.discipline)} onChange={(v) => set('discipline', v.join(','))} />
          </div>
          <div className="col-span-2">
            <Label className="mb-1.5 inline-flex items-center">
              TR 评估
              <TrHelp />
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {TR_GATES.map((gate) => (
                <div key={gate.key} className="rounded-md border px-2 py-2">
                  <div className="mb-1 text-[12px] font-medium text-slate-600">{gate.label}</div>
                  <TrAssessCell
                    label={gate.label}
                    value={draft[gate.valueField]}
                    evidence={draft[gate.evidenceField]}
                    onCommit={(v, ev) =>
                      setDraft((d) => ({
                        ...d,
                        [gate.valueField]: v,
                        [gate.evidenceField]: ev,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-2 grid gap-1">
            <Label>通用要求/备注</Label>
            <Textarea value={draft.remark ?? ''} onChange={(e) => set('remark', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={save}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
