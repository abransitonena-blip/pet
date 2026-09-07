import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const scriptPath = path.resolve(__dirname, '../scripts/migrate-collections.js')
const fixturesPath = path.resolve(__dirname, '../scripts/fixtures')

function runScript(args: string[], expectExit = 0): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync('node', [scriptPath, ...args], {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: path.resolve(__dirname, '..')
    })
    return { stdout, stderr: '', code: 0 }
  } catch (e: unknown) {
    const err = e as { status: number; stdout?: string; stderr?: string }
    if (err.status !== expectExit) {
      throw e
    }
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code: err.status || 0
    }
  }
}

describe('migrate-collections.js — verify-only', () => {
  it('rejects when --verify-only is missing', () => {
    const result = runScript(['--fixtures-dir', fixturesPath, '--renames', '[]'], 2)
    expect(result.stdout + result.stderr).toMatch(/disabled/i)
  })

  it('rejects production project IDs', () => {
    const result = runScript(['--verify-only', '--fixtures-dir', fixturesPath, '--renames', '[]', '--project', 'production'], 1)
    expect(result.stdout + result.stderr).toMatch(/ABORTED/i)
  })

  it('accepts --yes flag (ignored in verify-only)', () => {
    const result = runScript(['--verify-only', '--yes', '--fixtures-dir', fixturesPath, '--renames', '[]'], 0)
    expect(result.stdout).toMatch(/completed successfully/i)
  })

  it('detects conflicts in legacy+new fixtures', () => {
    const result = runScript([
      '--verify-only',
      '--fixtures-dir', fixturesPath,
      '--renames',
      JSON.stringify([
        { from: 'clients', to: 'customerProfiles' },
        { from: 'pets', to: 'dogs' }
      ])
    ], 1)

    expect(result.stdout).toContain('conflict')
    expect(result.stdout).toContain('Migration blocked')
  })

  it('generates JSON report in artifacts/', () => {
    const reportPath = path.resolve(__dirname, '../artifacts/script-test-report.json')
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath)

    runScript([
      '--verify-only',
      '--fixtures-dir', fixturesPath,
      '--renames',
      JSON.stringify([{ from: 'pets', to: 'dogs' }]),
      '--report', reportPath
    ], 1)

    expect(fs.existsSync(reportPath)).toBe(true)
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
    expect(report.mode).toBe('verify-only')
    expect(report.summary.verifyOnly).toBe(true)
    expect(report.collections).toHaveProperty('pets → dogs')

    fs.unlinkSync(reportPath)
  })

  it('handles clean migration (no legacy, no new)', () => {
    const reportPath = path.resolve(__dirname, '../artifacts/empty-report.json')
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath)

    runScript([
      '--verify-only',
      '--fixtures-dir', fixturesPath,
      '--renames',
      JSON.stringify([{ from: 'empty-coll', to: 'new-empty-coll' }]),
      '--report', reportPath
    ])

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
    expect(report.summary.conflicts).toBe(0)
    expect(report.summary.alreadyMigrated).toBe(0)
    expect(report.summary.ready).toBe(1)

    fs.unlinkSync(reportPath)
  })

  it('exits 2 on unknown argument', () => {
    const result = runScript(['--verify-only', '--bogus'], 2)
    expect(result.stdout + result.stderr).toMatch(/Unknown argument/i)
  })

  it('exits 2 when --renames is missing', () => {
    const result = runScript(['--verify-only', '--fixtures-dir', fixturesPath], 2)
    expect(result.stdout + result.stderr).toMatch(/--renames is required/i)
  })

  it('validates fixtures path is within fixtures directory', () => {
    const result = runScript([
      '--verify-only',
      '--fixtures-dir', '/etc/passwd',
      '--renames', '[]'
    ], 2)
    expect(result.stdout + result.stderr).toMatch(/must be within fixtures/i)
  })

  it('detects already-migrated collections (source empty, new has data)', () => {
    const reportPath = path.resolve(__dirname, '../artifacts/migrated-report.json')
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath)

    runScript([
      '--verify-only',
      '--fixtures-dir', fixturesPath,
      '--renames',
      JSON.stringify([{ from: 'empty-coll', to: 'dogs' }]),
      '--report', reportPath
    ], 1)

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
    expect(report.collections['empty-coll → dogs'].status).toBe('already_migrated')

    fs.unlinkSync(reportPath)
  })
})
