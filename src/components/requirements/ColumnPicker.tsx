import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LIST_COLUMNS, normalizeColumns, type ColKey } from '@/lib/listView'
import { cn } from '@/lib/utils'
import { GripVertical, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

type BodyCol = Exclude<ColKey, 'reqNo' | 'actions'>

export function ColumnPicker({
  columns,
  onChange,
}: {
  columns: ColKey[]
  onChange: (next: ColKey[]) => void
}) {
  const [q, setQ] = useState('')
  const [dragKey, setDragKey] = useState<BodyCol | null>(null)
  const visible = new Set(columns)
  const selected = columns.filter((k): k is BodyCol => k !== 'reqNo' && k !== 'actions')
  const catalog = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return LIST_COLUMNS.filter((c) => !c.required && (!kw || c.label.toLowerCase().includes(kw) || c.key.toLowerCase().includes(kw)))
  }, [q])

  const toggle = (key: BodyCol, on: boolean) => {
    if (on) {
      if (visible.has(key)) return
      onChange(normalizeColumns([...selected, key]))
    } else {
      onChange(normalizeColumns(selected.filter((k) => k !== key)))
    }
  }

  const moveTo = (from: BodyCol, to: BodyCol) => {
    if (from === to) return
    const next = [...selected]
    const fi = next.indexOf(from)
    const ti = next.indexOf(to)
    if (fi < 0 || ti < 0) return
    next.splice(fi, 1)
    next.splice(ti, 0, from)
    onChange(normalizeColumns(next))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Settings2 /> 字段
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2">
          <div className="mb-1.5 text-[13px] font-semibold">显示字段</div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索字段" className="h-7" />
        </div>
        {selected.length > 0 ? (
          <div className="border-b px-3 py-2">
            <div className="mb-1 text-[11px] text-slate-400">已选字段（拖动调整顺序）</div>
            <div className="max-h-40 space-y-0.5 overflow-auto">
              {selected.map((key) => {
                const col = LIST_COLUMNS.find((c) => c.key === key)
                if (!col) return null
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={() => setDragKey(key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragKey) moveTo(dragKey, key)
                      setDragKey(null)
                    }}
                    className={cn(
                      'flex cursor-grab items-center gap-1.5 rounded px-1 py-1 hover:bg-slate-50',
                      dragKey === key && 'bg-sky-50',
                    )}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-slate-300" />
                    <span className="flex-1 text-[12.5px]">{col.label}</span>
                    <Checkbox checked onCheckedChange={() => toggle(key, false)} />
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
        <div className="max-h-56 overflow-auto px-3 py-2">
          <div className="mb-1 text-[11px] text-slate-400">全部字段</div>
          {catalog.map((col) => (
            <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50">
              <Checkbox checked={visible.has(col.key)} onCheckedChange={(c) => toggle(col.key as BodyCol, c === true)} />
              <span className="text-[12.5px]">{col.label}</span>
            </label>
          ))}
          {catalog.length === 0 ? <div className="py-4 text-center text-[12px] text-slate-400">无匹配字段</div> : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
