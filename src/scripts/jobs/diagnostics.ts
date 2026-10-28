// Developer diagnostics, opened by adding ?diagnostics to any page URL. Shows what
// the browser and device support, the media engine build, temporary storage use
// and the timing of jobs run in this tab. It never shows file names or contents.
import { device } from './device';
import { clearAll, usage } from './temp-store';
import { engineVariant } from '../media/variant.mjs';
import { size } from '../image-core.mjs';

type JobTiming = { tool: string; ms: number; inputBytes: number; outputBytes: number; ok: boolean; onDisk: boolean };

export function mountDiagnostics() {
  const host = document.getElementById('main') || document.body;
  const panel = document.createElement('details');
  panel.className = 'diagnostics';
  panel.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'Diagnostics';
  const list = document.createElement('dl');
  const jobs = document.createElement('ol');
  jobs.className = 'diagnostics-jobs';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'button secondary compact';
  clear.textContent = 'Clear temporary files';
  panel.append(summary, list, jobs, clear);
  host.append(panel);

  async function render() {
    const d = device();
    const store = await usage();
    const rows: [string, string][] = [
      ['tier', d.tier],
      ['mobile', String(d.mobile)],
      ['deviceMemory', d.memory === undefined ? 'unknown' : `${d.memory} GB`],
      ['hardwareConcurrency', String(d.cores)],
      ['workers', String(d.workers)],
      ['webAssembly', String(d.wasm)],
      ['crossOriginIsolated', String(globalThis.crossOriginIsolated === true)],
      ['mediaEngine', engineVariant()],
      ['opfs', String(d.opfs)],
      ['opfsSyncAccess', String(d.opfsSync)],
      ['webCodecs', String(d.webcodecs)],
      ['webGPU', String(d.webgpu)],
      ['shareFiles', String(d.shareFiles)],
      ['saveFilePicker', String(d.savePicker)],
      ['storageUsed', size(store.used)],
      ['storageQuota', store.quota ? size(store.quota) : 'unknown'],
    ];
    list.replaceChildren(
      ...rows.flatMap(([key, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = key;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }),
    );
  }
  addEventListener('kittysuite:job', (event) => {
    const job = (event as CustomEvent<JobTiming>).detail;
    const li = document.createElement('li');
    li.textContent = `${job.tool} · ${job.ok ? 'ok' : 'failed'} · ${(job.ms / 1000).toFixed(1)} s · in ${size(job.inputBytes)} · out ${size(job.outputBytes)} · outputs ${job.onDisk ? 'opfs' : 'memory'}`;
    jobs.append(li);
    void render();
  });
  clear.addEventListener('click', async () => {
    clear.disabled = true;
    await clearAll();
    await render();
    clear.disabled = false;
  });
  void render();
}
