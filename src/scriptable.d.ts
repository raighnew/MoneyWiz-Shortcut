// Minimal ambient declarations for the Scriptable runtime
// (https://docs.scriptable.app). Absent when running under Node, so all
// access is guarded with typeof checks.
declare global {
  var Script: {
    setShortcutOutput(value: unknown): void
    complete(): void
  } | undefined

  var args: {
    shortcutParameter?: unknown
    plainTexts?: string[]
  } | undefined
}

export {}
