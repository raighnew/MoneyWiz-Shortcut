import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

export function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.txt`), 'utf8')
}
