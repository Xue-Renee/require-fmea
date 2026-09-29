import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function nowIso() {
  return new Date().toISOString()
}

export function splitMulti(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(/[,，、;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinComma(values: string[]) {
  return values.join(',')
}

export function joinDunhao(values: string[]) {
  return values.join('、')
}

export function displayMulti(value?: string | null) {
  return joinDunhao(splitMulti(value))
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function formatDateTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function currentActor() {
  try {
    return localStorage.getItem('sysre.actor') || '管理员'
  } catch {
    return '管理员'
  }
}
