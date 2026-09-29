import { TR_GATES } from '@/lib/constants'
import type { Requirement, TrEvidence, TrState } from '@/types'

export type TrGateKey = (typeof TR_GATES)[number]['key']

export function trDotClass(value: TrState) {
  if (value === '是') return 'bg-emerald-500'
  if (value === '否') return 'bg-red-500'
  if (value === '不涉及') return 'bg-slate-400'
  return 'bg-orange-500'
}

export function validateTrEvidence(value: TrState, ev?: TrEvidence | null): string | null {
  if (value === '是') {
    const hasPlm = ev?.kind === 'plm' && !!ev.url?.trim()
    const hasFile = ev?.kind === 'attachment' && !!(ev.url || ev.name)
    if (hasPlm || hasFile) return null
    return '选择「是」时必须提交证据：上传附件，或填写 PLM 文档链接'
  }
  if (value === '不涉及') {
    if (ev?.naReason?.trim()) return null
    return '选择「不涉及」时必须写明不涉及的原因'
  }
  return null
}

export function evidenceSummary(value: TrState, ev?: TrEvidence | null) {
  if (value === '是') {
    if (ev?.kind === 'plm' && ev.url) return ev.name ? `PLM：${ev.name}` : '已链到 PLM'
    if (ev?.kind === 'attachment' && (ev.name || ev.url)) return ev.name ? `附件：${ev.name}` : '已上传附件'
    return '缺证据'
  }
  if (value === '不涉及') return ev?.naReason?.trim() ? ev.naReason.trim() : '缺原因'
  return ''
}

export function trValueOf(req: Requirement, key: TrGateKey): TrState {
  const gate = TR_GATES.find((g) => g.key === key)!
  return req[gate.valueField]
}

export function trEvidenceOf(req: Requirement, key: TrGateKey): TrEvidence | undefined {
  const gate = TR_GATES.find((g) => g.key === key)!
  return req[gate.evidenceField]
}

export function validateAllTr(req: Pick<Requirement, (typeof TR_GATES)[number]['valueField'] | (typeof TR_GATES)[number]['evidenceField']>) {
  for (const gate of TR_GATES) {
    const err = validateTrEvidence(req[gate.valueField], req[gate.evidenceField])
    if (err) return `${gate.label}：${err}`
  }
  return null
}
