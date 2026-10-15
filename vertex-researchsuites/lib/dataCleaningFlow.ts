// Which question the user is on, what is coded and what was skipped. Pure code.
import { CodedQuestion, Grid, suggestQuestionColumns } from './dataCleaning'

export interface FlowState { queue: number[]; coded: CodedQuestion[]; skipped: number[] }

// The question the user typed first, then every later column that has word answers.
export function startFlow(grid: Grid, firstCol: number): FlowState {
  return { queue: [firstCol].concat(suggestQuestionColumns(grid, firstCol + 1)), coded: [], skipped: [] }
}

export function currentCol(s: FlowState): number | null {
  return s.queue.length > 0 ? s.queue[0] : null
}

export function totalQuestions(s: FlowState): number {
  return s.coded.length + s.skipped.length + s.queue.length
}

export function acceptCurrent(s: FlowState, q: CodedQuestion): FlowState {
  if (s.queue.length === 0 || s.queue[0] !== q.col) return s
  return { queue: s.queue.slice(1), coded: s.coded.concat([q]), skipped: s.skipped }
}

export function skipCurrent(s: FlowState): FlowState {
  if (s.queue.length === 0) return s
  return { queue: s.queue.slice(1), coded: s.coded, skipped: s.skipped.concat([s.queue[0]]) }
}

// Puts a coded or skipped column back in front so the user can do it again.
export function redoColumn(s: FlowState, col: number): FlowState {
  return {
    queue: [col].concat(s.queue.filter((c) => c !== col)),
    coded: s.coded.filter((q) => q.col !== col),
    skipped: s.skipped.filter((c) => c !== col),
  }
}

export function codedInColumnOrder(s: FlowState): CodedQuestion[] {
  return s.coded.slice().sort((a, b) => a.col - b.col)
}
