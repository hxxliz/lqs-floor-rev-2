#!/usr/bin/env node
/**
 * verify-runtime-lock.cjs
 *
 * Confirms that the private media runtime actually shipped in
 * runtime/win32-x64/ still matches every version pinned in runtime/lock.json.
 *
 * Why this exists: the runtime dir is gitignored (only lock.json + README are
 * committed). This verifier is the auditable bridge between the manifest and the
 * real binaries. Run it before you `npm run make` to guarantee the installer
 * will carry exactly the versions you pinned — and after a hand-rolled runtime
 * rebuild to catch drift.
 *
 * Usage:  node scripts/verify-runtime-lock.cjs
 * Wired into:  npm run check
 *
 * Exit 0 = every pinned version matches the installed runtime.
 * Exit 1 = one or more mismatches (printed inline).
 *
 * It reads the on-disk dist-info dirs (ground truth for pip packages) and, for
 * the non-pip tools (ffmpeg / ffprobe / yt-dlp / python / VS core), shells out
 * to the real binaries and parses --version so the check covers them too.
 */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lockPath = path.join(root, 'runtime', 'lock.json');
// Allow verifying a non-default runtime dir (e.g. the freshly-built one in
// runtime-build/ before it's swapped in):  VAPORMINT_RUNTIME=<dir> node ...
const rt = process.env.VAPORMINT_RUNTIME
  ? (path.isAbsolute(process.env.VAPORMINT_RUNTIME) ? process.env.VAPORMINT_RUNTIME : path.join(root, process.env.VAPORMINT_RUNTIME))
  : path.join(root, 'runtime', 'win32-x64');
const sp = path.join(rt, 'Lib', 'site-packages');

function fail(msg) { console.error(`\nerror: ${msg}`); process.exit(2); }

let lock;
try { lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')); }
catch (e) { fail(`could not parse ${lockPath}: ${e.message}`); }

if (!fs.existsSync(sp)) fail(`site-packages not found at ${sp} — is the runtime assembled?`);
const dirs = fs.readdirSync(sp).filter(d => d.endsWith('.dist-info'));

const lines = [];
let bad = 0;
const report = (label, want, got, ok) => {
  if (!ok) bad++;
  const line = `  ${ok ? 'ok     ' : 'MISMATCH'}  ${label.padEnd(24)} want=${String(want).padEnd(10)} got=${got}`;
  lines.push(line);
  console.log(line);
};

// --- pip packages (plugins + deps) via dist-info dirs -------------------------
const actualFor = (pipName, distInfoHint) => {
  const pick = distInfoHint
    ? dirs.find(d => d.toLowerCase() === `${distInfoHint}.dist-info`.toLowerCase())
    : dirs.find(d => d.toLowerCase().startsWith(pipName.toLowerCase() + '-'));
  if (!pick) return '(missing)';
  const base = pick.replace(/\.dist-info$/, '');
  const i = base.indexOf('-');
  return i >= 0 ? base.slice(i + 1) : base;
};

console.log('pip packages (dist-info ground truth):');
for (const p of [...lock.plugins.packages, ...lock.python_deps.packages]) {
  report(p.pip, p.version, actualFor(p.pip, p.distInfo), actualFor(p.pip, p.distInfo) === p.version);
}

// VS core (pip 'vapoursynth')
{
  const got = actualFor('vapoursynth');
  report('vapoursynth (core)', lock.vapoursynth.core_version, got, got === String(lock.vapoursynth.core_version));
}

// --- non-pip tools: shell out to the real binaries and parse --version --------
const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); }
};

console.log('\nbinary tools (live --version):');
{
  // BtbN "latest" builds report as `n<version>-<rev>-g<hash>-<date>` (the leading
  // `n` = non-release/master). Compare on the release number, ignoring the prefix
  // and the git-build suffix.
  const out = run(path.join(rt, 'ffmpeg.exe'), ['-version']);
  const m = out.match(/ffmpeg version (\S+)/);
  const got = m ? m[1] : '(ffmpeg missing)';
  const want = lock.ffmpeg.version;
  const core = got.replace(/^n/, '').split('-')[0];
  report('ffmpeg', want, got, core === want || got.startsWith(want) || got === want);
}
{
  const out = run(path.join(rt, 'ffprobe.exe'), ['-version']);
  const m = out.match(/ffprobe version (\S+)/);
  const got = m ? m[1] : '(ffprobe missing)';
  const want = lock.ffmpeg.version;
  const core = got.replace(/^n/, '').split('-')[0];
  report('ffprobe', want, got, core === want || got.startsWith(want) || got === want);
}
{
  const out = run(path.join(rt, 'yt-dlp.exe'), ['--version']);
  const got = out.trim() || '(yt-dlp missing)';
  const want = lock['yt-dlp'].version;
  report('yt-dlp', want, got, got === want);
}
{
  const out = run(path.join(rt, 'python.exe'), ['--version']);
  const m = out.match(/Python (\d+\.\d+\.\d+)/);
  const got = m ? m[1] : '(python missing)';
  const want = lock.python.version;
  report('python', want, got, got === want);
}
{
  // VS core R-number via vspipe --info (the SAME path the app's getRuntimeStatus/verifyPlugins use,
  // so the check matches what the shipped app actually exercises). vs.core.version_number()
  // is the current API (vs.core().version() is deprecated and returns the lib name).
  const rtAbs = path.resolve(rt);
  const vspipe = path.join(rtAbs, 'Lib', 'site-packages', 'vapoursynth', 'vspipe.exe');
  const tmp = path.join(require('node:os').tmpdir(), `vapormint-vscheck-${process.pid}.vpy`);
  fs.writeFileSync(tmp, 'import vapoursynth as vs\nprint("VSNUM=" + str(vs.core.version_number()))\n', 'utf8');
  let got = '(vspipe missing)';
  try {
    const out = execFileSync(vspipe, ['--info', tmp, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const m = out.match(/VSNUM=(\d+)/);
    if (m) got = `R${m[1]}`;
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    const m = out.match(/VSNUM=(\d+)/);
    if (m) got = `R${m[1]}`; else got = '(vspipe failed)';
  } finally { try { fs.unlinkSync(tmp); } catch { /* ignore */ } }
  const want = lock.vapoursynth.core;
  report('vapoursynth core (vspipe)', want, got, got === want);
}

console.log('');
if (bad === 0) {
  console.log('runtime/lock.json matches the installed runtime. Safe to build.');
  process.exit(0);
} else {
  console.log(`${bad} mismatch(es) between runtime/lock.json and the installed runtime.`);
  process.exit(1);
}
