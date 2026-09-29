import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_TESTERS } from '@/lib/constants'
import { submitForTest } from '@/lib/store'
import { splitMulti } from '@/lib/utils'
import type { Requirement, TestSubmit } from '@/types'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

export function TestSubmitDialog({
  open,
  onOpenChange,
  req,
  history,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  req: Requirement | null
  history: TestSubmit[]
}) {
  const [testers, setTesters] = useState('')
  const [note, setNote] = useState('')
  const count = history.length
  const last = history[0]
  const suggestions = useMemo(() => {
    const fromHist = history.flatMap((h) => h.testers)
    return [...new Set([...DEFAULT_TESTERS, ...fromHist])]
  }, [history])

  const submit = () => {
    if (!req) return
    const names = splitMulti(testers)
    if (names.length === 0) {
      toast.error('请填写测试人员')
      return
    }
    const created = submitForTest(req.id, names, note)
    if (created) {
      toast.success(`已提测 ${req.reqNo}（第 ${count + 1} 次），已通知 ${names.join('、')}`)
      setTesters('')
      setNote('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>提测 {req?.reqNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-[13px]">
          <div className="rounded-md bg-sky-50 px-3 py-2 text-sky-800">
            累计提测 {count} 次
            {last ? `，最近一次 ${new Date(last.createdAt).toLocaleString('zh-CN', { hour12: false })}` : ''}
          </div>
          <div className="grid gap-1">
            <Label>
              测试人员 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={testers}
              placeholder="多人用逗号分隔，如：张三, 李四"
              onChange={(e) => setTesters(e.target.value)}
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border px-2 py-0.5 text-[11px] text-slate-600 hover:border-primary hover:text-primary"
                  onClick={() => {
                    const cur = splitMulti(testers)
                    if (!cur.includes(s)) setTesters([...cur, s].join('、'))
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1">
            <Label>提测说明</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选：测试范围、版本、关注点" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit}>提交并通知</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
