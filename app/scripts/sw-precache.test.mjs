import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { collectAssets, renderServiceWorker, writeServiceWorker } from './sw-precache.mjs'

const tempDirs = []

function makeDist() {
  const dir = mkdtempSync(join(tmpdir(), 'devhub-sw-'))
  tempDirs.push(dir)
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="root"></div>')
  writeFileSync(join(dir, 'assets', 'index-abc.js'), 'console.log("main")')
  writeFileSync(join(dir, 'assets', 'index-x7z.css'), 'body{}')
  writeFileSync(join(dir, 'sw.js'), 'stale')
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('sw-precache', () => {
  it('collects hashed assets from dist, skipping sw.js itself', () => {
    const entries = collectAssets(makeDist())
    expect(entries.map((e) => e.url)).toEqual([
      '/assets/index-abc.js',
      '/assets/index-x7z.css',
      '/index.html',
    ])
    for (const entry of entries) {
      expect(entry.revision).toMatch(/^[0-9a-f]{10}$/)
    }
  })

  it('revisions are content-based (same path, different content -> different revision)', () => {
    const first = collectAssets(makeDist())
    const dir = mkdtempSync(join(tmpdir(), 'devhub-sw-'))
    tempDirs.push(dir)
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="root">changed</div>')
    writeFileSync(join(dir, 'assets', 'index-abc.js'), 'console.log("changed")')
    writeFileSync(join(dir, 'assets', 'index-x7z.css'), 'body{}')
    const second = collectAssets(dir)
    expect(second.find((e) => e.url === '/index.html')?.revision).not.toBe(
      first.find((e) => e.url === '/index.html')?.revision,
    )
    expect(second.find((e) => e.url === '/assets/index-abc.js')?.revision).not.toBe(
      first.find((e) => e.url === '/assets/index-abc.js')?.revision,
    )
    expect(second.find((e) => e.url === '/assets/index-x7z.css')?.revision).toBe(
      first.find((e) => e.url === '/assets/index-x7z.css')?.revision,
    )
  })

  it('renders a service worker with precache list, cache name and handlers', () => {
    const code = renderServiceWorker([{ url: '/index.html', revision: 'aaa1110000' }])
    expect(code).toContain('const CACHE = "devhub-v1";')
    expect(code).toContain('"/index.html?v=aaa1110000"')
    expect(code).toContain("self.addEventListener('install'")
    expect(code).toContain("self.addEventListener('activate'")
    expect(code).toContain("self.addEventListener('fetch'")
    expect(code).toContain("caches.match('/index.html', { ignoreSearch: true })")
    expect(code).toContain('self.skipWaiting()')
    expect(code).toContain('self.clients.claim()')
  })

  it('writes a valid sw.js into dist and skips stale sw.js in the list', () => {
    const dir = makeDist()
    const count = writeServiceWorker(dir)
    const written = renderServiceWorker(collectAssets(dir))
    expect(readFileSync(join(dir, 'sw.js'), 'utf8')).toBe(written)
    expect(count).toBe(3)
  })
})