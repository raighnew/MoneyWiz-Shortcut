import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { loadFixture } from './helpers.ts'

const DIST_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'MoneyWiz.js')

// Runs the bundled Scriptable script in a fresh VM context with stubbed
// Scriptable globals, exactly as Scriptable's Run Script action would.
function runDistWithShortcutParameter(parameter: string): { output: any; completed: boolean } {
  const captured = { output: undefined as any, completed: false }
  vm.runInNewContext(readFileSync(DIST_FILE, 'utf8'), {
    Script: {
      setShortcutOutput(value: unknown) { captured.output = value },
      complete() { captured.completed = true }
    },
    args: { shortcutParameter: parameter }
  })
  return captured
}

test('bundled Scriptable script processes a JD screenshot', () => {
  const { output, completed } = runDistWithShortcutParameter(loadFixture('jd'))
  assert.equal(completed, true)
  assert.equal(output.ok, true)
  assert.equal(output.platform, 'jd')
  assert.equal(output.amount, 93)
  assert.equal(output.category, 'Baby')
  assert.ok(output.url.startsWith('moneywiz://expense?'))
})

test('bundled Scriptable script reports unrecognized input', () => {
  const { output, completed } = runDistWithShortcutParameter('无关文字')
  assert.equal(completed, true)
  assert.equal(output.ok, false)
  assert.ok(output.error)
})
