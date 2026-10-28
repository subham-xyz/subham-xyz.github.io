// Plain-language explanations for FFmpeg failures, chosen from its log.
const rules = [
  [/Invalid data found when processing input|moov atom not found|could not find codec parameters|EBML header parsing failed/i,
    'This file is damaged or is not a video or audio format the engine can read. Try Repair Video, or export it again from the app that made it.'],
  [/Unknown encoder|Encoder not found|Unknown decoder|Decoder .* not found/i,
    'This codec is not available in the in-browser engine. Choose another output format.'],
  [/matches no streams|does not contain any stream|Output file .* does not contain any stream/i,
    'The file has no track of the kind this tool needs (for example, no audio track to extract).'],
  [/Could not open file|No such file or directory/i, 'The engine could not read one of the files. Choose it again.'],
  [/height not divisible by 2|width not divisible by 2/i, 'The size must use even numbers of pixels. Adjust the width or height.'],
  [/Error while opening encoder|Error initializing output stream/i,
    'The encoder could not start with these settings. Try another format or a smaller size.'],
  [/out of memory|Cannot allocate memory|memory access out of bounds|Aborted\(OOM\)/i,
    'Your browser ran out of available memory while processing this file. KittySuite does not impose a file-size limit. Try closing other tabs, choose a smaller output size, or use a desktop device.'],
];

export function explain(log, fallback = 'The file could not be processed. Check that it plays in another app, or try another output format.') {
  const text = String(log || '');
  for (const [pattern, message] of rules) if (pattern.test(text)) return message;
  return fallback;
}

/** Error carrying the engine log, so failures can be explained and retried. */
export class MediaError extends Error {
  constructor(message, log = '') {
    super(message);
    this.name = 'MediaError';
    this.log = log;
  }
}
