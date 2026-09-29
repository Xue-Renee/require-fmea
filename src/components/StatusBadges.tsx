import { cn } from '@/lib/utils'
import type { CharacteristicSymbol, Importance, ReqLevel, ReqStatus, RiskLevel, TrState } from '@/types'
import type { ReactNode } from 'react'

function DotBadge({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-[12px]', className)}>
      <span className={cn('h-2 w-2 rounded-full', color)} />
      {children}
    </span>
  )
}

export function CharacteristicBadge({ value }: { value: CharacteristicSymbol }) {
  const cls =
    value === 'CC'
      ? 'border-red-500 text-red-600'
      : value === 'SC'
        ? 'border-orange-500 text-orange-600'
        : 'border-slate-300 text-slate-500'
  return <span className={cn('inline-flex rounded border px-1.5 py-0 text-[11px] font-semibold', cls)}>{value}</span>
}

export function ImportanceBadge({ value }: { value: Importance }) {
  const color = value === 'MUST' ? 'bg-red-500' : value === 'Should' ? 'bg-orange-500' : 'bg-slate-400'
  return <DotBadge color={color}>{value}</DotBadge>
}

export function RiskBadge({ value }: { value: RiskLevel }) {
  const color = value === '高' ? 'bg-red-500' : value === '中' ? 'bg-orange-500' : 'bg-emerald-500'
  return <DotBadge color={color}>{value}</DotBadge>
}

export function TrBadge({ value }: { value: TrState }) {
  const color =
    value === '是' ? 'bg-emerald-500' : value === '否' ? 'bg-red-500' : value === '不涉及' ? 'bg-slate-400' : 'bg-orange-500'
  return <DotBadge color={color}>{value}</DotBadge>
}

export function StatusBadge({ value }: { value: ReqStatus }) {
  const color =
    value === '已基线'
      ? 'bg-emerald-500'
      : value === '已评审'
        ? 'bg-sky-500'
        : value === '变更中'
          ? 'bg-orange-500'
          : value === '已关闭'
            ? 'bg-slate-400'
            : 'bg-slate-400'
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[12px]">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      {value}
    </span>
  )
}

export function LevelBadge({ value }: { value: ReqLevel }) {
  const cls =
    value === '产品需求'
      ? 'border-sky-400 bg-sky-50 text-sky-700'
      : value === '模块需求'
        ? 'border-teal-400 bg-teal-50 text-teal-700'
        : 'border-amber-400 bg-amber-50 text-amber-700'
  return <span className={cn('inline-flex rounded border px-1.5 py-0 text-[11px] font-semibold', cls)}>{value}</span>
}
