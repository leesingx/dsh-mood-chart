#!/usr/bin/env node
/**
 * dsh-mood-chart 安装器（幂等，可重复执行）
 *
 * 用法：
 *   node install.mjs                     # 装到默认 profile（自动探测）
 *   node install.mjs --profile web       # 指定 profile
 *   node install.mjs --link              # 不复制，直接把当前目录 link 进 profile（开发用）
 *   node install.mjs --dsh-home "D:\..." # 指定 DSH_HOME
 *
 * 做三件事：
 *   1. 把插件目录放到 <DSH_HOME>/plugins/dsh-mood-chart
 *   2. 往 <profile>/package.json 的 dependencies 里加 link: 依赖
 *   3. 把 "dsh-mood-chart" 加进 dsh.profile.bundles
 * 完成后需要重启 DSH 才生效。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (flag) => args.includes(flag);

const dshHome = path.resolve(argOf('--dsh-home') || process.env.DSH_HOME || path.join(os.homedir(), '.dsh'));
const profilesDir = path.join(dshHome, 'profiles');

if (!fs.existsSync(profilesDir)) {
  console.error(`[dsh-mood-chart] 找不到 ${profilesDir}，请先确认 DSH 已安装，或用 --dsh-home 指定。`);
  process.exit(1);
}

const wanted = argOf('--profile');
const profiles = fs.readdirSync(profilesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const profile = wanted || (profiles.includes('desktop') ? 'desktop' : profiles[0]);
if (!profile || !profiles.includes(profile)) {
  console.error(`[dsh-mood-chart] profile 不存在：${wanted || '(auto)'}；现有：${profiles.join(', ') || '(空)'}`);
  process.exit(1);
}
const profileDir = path.join(profilesDir, profile);

// ── 1. 放插件 ────────────────────────────────────────────
const target = path.join(dshHome, 'plugins', 'dsh-mood-chart');
const useLink = has('--link');

if (path.resolve(HERE) !== path.resolve(target)) {
  if (useLink) {
    try { fs.rmSync(target, { recursive: true, force: true }); } catch { /* ignore */ }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(HERE, target, 'junction');
    console.log(`[dsh-mood-chart] linked  ${target} -> ${HERE}`);
  } else {
    fs.mkdirSync(target, { recursive: true });
    for (const item of ['package.json', 'cordis.patch.yml', 'lib', 'public', 'README.md', '使用说明.md', 'LICENSE']) {
      const src = path.join(HERE, item);
      if (!fs.existsSync(src)) continue;
      fs.cpSync(src, path.join(target, item), { recursive: true, force: true });
    }
    console.log(`[dsh-mood-chart] copied  ${HERE} -> ${target}`);
  }
} else {
  console.log(`[dsh-mood-chart] already in place  ${target}`);
}

// ── 2. profile package.json ──────────────────────────────
const pkgPath = path.join(profileDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const depName = 'dsh-mood-chart';
const depValue = `link:${target.replace(/\\/g, '/')}`;
const before = JSON.stringify(pkg);

pkg.dependencies = pkg.dependencies || {};
pkg.dependencies[depName] = depValue;
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : (pkg.dsh.profile.bundles = []);
if (!bundles.includes(depName)) bundles.push(depName);

if (JSON.stringify(pkg) !== before) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`[dsh-mood-chart] patched  ${pkgPath}  (dependencies + bundles)`);
} else {
  console.log(`[dsh-mood-chart] profile already wired  ${pkgPath}`);
}

console.log('');
console.log('下一步：');
console.log('  1. 重启 DSH（插件只在启动时加载）');
console.log('  2. 打开 http://127.0.0.1:<DSH端口>/mood-star 看心情星轨（需要 dsh-mood 提供数据）');
console.log('  3. 右栏可拖滑杆改心情（写入带 6 小时保持期）');
console.log('');
console.log('可选配置（写进 profile 的 cordis.patch.yml，或本插件的 cordis.patch.yml）：');
console.log('  title: 心情星轨           # 页面标题（可选）');
console.log('  baselineV: 0 / baselineA: 0.25   # 平静基线');
console.log('  sampleMinGapMinutes: 10   # 无情绪时的补点间隔');
console.log('  posWords / negWords       # 自定义夸奖/刺人词表');
