import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FILTER_OPS,
  FILTERABLE_COLUMNS,
  SORT_OPTIONS,
  collectFieldOptions,
  emptyFilter,
  type ColKey,
  type FilterCondition,
  type FilterOp,
  type SortKey,
} from '@/lib/listView'
import type { Database, Requirement } from '@/types'
import { ArrowDownAZ, ArrowUpAZ, Plus, X } from 'lucide-react'

export function FilterBar({
  filters,
  sortKey,
  sortDir,
  reqs,
  db,
  extraOptions,
  onFiltersChange,
  onSortChange,
}: {
  filters: FilterCondition[]
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  reqs: Requirement[]
  db: Database
  extraOptions?: Partial<Record<ColKey, string[]>>
  onFiltersChange: (next: FilterCondition[]) => void
  onSortChange: (key: SortKey, dir: 'asc' | 'desc') => void
}) {
  const setAt = (id: string, patch: Partial<FilterCondition>) => {
    onFiltersChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  return (
    <div className="space-y-1">
      {filters.length > 0 ? (
        <div className="text-[11px] text-slate-400">
          模块需求与零件需求作为独立条目一并筛选。清空条件即可查看全部层级。
        </div>
      ) : null}
      {filters.map((f, i) => {
        const meta = FILTERABLE_COLUMNS.find((c) => c.key === f.field)
        const needsValue = f.op !== 'empty' && f.op !== 'notEmpty'
        const options = collectFieldOptions(f.field, reqs, db, extraOptions?.[f.field])
        const useSelect = meta?.valueKind === 'enum' || options.length > 0
        return (
          <div key={f.id} className="flex flex-wrap items-center gap-1.5">
            <span className="w-8 shrink-0 text-[12px] text-slate-500">{i === 0 ? '满足' : '且'}</span>
            <Select
              value={f.field}
              onValueChange={(v) => setAt(f.id, { field: v as ColKey, value: '' })}
            >
              <SelectTrigger className="h-7 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERABLE_COLUMNS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={f.op} onValueChange={(v) => setAt(f.id, { op: v as FilterOp })}>
              <SelectTrigger className="h-7 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsValue ? (
              useSelect ? (
                <Select value={f.value || '__empty'} onValueChange={(v) => setAt(f.id, { value: v === '__empty' ? '' : v })}>
                  <SelectTrigger className="h-7 min-w-[120px] max-w-[220px]">
                    <SelectValue placeholder="选择值" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty">请选择</SelectItem>
                    {options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-7 w-44"
                  value={f.value}
                  onChange={(e) => setAt(f.id, { value: e.target.value })}
                  placeholder="输入筛选内容"
                />
              )
            ) : null}
            <button
              type="button"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onFiltersChange(filters.filter((x) => x.id !== f.id))}
              aria-label="删除条件"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" className="text-primary hover:bg-sky-50" onClick={() => onFiltersChange([...filters, emptyFilter()])}>
          <Plus /> 添加条件
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[12px] text-slate-400">排序</span>
          <Select value={sortKey} onValueChange={(v) => onSortChange(v as SortKey, sortDir)}>
            <SelectTrigger className="h-7 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7"
            title={sortDir === 'asc' ? '升序' : '降序'}
            disabled={sortKey === 'tree'}
            onClick={() => onSortChange(sortKey, sortDir === 'asc' ? 'desc' : 'asc')}
          >
            {sortDir === 'asc' ? <ArrowUpAZ /> : <ArrowDownAZ />}
          </Button>
        </div>
      </div>
    </div>
  )
}
