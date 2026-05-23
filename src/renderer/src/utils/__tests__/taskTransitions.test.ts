import { describe, test, expect } from 'vitest'
import { getAllowedNext, STATUS_LABEL } from '../taskTransitions'
import { TASK_STATUS } from '../../../../shared/constants'

describe('getAllowedNext', () => {
  test('planned can go to plan_required or pending', () => {
    expect(getAllowedNext('planned')).toEqual([TASK_STATUS.PLAN_REQUIRED, TASK_STATUS.PENDING])
  })
  test('plan_required can only go to planning', () => {
    expect(getAllowedNext('plan_required')).toEqual([TASK_STATUS.PLANNING])
  })
  test('planning can only go to plan_reviewing', () => {
    expect(getAllowedNext('planning')).toEqual([TASK_STATUS.PLAN_REVIEWING])
  })
  test('plan_reviewing can go to pending or closed', () => {
    expect(getAllowedNext('plan_reviewing')).toEqual([TASK_STATUS.PENDING, TASK_STATUS.CLOSED])
  })
  test('pending can only go to developing', () => {
    expect(getAllowedNext('pending')).toEqual([TASK_STATUS.DEVELOPING])
  })
  test('developing can only go to reviewing', () => {
    expect(getAllowedNext('developing')).toEqual([TASK_STATUS.REVIEWING])
  })
  test('reviewing can go to completed, pending, or closed', () => {
    expect(getAllowedNext('reviewing')).toEqual([
      TASK_STATUS.COMPLETED,
      TASK_STATUS.PENDING,
      TASK_STATUS.CLOSED,
    ])
  })
  test('completed has no next states', () => {
    expect(getAllowedNext('completed')).toEqual([])
  })
  test('closed has no next states', () => {
    expect(getAllowedNext('closed')).toEqual([])
  })
  test('stopped can go to pending or plan_required depending on task type', () => {
    expect(getAllowedNext('stopped', { isPlan: false })).toEqual([TASK_STATUS.PENDING])
    expect(getAllowedNext('stopped', { isPlan: true })).toEqual([TASK_STATUS.PLAN_REQUIRED])
  })
  test('failed can go to developing or planning depending on task type', () => {
    expect(getAllowedNext('failed', { isPlan: false })).toEqual([TASK_STATUS.DEVELOPING, TASK_STATUS.CLOSED])
    expect(getAllowedNext('failed', { isPlan: true })).toEqual([TASK_STATUS.PLANNING, TASK_STATUS.CLOSED])
  })
})

describe('STATUS_LABEL', () => {
  test('all statuses have Chinese labels', () => {
    Object.values(TASK_STATUS).forEach((s) => {
      expect(STATUS_LABEL[s]).toBeTruthy()
    })
  })
})
