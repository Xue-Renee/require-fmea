import {
  DEFAULT_ACCEPTANCE_METHODS,
  DEFAULT_CATEGORIES,
  DEFAULT_DISCIPLINES,
  DEFAULT_MODULES,
  DEFAULT_PART_ACCEPTANCE_METHODS,
} from '@/lib/constants'
import type { CustomOptions, OptionItem } from '@/types'

export function parseLabeledOption(line: string): OptionItem {
  const raw = line.trim()
  const m = raw.match(/^(.+?)[（(](.+)[）)]$/)
  if (m) return { value: m[1].trim(), hint: m[2].trim(), raw }
  return { value: raw, raw }
}

function pickList(custom: string[] | undefined, fallback: string[]) {
  return custom && custom.length > 0 ? custom : fallback
}

export function resolveOptionLists(custom: CustomOptions | null | undefined) {
  const categories = pickList(custom?.categories, DEFAULT_CATEGORIES)
  const modules = pickList(custom?.modules, DEFAULT_MODULES).map(parseLabeledOption)
  const disciplines = pickList(custom?.disciplines, DEFAULT_DISCIPLINES).map(parseLabeledOption)
  const acceptanceMethods = pickList(custom?.acceptanceMethods, DEFAULT_ACCEPTANCE_METHODS)
  const partAcceptanceMethods = pickList(custom?.partAcceptanceMethods, DEFAULT_PART_ACCEPTANCE_METHODS)
  return { categories, modules, disciplines, acceptanceMethods, partAcceptanceMethods }
}

export function linesToList(text: string) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function listToLines(list: string[]) {
  return list.join('\n')
}
