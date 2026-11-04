/**
 * dsh-mood-chart —— 把「心情星轨」做成独立插件。
 *
 * 只负责两件事：
 *   1. 在 `/mood-star` 挂一个静态页面（三维心情曲线 + 九档对照 + 手动滑杆）
 *   2. 页面自己去调 `/mood-chart/api/*`（dsh-mood 插件提供的接口，同源）
 *
 * 这样图表和心情内核完全解耦：不装 dsh-mood 时页面照常打开，只是会提示「读不到心情数据」；
 * 装了两者各自独立升级，互不影响。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-mood-chart';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, '..', 'public');
const PREFIX = '/mood-star';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function apply(ctx, config = {}) {
  ctx.inject(['webServer'], (webCtx) => {
    const serve = (req, res) => {
      let p = '/';
      try {
        p = new URL(req.url || '/', 'http://dsh.internal').pathname;
      } catch {
        p = '/';
      }
      const rel = p === PREFIX || p === `${PREFIX}/` ? 'index.html' : p.slice(PREFIX.length + 1);
      const file = path.join(PUBLIC_DIR, rel);
      if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('not found');
        return;
      }
      try {
        const buf = fs.readFileSync(file);
        res.writeHead(200, {
          'content-type': MIME[path.extname(file)] || 'application/octet-stream',
          'cache-control': 'no-store',
          'content-length': buf.length,
        });
        res.end(buf);
      } catch (e) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(String(e?.message ?? e));
      }
    };

    try {
      const dispose = webCtx.webServer.register({ kind: 'prefix', path: PREFIX, handler: serve });
      if (typeof ctx.logger?.info === 'function') {
        ctx.logger.info(`[mood-chart] 心情星轨已挂到 ${PREFIX}（数据来自 dsh-mood 的 ${PREFIX.replace('/mood-star', '/mood-chart')}/api/*）`);
      }
      if (typeof ctx.on === 'function' && typeof dispose === 'function') {
        ctx.on('dispose', () => {
          try { dispose(); } catch { /* ignore */ }
        });
      }
    } catch (e) {
      if (typeof ctx.logger?.warn === 'function') {
        ctx.logger.warn(`[mood-chart] mount failed: ${e?.message ?? e}`);
      }
    }
  });
}
