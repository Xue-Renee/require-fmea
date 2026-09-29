import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TR_STATES } from '@/lib/constants'
import { evidenceSummary, trDotClass, validateTrEvidence } from '@/lib/tr'
import { cn } from '@/lib/utils'
import type { TrEvidence, TrEvidenceKind, TrState } from '@/types'
import { Link2, Paperclip } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

export function TrAssessCell({
  label,
  value,
  evidence,
  onCommit,
}: {
  label: string
  value: TrState
  evidence?: TrEvidence
  onCommit: (value: TrState, evidence?: TrEvidence) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<TrState>(value)
  const [draft, setDraft] = useState<TrEvidence>(evidence ?? {})
  const fileRef = useRef<HTMLInputElement>(null)

  const openFor = (next: TrState, ev = evidence) => {
    setPending(next)
    setDraft(ev ?? {})
    setOpen(true)
  }

  const confirm = () => {
    const err = validateTrEvidence(pending, draft)
    if (err) {
      toast.error(err)
      return
    }
    onCommit(pending, pending === '未评估' || pending === '否' ? undefined : draft)
    setOpen(false)
  }

  const summary = evidenceSummary(value, evidence)
  const needDetail = value === '是' || value === '不涉及'

  return (
    <>
      <div className="flex items-center gap-1">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', trDotClass(value))} />
        <select
          className="h-6 min-w-[76px] rounded border border-slate-200 bg-white px-1 text-[11px]"
          value={value}
          onChange={(e) => {
            const next = e.target.value as TrState
            if (next === '是' || next === '不涉及') openFor(next)
            else onCommit(next, undefined)
          }}
          aria-label={label}
        >
          {TR_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {needDetail ? (
          <button
            type="button"
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-primary"
            title={summary}
            onClick={() => openFor(value)}
          >
            {value === '是' ? <Paperclip className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
      {summary && needDetail ? (
        <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-slate-400" title={summary}>
          {summary}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {label} · {pending}
            </DialogTitle>
          </DialogHeader>
          {pending === '是' ? (
            <div className="space-y-3">
              <p className="text-[12.5px] text-slate-600">判定为「是」时必须提交证据：上传附件，或链接到 PLM 文档。</p>
              <div className="flex gap-3 text-[13px]">
                {(['attachment', 'plm'] as TrEvidenceKind[]).map((kind) => (
                  <label key={kind} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`tr-kind-${label}`}
                      checked={(draft.kind ?? 'attachment') === kind}
                      onChange={() => setDraft((d) => ({ ...d, kind }))}
                    />
                    {kind === 'attachment' ? '附件' : 'PLM 文档链接'}
                  </label>
                ))}
              </div>
              {(draft.kind ?? 'attachment') === 'attachment' ? (
                <div className="grid gap-1">
                  <Label>上传附件</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    className="text-[12px]"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 1.5 * 1024 * 1024) {
                        toast.error('附件超过 1.5MB，请改用 PLM 链接')
                        e.target.value = ''
                        return
                      }
                      const reader = new FileReader()
                      reader.onload = () => {
                        setDraft((d) => ({
                          ...d,
                          kind: 'attachment',
                          name: file.name,
                          url: String(reader.result ?? ''),
                          naReason: undefined,
                        }))
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                  {draft.kind === 'attachment' && draft.name ? (
                    <div className="text-[12px] text-slate-500">已选：{draft.name}</div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-2">
                  <div className="grid gap-1">
                    <Label>PLM 文档链接</Label>
                    <Input
                      value={draft.url ?? ''}
                      placeholder="https://plm.example.com/doc/..."
                      onChange={(e) => setDraft((d) => ({ ...d, kind: 'plm', url: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>文档名称 / 编号</Label>
                    <Input
                      value={draft.name ?? ''}
                      placeholder="如：CAM3D-TR3-报告-001"
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-1">
              <p className="text-[12.5px] text-slate-600">判定为「不涉及」时必须写明原因。</p>
              <Label>不涉及原因</Label>
              <Textarea
                value={draft.naReason ?? ''}
                placeholder="说明本需求为何不纳入该 TR 关口"
                onChange={(e) => setDraft((d) => ({ ...d, naReason: e.target.value, kind: undefined, url: undefined }))}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={confirm}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
