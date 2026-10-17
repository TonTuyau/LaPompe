import { addingSince, atLeast } from './version'

describe('atLeast', () => {
  it.each([
    ['1.6.0', true],
    ['1.6.0-alpha.1', true],
    ['1.10.0', true],
    ['2.0.0', true],
    ['1.5.0', false],
    ['1.5.9', false],
    ['0.9.0', false],
  ])('%s against 1.6.0: %s', (version, expected) => {
    expect(atLeast(version, addingSince)).toBe(expected)
  })
})
