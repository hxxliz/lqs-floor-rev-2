#!/usr/bin/env node
/**
 * build-runtime.cjs
 *
 * Assembles the private media runtime in runtime/<platform>/ from the pinned
 * manifest in runtime/lock.json. This is the reproducible replacement for the
 * original hand-rolled runtime: bump a version in lock.json, run this, re-verify
 * (node scripts/verify-runtime-lock.cjs), then `npm run make`.
 *
 * It builds into a FRESH directory (runtime-build/<platform>/) and only swaps it
 * into place as the final step, so a failed/interrupted run never clobbers the
 * working runtime.
 *
 * Modes:
 *   node scripts/build-runtime.cjs --dry-run     # default. Verify manifest + URLs,
 *                                                # print the exact plan, touch nothing.
 *   node scripts/build-runtime.cjs --build       # actually download + assemble.
 *   node scripts/build-runtime.cjs --build --keep  # build but don't swap into place.
 *
 * Platform: reads lock.json.platform (currently win32-x64). The Python/FFmpeg/
 * yt-dlp download URLs are platform-specific and live in the lockfile, so this
 * script is generic and the manifest drives it.
 *
 * Steps (--build):
 *   1. Download + extract embedded Python  (lock.json.python)
 *   2. Enable pip in the embedded dist     (pip bootstrap, pinned)
 *   3. pip install VS core + all pinned plugins + deps  (lock.json)
 *   4. Download FFmpeg/FFprobe static build, copy exe+dlls  (lock.json.ffmpeg)
 *   5. Download yt-dlp.exe                 (lock.json.yt-dlp)
 *   6. Write a build stamp (versions + date + git sha) into the new runtime
 *   7. Swap runtime-build/<platform>/ -> runtime/<platform>/  (unless --keep)
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const lockPath = path.join(root, 'runtime', 'lock.json');

// ------------------------------------------------------------------ args ----
const argv = process.argv.slice(2);
const dryRun = !argv.includes('--build');
const keep = argv.includes('--keep');
const PLATFORM = require(lockPath).platform;

const outBase = path.join(root, 'runtime-build');
const buildDir = path.join(outBase, PLATFORM);
const targetDir = path.join(root, 'runtime', PLATFORM);

const log = (s) => console.log(s);
const die = (s) => { console.error(`\nerror: ${s}`); process.exit(1); };

let lock;
try { lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')); }
catch (e) { die(`could not parse ${lockPath}: ${e.message}`); }

if (lock.platform !== PLATFORM) die(`lock.platform=${lock.platform} != expected ${PLATFORM}`);

log(`\n=== Vapormint runtime build ===`);
log(`mode:      ${dryRun ? 'DRY-RUN (verify + plan, no writes)' : 'BUILD'}${keep ? ' (keep, no swap)' : ''}`);
log(`platform:  ${PLATFORM}`);
log(`manifest:  ${path.relative(root, lockPath)}`);
log(`build dir: ${path.relative(root, buildDir)}`);
log(`target:    ${path.relative(root, targetDir)}\n`);

// ------------------------------------------------------------- helpers ----
async function httpGetBuffer(url, { retries = 3, timeoutMs = 120000 } = {}) {
  // Node 18+ has global fetch. Returns Buffer.
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      if (i < retries) { const wait = 1000 * (i + 1); log(`  retry ${i + 1}/${retries} after ${e.message} (wait ${wait / 1000}s)`); await new Promise(r => setTimeout(r, wait)); }
    }
  }
  throw lastErr;
}

async function httpHead(url) {
  const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000), redirect: 'follow' });
  return { status: res.status, size: Number(res.headers.get('content-length') || 0), type: res.headers.get('content-type') || '' };
}

// Run a child process, piping its stdout/stderr into the logger. We avoid
// stdio:'inherit' because under a redirected/pipe stdin (CI, background, `tee`)
// inheriting stdin can deadlock or get the child signaled. Piped stdio is safe.
function runChild(cmd, args, opts = {}) {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    shell: false,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...opts.env },
  });
  if (r.stdout && r.stdout.length) log(r.stdout.toString().trim());
  if (r.stderr && r.stderr.length) log(r.stderr.toString().trim());
  if (r.status !== 0) die(`command failed (${r.status}): ${cmd} ${args.join(' ')}${r.stderr ? ' :: ' + r.stderr.toString().trim() : ''}`);
  return r;
}

// zip extraction: use a small dependency-free path via the OS. On Windows we
// use PowerShell Expand-Archive (always present); elsewhere `unzip`.
// NOTE: paths may contain an apostrophe (the repo lives under "LQ's Cutting
// Floor"), so single-quoted PS strings must have ' doubled to '' to survive.
function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    const q = (s) => `'${s.replace(/'/g, "''")}'`;
    const ps = `Expand-Archive -LiteralPath ${q(zipPath)} -DestinationPath ${q(destDir)} -Force`;
    runChild('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
  } else {
    runChild('unzip', ['-o', '-q', zipPath, '-d', destDir]);
  }
}

// ---------------------------------------------------------------- plan ----
async function main() {
const plan = [];
plan.push(`Python   ${lock.python.version}  <- ${lock.python.url}`);
plan.push(`FFmpeg   ${lock.ffmpeg.version} (${lock.ffmpeg.build})  <- ${lock.ffmpeg.url}`);
plan.push(`yt-dlp   ${lock['yt-dlp'].version}  <- ${lock['yt-dlp'].url}`);
plan.push(`VS core  ${lock.vapoursynth.core}  (pip ${lock.vapoursynth.core_package}==${lock.vapoursynth.core_version} from ${lock.vapoursynth.index})`);
plan.push(`VS plugins (${lock.plugins.packages.length}): ${lock.plugins.packages.map(p => `${p.name}@${p.version}`).join(', ')}`);
plan.push(`Python deps (${lock.python_deps.packages.length}): ${lock.python_deps.packages.map(p => `${p.pip}@${p.version}`).join(', ')}`);

log('PLAN:');
plan.forEach(l => log('  ' + l));
log('');

// ------------------------------------------------------ URL verification ----
log('VERIFYING DOWNLOAD URLS (HEAD requests):');
const urls = [
  ['python', lock.python.url],
  ['ffmpeg', lock.ffmpeg.url],
  ['yt-dlp', lock['yt-dlp'].url],
];
let allOk = true;
for (const [name, url] of urls) {
  try {
    const h = await httpHead(url);
    const ok = h.status === 200 || h.status === 301 || h.status === 302;
    allOk = allOk && ok;
    log(`  ${ok ? 'OK ' : 'BAD'}  ${name.padEnd(8)} HTTP ${h.status}  ${h.size ? (h.size / 1048576).toFixed(1) + ' MB' : 'n/a'}  ${h.type}`);
    if (!ok) die(`${name} URL returned HTTP ${h.status} — check lock.json`);
  } catch (e) {
    allOk = false;
    log(`  FAIL ${name.padEnd(8)} ${e.message}  (${url})`);
    die(`${name} URL unreachable: ${e.message}`);
  }
}

// Verify the pip packages exist at the pinned versions on the index (HEAD to the
// PyPI simple index page for each; a 200 with the version file present is enough).
log('\nVERIFYING PIP PACKAGES (PyPI simple index):');
async function pypiHas(pipName, version) {
  const base = (lock.plugins.index || 'https://pypi.org/simple/').replace(/\/$/, '');
  // PyPI simple index: https://pypi.org/simple/<name>/ lists files. We check the
  // index page is reachable; exact version pin is enforced by pip at install time.
  const url = `${base}/${encodeURIComponent(pipName)}/`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) return { ok: false, status: res.status };
  const html = await res.text();
  const hasVersion = html.includes(`-${version}-`) || html.includes(`==${version}`) || html.includes(version);
  return { ok: true, status: res.status, hasVersion };
}
const pipPkgs = [
  { pip: lock.vapoursynth.core_package, version: String(lock.vapoursynth.core_version) },
  ...lock.plugins.packages.map(p => ({ pip: p.pip, version: p.version })),
  ...lock.python_deps.packages.map(p => ({ pip: p.pip, version: p.version })),
];
for (const p of pipPkgs) {
  try {
    const r = await pypiHas(p.pip, p.version);
    const ok = r.ok;
    allOk = allOk && ok;
    log(`  ${ok ? 'OK  ' : 'BAD '}  ${p.pip.padEnd(22)} @ ${String(p.version).padEnd(8)} HTTP ${r.status}${r.hasVersion === false ? '  (version file not clearly listed — pip will enforce)' : ''}`);
    if (!ok) die(`pip package ${p.pip} not reachable (HTTP ${r.status})`);
  } catch (e) {
    allOk = false;
    log(`  FAIL ${p.pip.padEnd(22)} ${e.message}`);
    die(`pip package ${p.pip} unreachable: ${e.message}`);
  }
}

if (!allOk) die('one or more URLs/packages failed verification');
log('\nAll URLs + pip packages reachable. Manifest looks buildable.');

if (dryRun) {
  log('\nDRY-RUN complete. Nothing was downloaded or written.');
  log('To build:  node scripts/build-runtime.cjs --build');
  process.exit(0);
}

// ------------------------------------------------------------- BUILD ----
log('\n=== BUILDING (this will download several hundred MB) ===');
fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });
const stamp = { platform: PLATFORM, built_at: new Date().toISOString(), tools: {}, git: 'n/a' };

// --- 1. embedded Python -----------------------------------------------------
log('\n[1/7] embedded Python ' + lock.python.version);
{
  const zip = path.join(os.tmpdir(), `vapormint-py-${process.pid}.zip`);
  const buf = await httpGetBuffer(lock.python.url);
  fs.writeFileSync(zip, buf);
  log(`  downloaded ${(buf.length / 1048576).toFixed(1)} MB`);
  const pyHome = path.join(buildDir);
  extractZip(zip, pyHome);
  fs.unlinkSync(zip);
  // embedded zip extracts to a flat dir (python.exe at top). Ensure python.exe present.
  if (!fs.existsSync(path.join(pyHome, 'python.exe'))) die('python.exe not found after extract — unexpected zip layout');
  stamp.tools.python = lock.python.version;
}

// --- 2. enable pip in embedded dist ----------------------------------------
log('\n[2/7] enable pip in embedded Python');
{
  // The embedded dist ships a ._pth file that disables site-packages. Rewrite it
  // to import site + point at Lib, then bootstrap pip via get-pip pinned.
  const pth = path.join(buildDir, 'python312._pth');
  if (fs.existsSync(pth)) {
    fs.writeFileSync(pth, 'python312.zip\n.\nLib\\site-packages\nimport site\n', 'utf8');
    log('  patched python312._pth to enable site-packages');
  } else {
    log('  (no python312._pth found — embedded layout may differ; continuing)');
  }
  // Install a pinned pip (matches lock.json.python_deps pip version).
  const pipVersion = (lock.python_deps.packages.find(p => p.pip === 'pip') || {}).version || '26.2.1';
  const getpip = 'https://bootstrap.pypa.io/get-pip.py';
  const gp = path.join(os.tmpdir(), `vapormint-getpip-${process.pid}.py`);
  fs.writeFileSync(gp, await httpGetBuffer(getpip));
  runChild(path.join(buildDir, 'python.exe'), [gp, '--no-warn-script-location', 'pip==' + pipVersion], { cwd: buildDir });
  fs.unlinkSync(gp);
  stamp.tools.pip = pipVersion;
  log('  pip ' + pipVersion + ' installed');
}

// --- 3. pip install VS core + plugins + deps --------------------------------
log('\n[3/7] pip install VS core + ' + lock.plugins.packages.length + ' plugins + ' + lock.python_deps.packages.length + ' deps');
{
  const index = (lock.plugins.index || 'https://pypi.org/simple/').replace(/\/$/, '');
  const reqs = [
    `${lock.vapoursynth.core_package}==${lock.vapoursynth.core_version}`,
    ...lock.plugins.packages.map(p => `${p.pip}==${p.version}`),
    ...lock.python_deps.packages.map(p => `${p.pip}==${p.version}`),
  ];
  const reqFile = path.join(os.tmpdir(), `vapormint-reqs-${process.pid}.txt`);
  fs.writeFileSync(reqFile, reqs.join('\n') + '\n', 'utf8');
  // CRITICAL: install ONLY into the embedded dist, never satisfying a pin from
  // the build machine's user site-packages (Roaming\Python\...). Without this,
  // pip sees "Requirement already satisfied" in the user site and skips the
  // install, so VS core / VSZip (vspipe) and several deps never land in the
  // bundle — and the result is non-deterministic across build machines.
  //   PYTHONNOUSERSITE=1  -> `import site` won't add the user site dir
  //   --ignore-installed  -> force a fresh copy into the dist regardless
  //   --no-cache-dir      -> no cache skew between builds
  runChild(path.join(buildDir, 'python.exe'),
    ['-m', 'pip', 'install', '--no-warn-script-location', '--ignore-installed',
     '--no-cache-dir', '--target', path.join(buildDir, 'Lib', 'site-packages'),
     '-i', index, '-r', reqFile],
    { cwd: buildDir, env: { PYTHONNOUSERSITE: '1' } });
  fs.unlinkSync(reqFile);
  // record installed versions
  const sp = path.join(buildDir, 'Lib', 'site-packages');
  const dirs = fs.existsSync(sp) ? fs.readdirSync(sp).filter(d => d.endsWith('.dist-info')) : [];
  const verOf = (n) => { const hit = dirs.find(d => d.toLowerCase().startsWith(n.toLowerCase() + '-')); return hit ? hit.replace(/\.dist-info$/, '').slice(n.length + 1) : '?'; };
  stamp.tools.vapoursynth_core = verOf(lock.vapoursynth.core_package);
  stamp.tools.plugins = Object.fromEntries(lock.plugins.packages.map(p => [p.name, verOf(p.pip)]));
  log('  installed into ' + path.relative(root, sp));
}

// --- 4. FFmpeg/FFprobe ------------------------------------------------------
log('\n[4/7] FFmpeg ' + lock.ffmpeg.version);
{
  const zip = path.join(os.tmpdir(), `vapormint-ffmpeg-${process.pid}.zip`);
  const buf = await httpGetBuffer(lock.ffmpeg.url);
  fs.writeFileSync(zip, buf);
  log(`  downloaded ${(buf.length / 1048576).toFixed(1)} MB`);
  const tmpExtract = path.join(os.tmpdir(), `vapormint-ffmpeg-x-${process.pid}`);
  extractZip(zip, tmpExtract);
  fs.unlinkSync(zip);
  // BtbN layout: ffmpeg-master-latest-win64-gpl/bin/{ffmpeg.exe,ffprobe.exe,*.dll}
  const binDir = path.join(tmpExtract, 'ffmpeg-master-latest-win64-gpl', 'bin');
  const candidates = fs.existsSync(binDir) ? [binDir] : [tmpExtract];
  const found = candidates.find(d => fs.existsSync(path.join(d, 'ffmpeg.exe')));
  if (!found) die('ffmpeg.exe not found in extracted FFmpeg zip — layout changed?');
  // copy the exe + the av*/sw* dlls the runtime needs
  const wantedExe = ['ffmpeg.exe', 'ffprobe.exe'];
  const dllRe = /^(avcodec|avdevice|avfilter|avformat|avutil|swresample|swscale)-\d+\.dll$/i;
  for (const f of fs.readdirSync(found)) {
    if (wantedExe.includes(f) || dllRe.test(f)) fs.copyFileSync(path.join(found, f), path.join(buildDir, f));
  }
  fs.rmSync(tmpExtract, { recursive: true, force: true });
  // REPRODUCIBILITY GUARD: the FFmpeg source (lock.json.ffmpeg.url) may be a
  // moving target (e.g. BtbN's "latest" tag) that drifts over time. Confirm the
  // build we just copied actually reports the pinned build string, and fail
  // loudly if it doesn't — so a drifted source can never silently ship.
  const ffExe = path.join(buildDir, 'ffmpeg.exe');
  const ffVer = (execFileSync(ffExe, ['-version'], { encoding: 'utf8', windowsHide: true })).split('\n')[0];
  // line looks like: ffmpeg version n9.0.1-29-gad500d59cb-20260913 Copyright ...
  const m = ffVer.match(/ffmpeg version (\S+)/);
  const gotBuild = m ? m[1] : '(unparseable)';
  const wantBuild = lock.ffmpeg.build;
  if (gotBuild !== wantBuild) {
    die(`FFmpeg source drift: lock.json pins build '${wantBuild}' but the downloaded build reports '${gotBuild}'.\n` +
        `  The source URL (${lock.ffmpeg.url}) is not delivering the pinned build.\n` +
        `  Fix: point lock.json.ffmpeg.url at a stable artifact for build '${wantBuild}' (e.g. a\n` +
        `  pinned release asset on our own repo), or update lock.json.ffmpeg.build if you intend to move.`);
  }
  stamp.tools.ffmpeg = lock.ffmpeg.version;
  stamp.tools.ffmpeg_build = lock.ffmpeg.build;
  log(`  copied ffmpeg.exe, ffprobe.exe + FFmpeg DLLs  (build verified: ${gotBuild})`);
}

// --- 5. yt-dlp --------------------------------------------------------------
log('\n[5/7] yt-dlp ' + lock['yt-dlp'].version);
{
  const buf = await httpGetBuffer(lock['yt-dlp'].url);
  fs.writeFileSync(path.join(buildDir, 'yt-dlp.exe'), buf);
  log(`  downloaded ${(buf.length / 1048576).toFixed(1)} MB`);
  stamp.tools.yt_dlp = lock['yt-dlp'].version;
}

// --- 6. build stamp ---------------------------------------------------------
log('\n[6/7] build stamp');
{
  let git = 'n/a';
  try { git = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* no git */ }
  stamp.git = git;
  fs.writeFileSync(path.join(buildDir, 'BUILD-STAMP.json'), JSON.stringify(stamp, null, 2) + '\n', 'utf8');
  log(`  wrote BUILD-STAMP.json (git ${git})`);
}

// --- 7. swap into place -----------------------------------------------------
log('\n[7/7] swap into place');
if (keep) {
  log('  --keep set: leaving new runtime at ' + path.relative(root, buildDir));
} else {
  if (!fs.existsSync(targetDir)) { fs.mkdirSync(targetDir, { recursive: true }); }
  // move old aside, move new in, best-effort remove old
  const backup = targetDir + '.bak-' + Date.now();
  fs.renameSync(targetDir, backup);
  try { fs.renameSync(buildDir, targetDir); }
  catch (e) { fs.renameSync(backup, targetDir); die('swap failed, restored original: ' + e.message); }
  fs.rmSync(backup, { recursive: true, force: true });
  log('  runtime/' + PLATFORM + '/ updated');
}

log('\n=== BUILD COMPLETE ===');
log('Now run:  node scripts/verify-runtime-lock.cjs   (to confirm the new runtime matches the manifest)');
log('Then:     npm run make');
} // end main()

main().catch((e) => { console.error('\nbuild failed: ' + (e && e.stack || e)); process.exit(1); });
