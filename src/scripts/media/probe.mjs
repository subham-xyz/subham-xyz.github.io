// Turns ffprobe JSON into the facts tools need (duration, size, streams).

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const rate = (v) => {
  if (!v || v === '0/0') return undefined;
  const [a, b] = String(v).split('/').map(Number);
  const r = b ? a / b : a;
  return Number.isFinite(r) && r > 0 && r < 1000 ? r : undefined;
};

/**
 * @returns {{ duration?: number, bitrate?: number, format: string,
 *   video?: { codec: string, width: number, height: number, fps?: number, rotation: number, frames?: number },
 *   audio?: { codec: string, channels: number, sampleRate?: number, bitrate?: number },
 *   audioTracks: number, subtitles: { index: number, codec: string, language?: string, title?: string }[],
 *   still: boolean }}
 */
export function mediaInfo(probe) {
  const streams = probe?.streams || [];
  const format = probe?.format || {};
  const v = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const audios = streams.filter((s) => s.codec_type === 'audio');
  const a = audios[0];
  let rotation = 0;
  if (v) {
    const matrix = (v.side_data_list || []).find((d) => d.rotation !== undefined);
    rotation = num(matrix?.rotation) ?? num(v.tags?.rotate) ?? 0;
    rotation = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  }
  const durations = [num(format.duration), num(v?.duration), num(a?.duration)].filter((d) => d > 0);
  const still = Boolean(v) && /^(png|mjpeg|bmp|webp|tiff)$/.test(v.codec_name) && !(num(format.duration) > 0.1);
  return {
    duration: durations.length ? Math.max(...durations) : undefined,
    bitrate: num(format.bit_rate),
    format: String(format.format_name || ''),
    video: v
      ? {
          codec: v.codec_name,
          width: num(v.width) || 0,
          height: num(v.height) || 0,
          fps: rate(v.avg_frame_rate) || rate(v.r_frame_rate),
          rotation,
          frames: num(v.nb_frames),
        }
      : undefined,
    audio: a
      ? {
          codec: a.codec_name,
          channels: num(a.channels) || 0,
          sampleRate: num(a.sample_rate),
          bitrate: num(a.bit_rate),
        }
      : undefined,
    audioTracks: audios.length,
    subtitles: streams
      .filter((s) => s.codec_type === 'subtitle')
      .map((s, i) => ({ index: i, codec: s.codec_name, language: s.tags?.language, title: s.tags?.title })),
    still,
  };
}

/** Display size after the rotation flag is applied (portrait phone videos). */
export function displaySize(info) {
  const v = info.video;
  if (!v) return undefined;
  return v.rotation === 90 || v.rotation === 270 ? { width: v.height, height: v.width } : { width: v.width, height: v.height };
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '–';
  // Tenths of a second only matter for short clips: 0:04.5, 1:05, 1:02:03.
  const tenths = seconds < 60;
  const total = tenths ? Math.round(Math.max(0, seconds) * 10) / 10 : Math.round(Math.max(0, seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const rest = (sec < 10 ? '0' : '') + (tenths ? sec.toFixed(1).replace(/\.0$/, '') : String(sec));
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** Parses "90", "1:30", "01:02:03.5" into seconds; undefined when invalid. */
export function parseTime(text) {
  const value = String(text ?? '').trim();
  if (!value) return undefined;
  if (!/^\d+(?::\d{1,2}){0,2}(?:[.,]\d+)?$/.test(value)) return undefined;
  const parts = value.replace(',', '.').split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}
