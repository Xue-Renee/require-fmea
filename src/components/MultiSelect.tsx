import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, joinDunhao } from '@/lib/utils'
import type { OptionItem } from '@/types'
import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = '请选择',
  disabled,
}: {
  options: OptionItem[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  const ordered = useMemo(() => {
    const extra: OptionItem[] = value.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, raw: v }))
    return [...options, ...extra]
  }, [options, value])

  const label = joinDunhao(ordered.filter((o) => value.includes(o.value)).map((o) => o.value))

  const toggle = (v: string, checked: boolean) => {
    const set = new Set(value)
    if (checked) set.add(v)
    else set.delete(v)
    onChange(ordered.filter((o) => set.has(o.value)).map((o) => o.value))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-2.5 text-left text-[13px] shadow-sm hover:bg-slate-50 disabled:opacity-50',
            !label && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{label || placeholder}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
        <div className="max-h-64 overflow-auto">
          {ordered.map((opt) => {
            const checked = value.includes(opt.value)
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-slate-50"
              >
                <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(c) => toggle(opt.value, c === true)} />
                <span>
                  <span className="block text-[13px] text-slate-800">{opt.value}</span>
                  {opt.hint ? <span className="block text-[11px] leading-snug text-slate-400">{opt.hint}</span> : null}
                </span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
