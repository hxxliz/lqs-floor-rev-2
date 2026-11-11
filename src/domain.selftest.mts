import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { aspectRatio, applyLook, assertPublicVideoUrl, defaultRecipe, downloadFailureMessage, downloadCookieArguments, fitCropToAspect, frameTimingEvidence, joinTouchingClips, moveCrop, normalizeClipRange, orientedSourceDimensions, outputDimensions, pixelAdvice, readyWithRecipe, runtimeVersionArguments, safeFileName, scanEvidenceFromSamples, sourceGuidance, sourceVerdict, setCropEdge, suggestedRecipePatch, suggestedRecipes, buildReceipt, receiptFileName, previewSettingsForEvidence, previewSettingsAbsorb, runPreviewLoop, evidenceFromPreviewAnalysis, previewSettingsToRecipePatch } from './shared.ts';
import { ensurePreferenceFolders } from './storage.ts';

const storageRoot = await mkdtemp(path.join(tmpdir(), 'lqcf-storage-'));
try {
  const blocker = path.join(storageRoot, 'not-a-folder');
  await writeFile(blocker, 'blocked');
  const preferences = { libraryPath: path.join(blocker, 'projects'), downloadPath: path.join(blocker, 'downloads'), exportPath: path.join(blocker, 'exports'), expertMode: false, theme: 'dark', onboardingComplete: false } as const;
  const fallback = { ...preferences, libraryPath: path.join(storageRoot, 'projects'), downloadPath: path.join(storageRoot, 'downloads'), exportPath: path.join(storageRoot, 'exports') };
  assert.deepEqual(await ensurePreferenceFolders(preferences, fallback), fallback);
} finally {
  await rm(storageRoot, { recursive: true, force: true });
}

assert.deepEqual(normalizeClipRange(2, 1, 10, 25), { start: 1, end: 2 });
assert.deepEqual(normalizeClipRange(-4, 99, 5, 10), { start: 0, end: 5 });
assert.deepEqual(normalizeClipRange(5, 5, 5, 10), { start: 4.9, end: 5 });
const source = { width: 1920, height: 1080 };
const square = fitCropToAspect({ ...defaultRecipe(), aspectPreset: 'One-column square · 540×540' }, source.width, source.height);
assert.equal(square.masterWidth, 540);
assert.equal(square.masterHeight, 540);
assert.equal(Math.round((1 - square.cropLeft - square.cropRight) * source.width), 1080);
const requestedLayouts = [
  ['One-column landscape · 540×304', 540, 304], ['One-column square · 540×540', 540, 540], ['One-column portrait · 540×675', 540, 675], ['One-column tall portrait · 540×810', 540, 810],
  ['Two-column landscape · 268×151', 268, 151], ['Two-column square · 268×268', 268, 268], ['Two-column portrait · 268×350', 268, 350], ['Two-column tall portrait · 268×400', 268, 400],
  ['Three-column landscape · 177×100', 177, 100], ['Three-column square · 177×177', 177, 177], ['Three-column portrait · 177×250', 177, 250],
] as const;
for (const [aspectPreset, width, height] of requestedLayouts) {
  const recipe = fitCropToAspect({ ...defaultRecipe(), aspectPreset }, source.width, source.height);
  assert.deepEqual([recipe.masterWidth, recipe.masterHeight], [width, height]);
}
const resized = setCropEdge(square, 'cropLeft', 0.3, source.width, source.height);
assert.ok(Math.abs(((1 - resized.cropLeft - resized.cropRight) * source.width) / ((1 - resized.cropTop - resized.cropBottom) * source.height) - 1) < 0.001);
const bounded = setCropEdge(square, 'cropLeft', 0, source.width, source.height);
assert.ok(Math.abs(((1 - bounded.cropLeft - bounded.cropRight) * source.width) / ((1 - bounded.cropTop - bounded.cropBottom) * source.height) - 1) < 0.001);
assert.deepEqual(outputDimensions({ ...defaultRecipe(), masterSize: 'Custom', masterWidth: 600 }, 1920, 1080), { width: 600, height: 338 });
assert.deepEqual(orientedSourceDimensions(1920, 1080, 90), { width: 1080, height: 1920 });
assert.deepEqual(outputDimensions({ ...defaultRecipe(), rotation: 90 }, 1920, 1080), { width: 1080, height: 1920 });
assert.deepEqual(applyLook(defaultRecipe(), 'Soft / noisy source'), { ...defaultRecipe(), look: 'Soft / noisy source', denoise: 'Fine detail', denoiseStrength: 1.7, sharpen: 'Natural', sharpenStrength: 0.3, deband: true });
// Evidence-aware applyLook: the 'Soft / noisy source' preset WANTS deband, so it
// only fires when the brain measured banding >= 20. No analysis -> falls back to
// the preset intent (deband true). Clean source (banding 0) -> deband suppressed.
const cleanSrc = { ...defaultRecipe() };
assert.equal(applyLook(cleanSrc, 'Soft / noisy source', { banding: 0, noise: 2 } as never).deband, false);
assert.equal(applyLook(cleanSrc, 'Soft / noisy source', { banding: 30, noise: 2 } as never).deband, true);
assert.equal(applyLook(cleanSrc, 'Soft / noisy source', undefined).deband, true);
// Presets that intentionally skip deband stay off even with banding evidence.
assert.equal(applyLook(cleanSrc, 'Crisp', { banding: 60, noise: 2 } as never).deband, false);
// pixelAdvice: honest container-tag vs decoded-pixel callouts.
// Tagged interlaced but sampled progressive -> surfaces the disagreement.
const interTaggedProgressive = { hdr: 'SDR Rec.709', scanType: 'Interlaced', fieldOrder: 'tt', colorSpace: 'bt709', duration: 1, width: 1, height: 1, fps: 24, codec: 'h264', format: 'mp4', pixelFormat: 'yuv420p', bitDepth: 8, bitrate: 0, colorTransfer: 'bt709', variableFrameRate: false, qualitySummary: '', scanEvidence: { sampledWindows: 3, sampledSeconds: 9, topFirst: 0, bottomFirst: 0, progressive: 160, uncertain: 0, repeatedFields: 0, classification: 'Progressive', confidence: 'High' } } as never;
assert.match(pixelAdvice(interTaggedProgressive).join(' '), /Tagged interlaced, but the sampled frames look progressive/);
// Tagged progressive but decoded pixels show interlacing (high confidence).
const progTaggedInterlaced = { hdr: 'SDR Rec.709', scanType: 'Progressive', fieldOrder: 'tt', colorSpace: 'bt709', duration: 1, width: 1, height: 1, fps: 24, codec: 'h264', format: 'mp4', pixelFormat: 'yuv420p', bitDepth: 8, bitrate: 0, colorTransfer: 'bt709', variableFrameRate: false, qualitySummary: '', scanEvidence: { sampledWindows: 3, sampledSeconds: 9, topFirst: 160, bottomFirst: 0, progressive: 0, uncertain: 0, repeatedFields: 0, classification: 'Interlaced', confidence: 'High' } } as never;
assert.match(pixelAdvice(progTaggedInterlaced).join(' '), /Tagged progressive, but the decoded pixels show interlacing/);
// Strong banding callout.
assert.match(pixelAdvice({ banding: 70, noise: 0.76 } as never).join(' '), /Strong banding was measured/);
// Moderate noise callout.
assert.match(pixelAdvice({ noise: 14 } as never).join(' '), /Moderate-to-high noise was measured/);
// Clean source (no measured defects) produces no defect callouts.
assert.equal(pixelAdvice({ banding: 0, noise: 1 } as never).length, 0);
// HDR tag is surfaced as an explicit note.
assert.match(pixelAdvice({ hdr: 'HDR PQ' } as never).join(' '), /HDR PQ is explicitly tagged/);
// suggestedRecipes: no analysis -> single "Recommended" (recommended), no alternatives.
const noAnalysis = suggestedRecipes(undefined as never);
assert.equal(noAnalysis.length, 1);
assert.equal(noAnalysis[0].name, 'Recommended');
assert.equal(noAnalysis[0].recommended, true);
assert.deepEqual(noAnalysis[0].patch, {});
// Interlaced (high confidence) -> recommended Bwdif patch; alternatives offer Bwdif-hold-rate (when rec != Bwdif) or QTGMC Quality (when rec IS Bwdif), plus As-is.
const confirmedInt = { scanType: 'Interlaced', fieldOrder: 'tt', hdr: 'SDR Rec.709', scanEvidence: { classification: 'Interlaced', confidence: 'High', sampledWindows: 3, sampledSeconds: 9, topFirst: 150, bottomFirst: 0, progressive: 4, uncertain: 2, repeatedFields: 0 } } as never;
const intRecipes = suggestedRecipes(confirmedInt);
assert.equal(intRecipes.length, 3);
assert.equal(intRecipes[0].recommended, true);
assert.equal(intRecipes[0].name, 'Recommended');
assert.equal(intRecipes[0].patch.deinterlace, 'Bwdif');
assert.equal(intRecipes[1].name, 'QTGMC Quality');
assert.equal(intRecipes[1].confidence, 'High');
assert.equal(intRecipes[1].patch.deinterlace, 'QTGMC Quality');
assert.equal(intRecipes[2].name, 'As-is (no cleanup)');
// Progressive with a fix (noise) -> recommended Conservative + one "As-is" alternative.
const noisyProg = { scanType: 'Progressive', fieldOrder: 'tt', hdr: 'SDR Rec.709', scanEvidence: { classification: 'Progressive', confidence: 'High', sampledWindows: 3, sampledSeconds: 9, topFirst: 0, bottomFirst: 0, progressive: 150, uncertain: 2, repeatedFields: 0 }, noise: 14, banding: 0 } as never;
const noisyProgRecipes = suggestedRecipes(noisyProg);
assert.equal(noisyProgRecipes.length, 2);
assert.equal(noisyProgRecipes[0].name, 'Recommended');
assert.equal(noisyProgRecipes[1].name, 'As-is (no cleanup)');
assert.deepEqual(noisyProgRecipes[1].patch, { deinterlace: 'Off', denoise: 'Off', denoiseStrength: 0, sharpen: 'Off', sharpenStrength: 0, deband: false, motion: 'Original', colorManagement: 'Preserve' });
// Clean progressive (no fixes applied) -> single "Recommended" (no alternatives).
const cleanProg = { scanType: 'Progressive', fieldOrder: 'tt', hdr: 'SDR Rec.709', scanEvidence: { classification: 'Progressive', confidence: 'High', sampledWindows: 3, sampledSeconds: 9, topFirst: 0, bottomFirst: 0, progressive: 150, uncertain: 2, repeatedFields: 0 }, noise: 1, banding: 0 } as never;
assert.equal(suggestedRecipes(cleanProg).length, 1);
assert.deepEqual(runtimeVersionArguments('ffmpeg'), ['-version']);
assert.deepEqual(runtimeVersionArguments('ffprobe'), ['-version']);
assert.deepEqual(runtimeVersionArguments('vspipe'), ['--version']);
assert.deepEqual(runtimeVersionArguments('yt-dlp'), ['--version']);
const youtubeAuthError = 'ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication.';
assert.match(downloadFailureMessage(youtubeAuthError), /browser sign-in/i);
assert.deepEqual(downloadCookieArguments('edge'), ['--cookies-from-browser', 'edge']);
assert.deepEqual(downloadCookieArguments('none'), []);
assert.throws(() => downloadCookieArguments('chrome:C:\\secret' as never), /not supported/);
const moved = moveCrop({ ...defaultRecipe(), cropLeft: 0.1, cropRight: 0.2, cropTop: 0.2, cropBottom: 0.3 }, 0.9, -0.9);
assert.ok(Math.abs(moved.cropLeft - 0.3) < 1e-9 && Math.abs(moved.cropRight) < 1e-9 && moved.cropTop === 0 && moved.cropBottom === 0.5);
const clips = [{ id: 'a', sourceId: 's', start: 0, end: 1, completed: true, outputPath: 'old.mp4', recipe: defaultRecipe() }, { id: 'b', sourceId: 's', start: 1.02, end: 2, completed: false, recipe: defaultRecipe() }] as never[];
const joined = joinTouchingClips(clips, () => 1 / 24);
assert.equal(joined.length, 1);
assert.deepEqual({ start: joined[0].start, end: joined[0].end, completed: joined[0].completed, outputPath: joined[0].outputPath }, { start: 0, end: 2, completed: false, outputPath: undefined });
assert.equal(assertPublicVideoUrl('https://example.com/video'), 'https://example.com/video');
assert.throws(() => assertPublicVideoUrl('http://127.0.0.1/video'));
assert.equal(safeFileName('CON'), '_CON');
assert.equal(safeFileName('clip?.mov. '), 'clip-.mov');
const edited = readyWithRecipe(clips[0], { ...defaultRecipe(), sharpenStrength: 0.7 });
assert.equal(edited.completed, false);
assert.equal(edited.outputPath, undefined);
const confirmedInterlaced = { sampledWindows: 3, sampledSeconds: 9, topFirst: 150, bottomFirst: 0, progressive: 4, uncertain: 2, repeatedFields: 0, classification: 'Interlaced', confidence: 'High' } as const;
assert.deepEqual(suggestedRecipePatch({ hdr: 'HDR PQ', scanType: 'Interlaced', fieldOrder: 'tt', colorSpace: 'bt2020', duration: 1, width: 1, height: 1, fps: 24, codec: '', format: '', pixelFormat: '', bitDepth: 10, bitrate: 0, colorTransfer: '', variableFrameRate: false, scanEvidence: confirmedInterlaced, qualitySummary: '' }), { look: 'Custom', denoise: 'Off', denoiseStrength: 0, sharpen: 'Off', sharpenStrength: 0, restoration: 'Off', deband: false, motion: 'Original', deinterlace: 'Bwdif', fieldOrder: 'Top first', colorManagement: 'HDR PQ to SDR' });
const distributed = scanEvidenceFromSamples(['Multi frame detection: TFF: 60 BFF: 0 Progressive: 2 Undetermined: 0', 'Multi frame detection: TFF: 60 BFF: 0 Progressive: 1 Undetermined: 0']);
assert.equal(distributed?.classification, 'Interlaced');
assert.equal(distributed?.confidence, 'High');
assert.equal(frameTimingEvidence([[0, 1 / 24, 2 / 24, 3 / 24, 4 / 24, 5 / 24, 6 / 24, 7 / 24, 8 / 24, 9 / 24, 10 / 24, 11 / 24, 12 / 24]]).kind, 'Constant sample');
assert.equal(frameTimingEvidence([[0, .04, .08, .12, .20, .24, .28, .32, .40, .44, .48, .52, .60]]).kind, 'Variable sample');
const unknownAnalysis = { hdr: 'Unknown', scanType: 'Unknown', fieldOrder: 'unknown', colorSpace: 'Unspecified', duration: 3, width: 1920, height: 1080, fps: 30, codec: 'h264', format: 'mp4', pixelFormat: 'yuv420p', bitDepth: 8, bitrate: 1000, colorTransfer: 'unknown', variableFrameRate: false, qualitySummary: '' } as const;
const guidance = sourceGuidance(unknownAnalysis).join(' ');
assert.match(sourceVerdict(unknownAnalysis), /Cadence needs visual confirmation/);
assert.match(guidance, /Cadence needs review|Unknown cadence/);
assert.match(guidance, /Frame timing not verified/);
assert.match(guidance, /do not measure noise, sharpness/);
assert.equal(suggestedRecipePatch(unknownAnalysis).deinterlace, 'Off');
console.log('domain self-check passed');
assert.equal(aspectRatio({ ...defaultRecipe(), aspectPreset: 'Free' }), undefined);
assert.equal(aspectRatio({ ...defaultRecipe(), aspectPreset: 'One-column square · 540×540' }), 1);
assert.equal(aspectRatio({ ...defaultRecipe(), aspectPreset: 'Custom', customRatioWidth: 4, customRatioHeight: 5 }), 0.8);
assert.equal(aspectRatio({ ...defaultRecipe(), aspectPreset: 'Custom', customRatioHeight: 0 }), undefined);

// Render receipt: pure builder, stable file name, full snapshot capture.
const receiptSource = { id: 'src-1', sourcePath: 'C:\\in\\show.mkv', fileUrl: 'file://in', displayName: 'S01E01', episodeLabel: 'S01E01', progress: 0, finished: false, missing: false, sourceAnalysis: { width: 1920, height: 1080, fps: 24, duration: 120, codec: 'h264', pixelFormat: 'yuv420p10le', bitDepth: 10, hdr: 'SDR Rec.709', scanType: 'Progressive', fieldOrder: 'tt', banding: 70, noise: 1.2 } } as never;
const receiptClip = { id: 'clip-1', name: 'My Clip', start: 0, end: 10, recipe: { ...defaultRecipe(), outputFormat: 'MP4' }, completed: true } as never;
const receipt = buildReceipt({ clip: receiptClip, source: receiptSource, outputPath: 'C:\\out\\exports\\My Clip.mp4', engine: 'VapourSynth', warnings: ['A note'], vapourSynthScriptPath: 'C:\\out\\exports\\My Clip.vpy' });
assert.equal(receipt.version, 1);
assert.equal(receipt.clipId, 'clip-1');
assert.equal(receipt.clipName, 'My Clip');
assert.deepEqual(receipt.clipRange, { start: 0, end: 10 });
assert.equal(receipt.source.width, 1920);
assert.equal(receipt.source.banding, 70);
assert.equal(receipt.engine, 'VapourSynth');
assert.equal(receipt.outputs.masterPath, 'C:\\out\\exports\\My Clip.mp4');
assert.equal(receipt.outputs.vapourSynthScript, 'C:\\out\\exports\\My Clip.vpy');
assert.deepEqual(receipt.warnings, ['A note']);
assert.ok(receipt.rendered);
// Fallback + png outputs surface when present; absent when not.
const fb = buildReceipt({ clip: receiptClip, source: receiptSource, outputPath: 'x.mp4', engine: 'FFmpeg compatibility', fallbackReason: 'plugin missing', pngFramesPath: 'C:\\frames', warnings: [] });
assert.equal(fb.engine, 'FFmpeg compatibility');
assert.equal(fb.fallbackReason, 'plugin missing');
assert.equal(fb.outputs.pngFramesFolder, 'C:\\frames');
assert.equal(fb.outputs.vapourSynthScript, undefined);
assert.equal(fb.warnings.length, 0);
// receiptFileName: stable, safe, .receipt.json suffix.
assert.equal(receiptFileName({ name: 'My Clip' } as never), 'My Clip.receipt.json');
assert.equal(receiptFileName({ name: 'a/b\\c:d' } as never), 'a-b-c-d.receipt.json');
console.log('receipt self-check passed');

// ── M3: self-tuning preview loop (mirrors Rust cf-orchestration tests) ────────────
// PixelEvidence predicates.
{
  const noisy = { combPixels: 20, distinctLumaLevels: 180, neighborDiff: 6.0 };
  const s = previewSettingsForEvidence(noisy);
  assert.ok(s.denoise, 'noisy frame → denoise');
  assert.ok(!s.deinterlace, 'noise is not interlace');
  const banded = { combPixels: 0, distinctLumaLevels: 40, neighborDiff: 0.5 };
  assert.ok(previewSettingsForEvidence(banded).deband, 'low distinct levels → deband');
  assert.ok(!previewSettingsForEvidence(banded).denoise, 'banded frame is not noise');
  const clean = { combPixels: 0, distinctLumaLevels: 240, neighborDiff: 1.0 };
  const cs = previewSettingsForEvidence(clean);
  assert.ok(!cs.deinterlace && !cs.deband && !cs.denoise && !cs.sharpen, 'clean → no fixes');
  // A "soft" frame (levels>96, comb<32, low noise) is exactly the is_clean() region,
  // so for_evidence returns the clean default before the sharpen branch fires — this
  // matches the Rust logic, where soft() is only reachable when is_clean() is also true.
  const soft = { combPixels: 0, distinctLumaLevels: 120, neighborDiff: 1.0 };
  assert.ok(!previewSettingsForEvidence(soft).sharpen, 'clean-region frame → no sharpen (is_clean short-circuit)');
  const comb = { combPixels: 60, distinctLumaLevels: 200, neighborDiff: 1.0 };
  const c = previewSettingsForEvidence(comb);
  assert.ok(c.deinterlace, 'high comb → deinterlace');
  assert.ok(c.denoise, 'interlaced preview also denoise');
  assert.ok(!c.deband && !c.sharpen);
}
// Absorb is monotonic: fixes only accumulate, never revert.
{
  const none = { deinterlace: false, deband: false, denoise: false, sharpen: false };
  const some = { deinterlace: true, deband: false, denoise: true, sharpen: false };
  const merged = previewSettingsAbsorb(none, some).next;
  assert.deepEqual(merged, some);
  // Absorbing `none` into `some` changes nothing (already has the fixes).
  assert.equal(previewSettingsAbsorb(some, none).changed, false);
}
// Loop convergence: a preview that improves each round converges.
{
  const sequence = [
    { combPixels: 80, distinctLumaLevels: 200, neighborDiff: 1.0 },  // interlaced
    { combPixels: 10, distinctLumaLevels: 200, neighborDiff: 2.0 },  // clean-ish
  ];
  let i = 0;
  const result = await runPreviewLoop(
    { deinterlace: false, deband: false, denoise: false, sharpen: false },
    4,
    async () => sequence[Math.min(i++, sequence.length - 1)],
  );
  assert.ok(result.rounds.length >= 1);
  assert.ok(result.settings.deinterlace, 'loop enabled deinterlace from comb evidence');
  assert.ok(result.converged, 'loop converged once the preview measured clean');
}
// Loop stops early when no new fix fires (the fix has stabilized), not at maxRounds.
{
  const stuck = { combPixels: 80, distinctLumaLevels: 200, neighborDiff: 1.0 }; // always interlaced
  const result = await runPreviewLoop(
    { deinterlace: false, deband: false, denoise: false, sharpen: false },
    3,
    async () => stuck,
  );
  // Round 1 applies deinterlace+denoise (changed); round 2 re-derives the same → no new fix → stop.
  assert.equal(result.rounds.length, 2);
  assert.ok(!result.converged, 'never clean → report honestly');
  assert.ok(result.settings.deinterlace, 'fix still applied');
}
// Zero rounds is a no-op.
{
  const start = { deinterlace: true, deband: true, denoise: false, sharpen: false };
  const result = await runPreviewLoop(start, 0, async () => { throw new Error('should not run'); });
  assert.equal(result.rounds.length, 0);
  assert.deepEqual(result.settings, start);
}
// evidenceFromPreviewAnalysis maps brain fields onto PixelEvidence.
{
  const ev = evidenceFromPreviewAnalysis({ combPixels: 50, distinctLumaLevels: 30, noise: 3.0 });
  assert.deepEqual(ev, { combPixels: 50, distinctLumaLevels: 30, neighborDiff: 3.0 });
  const empty = evidenceFromPreviewAnalysis({});
  assert.equal(empty.combPixels, 0);
  assert.equal(empty.distinctLumaLevels, 256);
  assert.equal(empty.neighborDiff, 0);
}
// previewSettingsToRecipePatch maps converged settings onto the recipe.
{
  const patch = previewSettingsToRecipePatch({ deinterlace: true, deband: false, denoise: true, sharpen: false });
  assert.equal(patch.deinterlace, 'Bwdif');
  assert.equal(patch.deband, false);
  assert.equal(patch.denoise, 'Balanced');
  assert.equal(patch.denoiseStrength, 0.8);
  assert.equal(patch.sharpen, 'Off');
}
console.log('preview-loop self-check passed');
