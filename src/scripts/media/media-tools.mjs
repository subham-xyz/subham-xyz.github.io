// Every video, audio and GIF tool: what it accepts and which settings it shows.
// The Astro component renders these controls; recipes.mjs turns the chosen
// values into FFmpeg commands. No option sets a size, length or batch limit.

export const VIDEO_ACCEPT =
  'video/*,.mp4,.m4v,.mov,.mkv,.webm,.avi,.wmv,.flv,.mpg,.mpeg,.ts,.m2ts,.mts,.3gp,.ogv,.vob';
export const AUDIO_ACCEPT =
  'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.aif,.aiff,.wma,.ac3,.amr,.mka';
export const GIF_ACCEPT = 'image/gif,.gif';
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp';
export const SUBTITLE_ACCEPT = '.srt,.vtt,.ass,.ssa';
const MEDIA_ACCEPT = `${VIDEO_ACCEPT},${AUDIO_ACCEPT}`;
const LOGO_ACCEPT = ['image/png', 'image/jpeg', 'image/webp', '.png', '.jpg', '.jpeg', '.webp'].join(',');

const choice = (id, label, choices, value) => ({ id, type: 'choice', label, choices, default: value ?? choices[0][0] });
const number = (id, label, value, extra = {}) => ({ id, type: 'number', label, default: value, ...extra });
const time = (id, label, value) => ({ id, type: 'time', label, default: value });
const toggle = (id, label, value = false) => ({ id, type: 'toggle', label, default: value });

const videoFormats = [
  ['mp4', 'MP4'],
  ['webm', 'WebM'],
  ['mov', 'MOV'],
  ['mkv', 'MKV'],
  ['avi', 'AVI'],
];
const audioFormats = [
  ['mp3', 'MP3'],
  ['m4a', 'M4A (AAC)'],
  ['wav', 'WAV'],
  ['ogg', 'OGG'],
  ['opus', 'Opus'],
  ['flac', 'FLAC'],
];
const positions = [
  ['top-left', 'Top left'],
  ['top-right', 'Top right'],
  ['center', 'Center'],
  ['bottom-left', 'Bottom left'],
  ['bottom-right', 'Bottom right'],
];

/** @type {Record<string, { noun: string, kind: 'video'|'audio'|'gif', accept: string, inputs: 'one'|'batch'|'ordered'|{ label: string, accept: string }[], preview?: boolean, options: any[] }>} */
export const mediaTools = {
  'video-converter': {
    noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'batch',
    options: [choice('format', 'Convert to', videoFormats)],
  },
  'compress-video': {
    noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'batch',
    options: [
      choice('quality', 'Compression', [['balanced', 'Balanced'], ['high', 'Best quality'], ['small', 'Smallest file']]),
      choice('height', 'Maximum resolution', [['keep', 'Keep'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p']]),
      number('target', 'Target size (MB, optional)', '', { min: 0.1, step: 0.1, optional: true }),
      toggle('mute', 'Remove audio'),
    ],
  },
  'trim-video': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'one', preview: true,
    options: [
      time('start', 'Start', 0),
      time('end', 'End', 'end'),
      choice('mode', 'Cut', [['exact', 'Exact (re-encodes)'], ['fast', 'Fast (nearest keyframe)']]),
    ],
  },
  'mute-video': { noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'batch', options: [] },
  'resize-video': {
    noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'batch',
    options: [
      choice('size', 'Size', [['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p'], ['2160', '4K'], ['custom', 'Custom']], '720'),
      number('width', 'Width (px)', 1280, { min: 2, step: 2, when: { size: 'custom' } }),
      number('height', 'Height (px)', 720, { min: 2, step: 2, when: { size: 'custom' } }),
    ],
  },
  'crop-video': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'one', preview: true,
    options: [choice('ratio', 'Aspect ratio', [['1:1', '1:1 square'], ['9:16', '9:16 vertical'], ['16:9', '16:9 wide'], ['4:5', '4:5 portrait'], ['4:3', '4:3']])],
  },
  'rotate-video': {
    noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'batch',
    options: [choice('turn', 'Rotate', [['cw', '90° right'], ['ccw', '90° left'], ['180', '180°'], ['hflip', 'Flip horizontal'], ['vflip', 'Flip vertical']])],
  },
  'change-speed': {
    noun: 'your video or audio files', kind: 'video', accept: MEDIA_ACCEPT, inputs: 'batch',
    options: [
      choice('speed', 'Speed', [['0.5', '0.5×'], ['0.75', '0.75×'], ['1.25', '1.25×'], ['1.5', '1.5×'], ['2', '2×'], ['3', '3×'], ['4', '4×'], ['0.25', '0.25×']], '2'),
      toggle('mute', 'Remove audio'),
    ],
  },
  'reverse-video': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'one',
    options: [toggle('audio', 'Reverse the audio too', true)],
  },
  'boomerang-video': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'one', preview: true,
    options: [time('start', 'Start', 0), number('length', 'Clip length (seconds)', 2, { min: 0.2, step: 0.1 }), choice('loops', 'Repeats', [['3', '3'], ['2', '2'], ['5', '5'], ['1', '1']])],
  },
  'video-to-gif': {
    noun: 'your video', kind: 'gif', accept: VIDEO_ACCEPT, inputs: 'one', preview: true,
    options: [
      time('start', 'Start', 0),
      time('end', 'End', 'end'),
      choice('fps', 'Frame rate', [['12', '12 fps'], ['8', '8 fps'], ['15', '15 fps'], ['24', '24 fps']]),
      choice('width', 'Width', [['480', '480 px'], ['320', '320 px'], ['640', '640 px'], ['keep', 'Original']]),
    ],
  },
  'gif-to-mp4': { noun: 'your GIFs', kind: 'gif', accept: GIF_ACCEPT, inputs: 'batch', options: [] },
  'extract-audio': {
    noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'batch',
    options: [choice('format', 'Audio format', [['mp3', 'MP3'], ['m4a', 'M4A (AAC)'], ['wav', 'WAV'], ['flac', 'FLAC'], ['original', 'Original (no re-encoding)']])],
  },
  'video-to-images': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'one',
    options: [
      choice('every', 'Save a frame', [['1', 'Every second'], ['5', 'Every 5 seconds'], ['10', 'Every 10 seconds'], ['0.5', 'Twice a second'], ['all', 'Every frame']]),
      choice('format', 'Image format', [['jpg', 'JPG'], ['png', 'PNG']]),
    ],
  },
  'join-videos': {
    noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'ordered',
    options: [],
  },
  'replace-audio': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT,
    inputs: [{ label: 'Video', accept: VIDEO_ACCEPT }, { label: 'New audio', accept: MEDIA_ACCEPT }],
    options: [choice('mode', 'Audio', [['replace', 'Replace the original'], ['mix', 'Mix with the original']])],
  },
  'split-video': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'one',
    options: [
      choice('by', 'Split', [['seconds', 'Every N seconds'], ['parts', 'Into equal parts']]),
      number('seconds', 'Length of each part (seconds)', 60, { min: 1, step: 1, when: { by: 'seconds' } }),
      number('parts', 'Number of parts', 2, { min: 2, step: 1, when: { by: 'parts' } }),
      choice('mode', 'Cut', [['fast', 'Fast (nearest keyframe)'], ['exact', 'Exact (re-encodes)']]),
    ],
  },
  'extract-subtitles': {
    noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'batch',
    options: [choice('format', 'Subtitle format', [['srt', 'SRT'], ['vtt', 'WebVTT']])],
  },
  'subtitle-converter': {
    noun: 'your subtitle files', kind: 'video', accept: SUBTITLE_ACCEPT, inputs: 'batch',
    options: [choice('format', 'Convert to', [['srt', 'SRT'], ['vtt', 'WebVTT'], ['ass', 'ASS']]), number('offset', 'Shift timing (seconds, + later, − earlier)', 0, { step: 0.1 })],
  },
  'burn-subtitles': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT,
    inputs: [{ label: 'Video', accept: VIDEO_ACCEPT }, { label: 'Subtitle file', accept: SUBTITLE_ACCEPT }],
    options: [
      choice('size', 'Text size', [['medium', 'Medium'], ['small', 'Small'], ['large', 'Large']]),
      choice('position', 'Position', [['bottom', 'Bottom'], ['top', 'Top']]),
    ],
  },
  'video-contact-sheet': {
    noun: 'your videos', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'batch',
    options: [choice('grid', 'Grid', [['4x4', '4 × 4'], ['3x3', '3 × 3'], ['5x5', '5 × 5'], ['4x6', '4 × 6']]), choice('width', 'Thumbnail width', [['320', '320 px'], ['240', '240 px'], ['480', '480 px']])],
  },
  'repair-video': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT, inputs: 'one',
    options: [choice('mode', 'Repair', [['remux', 'Rebuild the container (lossless)'], ['reencode', 'Re-encode the readable frames']])],
  },
  'watermark-video': {
    noun: 'your video', kind: 'video', accept: VIDEO_ACCEPT,
    inputs: [{ label: 'Video', accept: VIDEO_ACCEPT }, { label: 'Logo image', accept: LOGO_ACCEPT }],
    options: [choice('position', 'Position', positions, 'bottom-right'), number('size', 'Logo width (% of video)', 15, { min: 1, max: 100, step: 1 }), number('opacity', 'Opacity (%)', 80, { min: 1, max: 100, step: 1 })],
  },
  'audio-converter': {
    noun: 'your audio files', kind: 'audio', accept: MEDIA_ACCEPT, inputs: 'batch',
    options: [choice('format', 'Convert to', [...audioFormats, ['aiff', 'AIFF']]), choice('quality', 'Quality', [['standard', 'Standard'], ['high', 'High'], ['small', 'Smaller file']])],
  },
  'trim-audio': {
    noun: 'your audio file', kind: 'audio', accept: AUDIO_ACCEPT, inputs: 'one', preview: true,
    options: [time('start', 'Start', 0), time('end', 'End', 'end'), toggle('fade', 'Soft fade at the cut points')],
  },
  'join-audio': {
    noun: 'your audio files', kind: 'audio', accept: AUDIO_ACCEPT, inputs: 'ordered',
    options: [choice('format', 'Save as', audioFormats)],
  },
  'split-audio': {
    noun: 'your audio file', kind: 'audio', accept: AUDIO_ACCEPT, inputs: 'one',
    options: [
      choice('by', 'Split', [['seconds', 'Every N seconds'], ['parts', 'Into equal parts']]),
      number('seconds', 'Length of each part (seconds)', 60, { min: 1, step: 1, when: { by: 'seconds' } }),
      number('parts', 'Number of parts', 2, { min: 2, step: 1, when: { by: 'parts' } }),
    ],
  },
  'stereo-to-mono': { noun: 'your audio files', kind: 'audio', accept: MEDIA_ACCEPT, inputs: 'batch', options: [] },
  'change-volume': {
    noun: 'your audio files', kind: 'audio', accept: MEDIA_ACCEPT, inputs: 'batch',
    options: [number('gain', 'Change (dB, + louder, − quieter)', 6, { min: -60, max: 60, step: 1 }), toggle('limit', 'Prevent clipping', true)],
  },
  'fade-audio': {
    noun: 'your audio files', kind: 'audio', accept: MEDIA_ACCEPT, inputs: 'batch',
    options: [number('in', 'Fade in (seconds)', 2, { min: 0, step: 0.5 }), number('out', 'Fade out (seconds)', 3, { min: 0, step: 0.5 })],
  },
  'normalize-audio': {
    noun: 'your audio files', kind: 'audio', accept: MEDIA_ACCEPT, inputs: 'batch',
    options: [choice('target', 'Loudness target', [['-14', '−14 LUFS (streaming, YouTube)'], ['-16', '−16 LUFS (podcasts)'], ['-23', '−23 LUFS (broadcast EBU R128)'], ['custom', 'Custom']]), number('custom', 'Target (LUFS)', -16, { min: -70, max: -5, step: 0.5, when: { target: 'custom' } })],
  },
  'remove-silence': {
    noun: 'your audio files', kind: 'audio', accept: MEDIA_ACCEPT, inputs: 'batch',
    options: [
      choice('where', 'Remove', [['all', 'All long pauses'], ['edges', 'Only at the start and end']]),
      choice('threshold', 'Silence is quieter than', [['-40', '−40 dB'], ['-50', '−50 dB'], ['-30', '−30 dB']]),
      number('pause', 'Shortest pause to remove (seconds)', 1, { min: 0.1, step: 0.1, when: { where: 'all' } }),
    ],
  },
  'clean-voice': {
    noun: 'your recordings', kind: 'audio', accept: MEDIA_ACCEPT, inputs: 'batch',
    options: [choice('strength', 'Noise reduction', [['medium', 'Medium'], ['light', 'Light'], ['strong', 'Strong']]), choice('hum', 'Mains hum', [['none', 'None'], ['50', 'Remove 50 Hz'], ['60', 'Remove 60 Hz']])],
  },
  'compress-gif': {
    noun: 'your GIFs', kind: 'gif', accept: GIF_ACCEPT, inputs: 'batch',
    options: [
      choice('colors', 'Colours', [['128', '128'], ['256', '256'], ['64', '64'], ['32', '32']]),
      choice('scale', 'Size', [['100', '100%'], ['75', '75%'], ['50', '50%']]),
      choice('fps', 'Frame rate', [['keep', 'Keep'], ['15', '15 fps'], ['10', '10 fps']]),
    ],
  },
  'resize-gif': {
    noun: 'your GIFs', kind: 'gif', accept: GIF_ACCEPT, inputs: 'batch',
    options: [choice('width', 'Width', [['480', '480 px'], ['320', '320 px'], ['240', '240 px'], ['640', '640 px'], ['custom', 'Custom']]), number('custom', 'Width (px)', 400, { min: 2, step: 2, when: { width: 'custom' } })],
  },
  'gif-to-frames': {
    noun: 'your GIF', kind: 'gif', accept: GIF_ACCEPT, inputs: 'one',
    options: [choice('format', 'Image format', [['png', 'PNG'], ['jpg', 'JPG']])],
  },
  'gif-maker': {
    noun: 'your images', kind: 'gif', accept: IMAGE_ACCEPT, inputs: 'ordered',
    options: [
      choice('output', 'Make', [['gif', 'GIF'], ['mp4', 'MP4 video']]),
      number('seconds', 'Seconds per image', 0.5, { min: 0.02, step: 0.1 }),
      choice('width', 'Width', [['480', '480 px'], ['320', '320 px'], ['640', '640 px'], ['1080', '1080 px']]),
    ],
  },
};

export const defaults = (id) =>
  Object.fromEntries(mediaTools[id].options.map((o) => [o.id, o.default]));
