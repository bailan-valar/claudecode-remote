import { describe, test, expect } from 'vitest'
import { getAllowedNext, STATUS_LABEL } from '../taskTransitions'
import { TASK_STATUS } from '../../../../shared/constants'

describe('getAllowedNext', () => {
  test('planned can only go to pending', () => {
    expect(getAllowedNext('planned')).toEqual([TASK_STATUS.PENDING])
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
})

describe('STATUS_LABEL', () => {
  test('all statuses have Chinese labels', () => {
    Object.values(TASK_STATUS).forEach((s) => {
      expect(STATUS_LABEL[s]).toBeTruthy()
    })
  })
})
