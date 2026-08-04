#!/usr/bin/env node
// Fails the build if legacy or forbidden brand text reappears.
// Guarda que "Zona Quebrada" / marca geográfica legacy no vuelva al código.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SKIP = new Set(['node_modules', '.next', '.git', '.vercel'])
const PATTERNS = [
  { re: /quebrada/i, label: 'texto legacy "Quebrada" (marca geográfica eliminada)' },
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx|js|jsx|mjs|json|css|html|md)$/.test(name)) out.push(full)
  }
  return out
}

const targets = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'public')),
  join(ROOT, 'firestore.rules'),
  join(ROOT, 'firestore.indexes.json'),
  join(ROOT, 'scripts', 'seed-appsettings.json'),
].filter((f) => statSync(f).isFile())

const failures = []

for (const file of targets) {
  let content
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const { re, label } of PATTERNS) {
    if (re.test(content)) {
      failures.push(`  ${file.replace(ROOT + '/', '')}: contiene ${label}`)
    }
  }
}

if (failures.length > 0) {
  console.error('✖ Build bloqueado — texto prohibido detectado:')
  failures.forEach((f) => console.error(f))
  process.exit(1)
}

console.log('✔ Guard de marca: sin texto legacy ("Quebrada") en src/public/rules.')
