import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SOD_FLOWS, type SodKind } from '@/lib/dfmea'
import { useState } from 'react'

export function SodWizard({
  open,
  onOpenChange,
  kind,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  kind: SodKind
  onPick: (score: number, note: string) => void
}) {
  const flow = SOD_FLOWS[kind]
  const [stepId, setStepId] = useState(flow.start)
  const [trail, setTrail] = useState<string[]>([])

  const reset = (nextOpen: boolean) => {
    if (nextOpen) {
      setStepId(flow.start)
      setTrail([])
    }
    onOpenChange(nextOpen)
  }

  const step = flow.steps[stepId]
  if (!step) return null

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{flow.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {step.hint ? <p className="text-[12.5px] text-slate-500">{step.hint}</p> : null}
          {trail.length > 0 ? (
            <div className="text-[11px] leading-relaxed text-slate-400">{trail.join(' → ')}</div>
          ) : null}
          <div className="text-[14px] font-medium text-slate-800">{step.question}</div>
          <div className="grid gap-2">
            {step.options.map((opt) => (
              <Button
                key={opt.label}
                variant="secondary"
                className="h-auto justify-start whitespace-normal py-2 text-left"
                onClick={() => {
                  const nextTrail = [...trail, `${step.question} ${opt.label}`]
                  if (opt.score) {
                    onPick(opt.score, opt.note)
                    reset(false)
                    return
                  }
                  if (opt.next) {
                    setTrail(nextTrail)
                    setStepId(opt.next)
                  }
                }}
              >
                <span className="font-semibold text-primary">{opt.label}</span>
                {opt.score ? <span className="ml-auto text-slate-500">{kind} = {opt.score}</span> : null}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          {trail.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                setStepId(flow.start)
                setTrail([])
              }}
            >
              重新判定
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => reset(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
