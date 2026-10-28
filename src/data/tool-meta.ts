// Presentation metadata for every tool: original line icons, an accent colour,
// search keywords (including common Indian phrasing) and action wording.
type Meta = {
  icon: string;
  color: string;
  keywords: string;
  action: string;
  done: string;
};

const doc = '<path d="M6 2.8h8.4L19 7.4v13.8H6z"/><path d="M14.2 2.8v4.8H19"/>';
const teal = '#14858c',
  coral = '#e0603f',
  amber = '#c98a12',
  violet = '#7259d0',
  blue = '#2b78c9',
  pink = '#c9487f',
  green = '#2f8f55',
  slate = '#4c6870';
const label = (text: string, y = 17.6) =>
  `<text x="12.5" y="${y}" text-anchor="middle" font-size="7" font-weight="800" stroke="none" fill="currentColor" letter-spacing=".2">${text}</text>`;

export const toolMeta: Record<string, Meta> = {
  'image-compressor': {
    icon: '<path d="M4 14h6v6M20 10h-6V4M14 10l6.5-6.5M3.5 20.5 10 14"/>',
    color: teal,
    keywords:
      'reduce size kb shrink smaller jpg png photo compress 20kb 50kb 100kb image size kam',
    action: 'Compress image',
    done: 'Your image has been compressed!',
  },
  'image-resizer': {
    icon: '<rect x="3" y="9.5" width="11.5" height="11.5" rx="2.5"/><path d="M13 3h8v8M21 3l-8.5 8.5"/>',
    color: blue,
    keywords:
      'resize dimension pixels width height scale passport photo signature exam form',
    action: 'Resize image',
    done: 'Your image has been resized!',
  },
  'convert-to-jpg': {
    icon:
      '<rect x="3" y="4" width="18" height="16" rx="4"/>' + label('JPG', 14.6),
    color: amber,
    keywords: 'png to jpg webp to jpg heic svg tiff gif to jpeg convert',
    action: 'Convert to JPG',
    done: 'Your image is now a JPG!',
  },
  'image-converter': {
    icon: '<path d="M4 8.5h13.5L14 5M20 15.5H6.5L10 19"/>',
    color: violet,
    keywords: 'convert format webp png jpg avif change extension',
    action: 'Convert image',
    done: 'Your image has been converted!',
  },
  'convert-from-jpg': {
    icon:
      '<rect x="3" y="4" width="18" height="16" rx="4"/>' + label('GIF', 14.6),
    color: pink,
    keywords: 'jpg to png jpg to gif animated gif maker slideshow',
    action: 'Convert images',
    done: 'Your images are converted!',
  },
  'meme-generator': {
    icon: '<circle cx="12" cy="12" r="9"/><path d="M7.8 13.5c.9 2.3 2.3 3.4 4.2 3.4s3.3-1.1 4.2-3.4zM8.5 9.8l1.6-1M15.5 9.8l-1.6-1"/>',
    color: amber,
    keywords: 'meme caption funny text top bottom',
    action: 'Create meme',
    done: 'Your meme is ready!',
  },
  'photo-editor': {
    icon: '<path d="m4.5 19.5 10-10 1.9 1.9-10 10z"/><path d="m15 3.5.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7zM19.5 9.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/>',
    color: pink,
    keywords: 'edit photo filter text frame sticker brightness contrast',
    action: 'Save photo',
    done: 'Your photo is ready!',
  },
  'crop-image': {
    icon: '<path d="M6.5 2.5v13a2 2 0 0 0 2 2h13M2.5 6.5h13a2 2 0 0 1 2 2v13"/>',
    color: green,
    keywords: 'crop cut trim square aspect ratio',
    action: 'Crop image',
    done: 'Your image has been cropped!',
  },
  'rotate-image': {
    icon: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 3.5v4.2h-4.2"/><rect x="9" y="9.5" width="6" height="5" rx="1.2"/>',
    color: teal,
    keywords: 'rotate turn flip sideways orientation',
    action: 'Rotate & flip images',
    done: 'Your images have been rotated!',
  },
  'html-to-image': {
    icon: '<path d="m8.5 7.5-4.5 4.5 4.5 4.5M15.5 7.5l4.5 4.5-4.5 4.5M13.2 5.5l-2.4 13"/>',
    color: slate,
    keywords: 'html code to png screenshot snippet',
    action: 'Render image',
    done: 'Your image is ready!',
  },
  'watermark-image': {
    icon: '<path d="M12 3.2s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/><path d="M9.5 15.2a2.6 2.6 0 0 0 2.5 2.3"/>',
    color: blue,
    keywords: 'watermark logo text copyright stamp protect photo',
    action: 'Add watermark',
    done: 'Your watermark has been added!',
  },
  'remove-image-metadata': {
    icon: '<path d="M5 6.5h14v11H5z"/><path d="m7.5 15 3-3.2 2.2 2.2 1.6-1.6 2.2 2.6"/><path d="M4 20 20 4"/>',
    color: violet,
    keywords:
      'remove exif metadata strip gps location photo privacy camera details clean image data',
    action: 'Remove metadata',
    done: 'Your clean images are ready!',
  },
  'favicon-generator': {
    icon: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M4 9h16"/><rect x="6.5" y="11.5" width="4.5" height="4.5" rx="1"/>',
    color: amber,
    keywords:
      'favicon generator ico icon apple touch icon website logo tab icon manifest png 16x16 32x32',
    action: 'Generate favicons',
    done: 'Your favicons are ready!',
  },
  'image-size-checker': {
    icon: '<path d="M5 6.5h14v11H5z"/><path d="M8 10h3M8 13h6"/><circle cx="17.5" cy="17.5" r="2.8"/><path d="m19.6 19.6 1.9 1.9"/>',
    color: slate,
    keywords:
      'image size checker dimensions resolution kb mb file size width height megapixels aspect ratio exif viewer info',
    action: 'Check image',
    done: 'Here are your image details',
  },
  'blur-face': {
    icon: '<circle cx="12" cy="12" r="9" stroke-dasharray="2.4 2.6"/><path d="M9 10.2h.01M15 10.2h.01M9.2 15h5.6"/>',
    color: violet,
    keywords: 'blur face hide privacy pixelate number plate',
    action: 'Blur image',
    done: 'Your image has been blurred!',
  },
  upscale: {
    icon: '<path d="M12 20V8.5M7 13.5l5-5 5 5M5 4h14"/>',
    color: green,
    keywords:
      'upscale enhance increase resolution hd enlarge ai upscaler sharpen',
    action: 'Upscale image',
    done: 'Your image has been upscaled!',
  },
  'jpg-to-pdf': {
    icon:
      doc +
      '<path d="m8.5 17.5 2.6-3 1.9 2 1.3-1.4 1.7 2.4z"/><circle cx="10.3" cy="11.5" r="1"/>',
    color: amber,
    keywords: 'jpg to pdf image to pdf photo to pdf documents upload',
    action: 'Convert to PDF',
    done: 'Your PDF is ready!',
  },
  'merge-pdf': {
    icon: '<path d="M6 3v4.5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3M12 13.5v7.5M8.8 18l3.2 3.2 3.2-3.2"/>',
    color: coral,
    keywords: 'merge combine join pdf files into one',
    action: 'Merge PDF',
    done: 'Your PDFs have been merged!',
  },
  'compress-pdf': {
    icon:
      doc +
      '<path d="M12.5 9.5v3M11 11l1.5 1.5L14 11M12.5 18.5v-3M11 17l1.5-1.5L14 17"/>',
    color: green,
    keywords: 'compress pdf reduce pdf size kb mb smaller',
    action: 'Compress PDF',
    done: 'Your PDF has been compressed!',
  },
  'pdf-to-jpg': {
    icon: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="m6.5 16 3.5-4 2.6 2.8 1.9-2 3 3.2"/><circle cx="15.5" cy="8.6" r="1.3"/>',
    color: amber,
    keywords: 'pdf to jpg pdf to image png pages',
    action: 'Convert to JPG',
    done: 'Your images are ready!',
  },
  'font-finder': {
    icon: '<path d="M3.5 17.5 7.6 6.5h.8l4.1 11M5 13.8h6"/><circle cx="16.8" cy="15" r="3.2"/><path d="m19.2 17.4 2.3 2.3"/>',
    color: violet,
    keywords: 'font finder identify font what font is this typeface',
    action: 'Find font',
    done: 'Here are the closest fonts!',
  },
  'split-pdf': {
    icon: '<circle cx="6" cy="6.2" r="2.8"/><circle cx="6" cy="17.8" r="2.8"/><path d="M20.5 4.5 8.2 15.8M14.6 14.4l5.9 5.1M8.2 8.2l3.6 3.3"/>',
    color: coral,
    keywords: 'split pdf separate pages divide',
    action: 'Split PDF',
    done: 'Your PDF has been split!',
  },
  'remove-pages': {
    icon: doc + '<path d="M9.5 14.5h6"/>',
    color: coral,
    keywords: 'remove delete pages from pdf',
    action: 'Remove pages',
    done: 'Pages removed!',
  },
  'extract-pages': {
    icon: doc + '<path d="M12.5 18v-6.5M10 14l2.5-2.5L15 14"/>',
    color: blue,
    keywords: 'extract pages save selected pages pdf',
    action: 'Extract pages',
    done: 'Pages extracted!',
  },
  'organize-pdf': {
    icon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><path d="M14 17h6M17 14v6"/>',
    color: violet,
    keywords: 'organize reorder sort pages pdf arrange',
    action: 'Organize PDF',
    done: 'Your PDF has been organized!',
  },
  'scan-to-pdf': {
    icon: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M3 12h18"/>',
    color: teal,
    keywords: 'scan camera phone document to pdf',
    action: 'Create PDF',
    done: 'Your scan is ready!',
  },
  'repair-pdf': {
    icon: '<path d="M14.6 6.1a4 4 0 0 0-5.2 5.2L3.8 17a1.9 1.9 0 0 0 2.7 2.7l5.6-5.6a4 4 0 0 0 5.2-5.2l-2.5 2.5-2.3-.4-.4-2.3z"/>',
    color: green,
    keywords: 'repair fix broken pdf',
    action: 'Repair PDF',
    done: 'Your PDF has been rewritten!',
  },
  'html-to-pdf': {
    icon: doc + '<path d="m10.3 12-2 2 2 2M14.7 12l2 2-2 2"/>',
    color: slate,
    keywords: 'html to pdf code webpage',
    action: 'Create PDF',
    done: 'Your PDF is ready!',
  },
  'odt-to-pdf': {
    icon: doc + label('ODT'),
    color: blue,
    keywords:
      'odt to pdf libreoffice openoffice writer opendocument odf fodt ott document convert',
    action: 'Convert to PDF',
    done: 'Your PDF is ready!',
  },
  'pdf-to-text': {
    icon: doc + '<path d="M9 11h7M12.5 11v7"/>',
    color: blue,
    keywords: 'pdf to text markdown extract text copy',
    action: 'Extract text',
    done: 'Your text is ready!',
  },
  'rotate-pdf': {
    icon:
      doc +
      '<path d="M16 15a3.4 3.4 0 1 1-1-2.4"/><path d="M15.4 10.8v2.1h-2.1"/>',
    color: teal,
    keywords: 'rotate pdf pages turn',
    action: 'Rotate PDF',
    done: 'Your PDF has been rotated!',
  },
  'page-numbers': {
    icon:
      doc +
      '<path d="M10.5 11.5 9.8 18M14.2 11.5l-.7 6.5M8.8 13.6h6.4M8.4 16.2h6.4"/>',
    color: amber,
    keywords: 'add page numbers pdf numbering',
    action: 'Add page numbers',
    done: 'Page numbers added!',
  },
  'watermark-pdf': {
    icon: '<path d="M9.3 3.5h5.4l-1 7.5h4.4l1.1 4.5H5.8L6.9 11h4.4zM5.5 19.5h13"/>',
    color: blue,
    keywords: 'watermark pdf stamp confidential draft',
    action: 'Add watermark',
    done: 'Your watermark has been added!',
  },
  'crop-pdf': {
    icon: '<path d="M6.5 2.5v13a2 2 0 0 0 2 2h13M2.5 6.5h13a2 2 0 0 1 2 2v13"/><path d="M10.5 10.5h3v3h-3z"/>',
    color: green,
    keywords: 'crop pdf margins trim',
    action: 'Crop PDF',
    done: 'Your PDF has been cropped!',
  },
  'edit-pdf': {
    icon: doc + '<path d="m9 18.5.6-2.6 5.1-5.1 2 2-5.1 5.1z"/>',
    color: pink,
    keywords: 'edit pdf add text image shapes annotate draw',
    action: 'Save PDF',
    done: 'Your edits have been saved!',
  },
  'pdf-forms': {
    icon:
      doc +
      '<path d="m8.6 12.2 1.1 1.1 1.9-2M13.2 12h3M8.6 16.8l1.1 1.1 1.9-2M13.2 16.6h3"/>',
    color: violet,
    keywords: 'fill pdf form fields',
    action: 'Save form',
    done: 'Your form has been filled!',
  },
  'unlock-pdf': {
    icon: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 7.6-1.7M12 14.5v2.5"/>',
    color: amber,
    keywords: 'unlock pdf remove password aadhaar e-aadhaar open',
    action: 'Unlock PDF',
    done: 'Your PDF has been unlocked!',
  },
  'sign-pdf': {
    icon: '<path d="M3 17.5c2.2-3.6 3.6-9 5.7-9 2.6 0-.8 8.4 1.6 8.4 1.5 0 2.4-3.4 3.7-3.4 1.2 0 .9 2.4 2.1 2.4.9 0 1.6-1 2.4-1.9M3 20.5h18"/>',
    color: teal,
    keywords: 'sign pdf signature esign',
    action: 'Sign PDF',
    done: 'Your PDF has been signed!',
  },
  'redact-pdf': {
    icon: doc + '<path d="M8.5 11h8M8.5 14h8M8.5 17h5" stroke-width="2.4"/>',
    color: slate,
    keywords: 'redact black out hide sensitive pdf',
    action: 'Redact PDF',
    done: 'Your PDF has been redacted!',
  },
  'compare-pdf': {
    icon: '<rect x="3" y="3.5" width="7.5" height="17" rx="1.8"/><rect x="13.5" y="3.5" width="7.5" height="17" rx="1.8"/><path d="M5.5 8h2.5M5.5 11h2.5M16 8h2.5M16 11h2.5"/>',
    color: coral,
    keywords: 'compare pdf difference two pdf',
    action: 'Compare PDFs',
    done: 'Comparison ready!',
  },
  'ocr-pdf': {
    icon: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M8 9h8M12 9v7"/>',
    color: green,
    keywords: 'ocr scan text recognize searchable scanned pdf',
    action: 'Make searchable',
    done: 'Your PDF is now searchable!',
  },
  'word-to-pdf': {
    icon: doc + label('W'),
    color: blue,
    keywords: 'word docx to pdf',
    action: 'Convert',
    done: 'Done',
  },
  'powerpoint-to-pdf': {
    icon: doc + label('P'),
    color: coral,
    keywords: 'powerpoint ppt pptx to pdf',
    action: 'Convert',
    done: 'Done',
  },
  'excel-to-pdf': {
    icon: doc + label('X'),
    color: green,
    keywords: 'excel xlsx to pdf',
    action: 'Convert',
    done: 'Done',
  },
  'pdf-to-word': {
    icon: doc + label('W'),
    color: blue,
    keywords: 'pdf to word docx',
    action: 'Convert',
    done: 'Done',
  },
  'pdf-to-powerpoint': {
    icon: doc + label('P'),
    color: coral,
    keywords: 'pdf to powerpoint ppt',
    action: 'Convert',
    done: 'Done',
  },
  'pdf-to-excel': {
    icon: doc + label('X'),
    color: green,
    keywords: 'pdf to excel xlsx table',
    action: 'Convert',
    done: 'Done',
  },
  'pdf-a': {
    icon: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
    color: slate,
    keywords: 'pdf/a archive',
    action: 'Convert',
    done: 'Done',
  },
  'protect-pdf': {
    icon: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 14.5v2.5"/>',
    color: violet,
    keywords: 'protect pdf password encrypt lock secure',
    action: 'Protect PDF',
    done: 'Your PDF is password-protected!',
  },
  'summarize-pdf': {
    icon:
      doc +
      '<path d="M9 12h6M9 15h4M15.5 15.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/>',
    color: pink,
    keywords: 'summarize pdf ai summary',
    action: 'Summarize',
    done: 'Done',
  },
  'translate-pdf': {
    icon: '<path d="M3.5 5.5h9M8 3.5v2M5.5 5.5c.8 3.4 3 5.8 6 7M10.5 5.5c-.9 3.6-3 6.3-6.4 8.2M12.5 20.5l4-9.5 4 9.5M14 17h5"/>',
    color: teal,
    keywords: 'translate pdf language hindi english',
    action: 'Translate',
    done: 'Done',
  },
  'video-converter': {
    icon: '<path d="M4 8.5h13.5L14 5M20 15.5H6.5L10 19"/><path d="M9.2 10.6v2.8l2.4-1.4z" />',
    color: coral,
    keywords: 'convert video mp4 webm mov mkv avi format change container',
    action: 'Convert video',
    done: 'Your video has been converted!',
  },
  'compress-video': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7.5 12h3M10.5 12l-1.6-1.6M10.5 12l-1.6 1.6M16.5 12h-3M13.5 12l1.6-1.6M13.5 12l1.6 1.6"/>',
    color: coral,
    keywords: 'compress video reduce size smaller mp4 whatsapp email mb shrink',
    action: 'Compress video',
    done: 'Your video has been compressed!',
  },
  'trim-video': {
    icon: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5 20 16M8 15.5 20 8"/>',
    color: coral,
    keywords: 'trim video cut clip start end shorten',
    action: 'Trim video',
    done: 'Your video has been trimmed!',
  },
  'mute-video': {
    icon: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>',
    color: coral,
    keywords: 'mute video remove audio sound silent no sound',
    action: 'Mute video',
    done: 'Your video is now silent!',
  },
  'resize-video': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15.5l4-4M7 12.5v3h3M17 8.5l-3.5 3.5M17 11.5v-3h-3"/>',
    color: coral,
    keywords: 'resize video resolution 1080p 720p 480p scale dimensions',
    action: 'Resize video',
    done: 'Your video has been resized!',
  },
  'crop-video': {
    icon: '<path d="M7 3v14h14"/><path d="M3 7h14v14"/>',
    color: coral,
    keywords:
      'crop video square vertical 9:16 reels shorts tiktok instagram 1:1 aspect ratio',
    action: 'Crop video',
    done: 'Your video has been cropped!',
  },
  'rotate-video': {
    icon: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/><path d="M10.3 9.4v5.2l4.3-2.6z"/>',
    color: coral,
    keywords: 'rotate video turn sideways flip mirror 90 180',
    action: 'Rotate video',
    done: 'Your video has been rotated!',
  },
  'change-speed': {
    icon: '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 13.5l4-4.5"/><circle cx="12" cy="14" r="1.2"/>',
    color: coral,
    keywords:
      'speed up slow down video audio fast slow motion timelapse 2x 0.5x playback',
    action: 'Change speed',
    done: 'The speed has been changed!',
  },
  'reverse-video': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M14.2 9.4v5.2l-4.3-2.6z"/>',
    color: coral,
    keywords: 'reverse video backwards rewind play backward',
    action: 'Reverse video',
    done: 'Your video now plays backwards!',
  },
  'boomerang-video': {
    icon: '<path d="M7 9.5c-2.5 0-4 1.2-4 2.5s1.5 2.5 4 2.5c3.5 0 6.5-5 10-5 2.5 0 4 1.2 4 2.5s-1.5 2.5-4 2.5c-3.5 0-6.5-5-10-5z"/>',
    color: coral,
    keywords: 'boomerang loop video forward backward ping pong instagram',
    action: 'Make boomerang',
    done: 'Your boomerang is ready!',
  },
  'video-to-gif': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><text x="12" y="14.4" text-anchor="middle" font-size="6.6" font-weight="800" stroke="none" fill="currentColor" letter-spacing=".2">GIF</text>',
    color: coral,
    keywords: 'video to gif mp4 to gif animated gif maker convert clip',
    action: 'Convert to GIF',
    done: 'Your GIF is ready!',
  },
  'gif-to-mp4': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><text x="12" y="14.4" text-anchor="middle" font-size="6.6" font-weight="800" stroke="none" fill="currentColor" letter-spacing=".2">MP4</text>',
    color: coral,
    keywords: 'gif to mp4 video convert animated gif smaller',
    action: 'Convert to MP4',
    done: 'Your video is ready!',
  },
  'extract-audio': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M12 9v7M9.5 13.5 12 16l2.5-2.5"/>',
    color: coral,
    keywords:
      'extract audio from video mp4 to mp3 video to mp3 soundtrack sound rip',
    action: 'Extract audio',
    done: 'Your audio is ready!',
  },
  'video-to-images': {
    icon: '<rect x="3" y="3.5" width="8" height="7" rx="1.8"/><rect x="13" y="3.5" width="8" height="7" rx="1.8"/><rect x="3" y="13.5" width="8" height="7" rx="1.8"/><rect x="13" y="13.5" width="8" height="7" rx="1.8"/>',
    color: coral,
    keywords:
      'video to images frames jpg png screenshots extract frames video to jpg',
    action: 'Extract images',
    done: 'Your images are ready!',
  },
  'join-videos': {
    icon: '<rect x="2.5" y="7" width="8" height="10" rx="2"/><rect x="13.5" y="7" width="8" height="10" rx="2"/><path d="M10.5 12h3"/>',
    color: coral,
    keywords: 'join merge combine videos concatenate one video',
    action: 'Join videos',
    done: 'Your videos have been joined!',
  },
  'replace-audio': {
    icon: '<path d="M9 18.5V6.5l10-2v12"/><circle cx="6.8" cy="18.5" r="2.2"/><circle cx="16.8" cy="16.5" r="2.2"/>',
    color: coral,
    keywords:
      'replace audio add music to video voice over background music change sound',
    action: 'Replace audio',
    done: 'Your video has new audio!',
  },
  'split-video': {
    icon: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M9 4v16M15 4v16" stroke-dasharray="2 2"/>',
    color: coral,
    keywords:
      'split video cut into parts segments pieces whatsapp status 30 seconds',
    action: 'Split video',
    done: 'Your video has been split!',
  },
  'extract-subtitles': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M6.5 13.5h4M12.5 13.5h5M6.5 16h7"/>',
    color: coral,
    keywords: 'extract subtitles srt vtt mkv mp4 captions track',
    action: 'Extract subtitles',
    done: 'Your subtitles are ready!',
  },
  'subtitle-converter': {
    icon: '<path d="M6 2.8h8.4L19 7.4v13.8H6z"/><path d="M14.2 2.8v4.8H19"/><text x="12" y="16.6" text-anchor="middle" font-size="6.6" font-weight="800" stroke="none" fill="currentColor" letter-spacing=".2">SRT</text>',
    color: coral,
    keywords:
      'subtitle converter srt to vtt vtt to srt ass resync shift timing captions delay',
    action: 'Convert subtitles',
    done: 'Your subtitles are ready!',
  },
  'video-contact-sheet': {
    icon: '<rect x="3" y="3.5" width="18" height="17" rx="3"/><path d="M3 9.2h18M3 14.8h18M9 3.5v17M15 3.5v17"/>',
    color: coral,
    keywords:
      'video contact sheet thumbnails grid preview storyboard screenshots',
    action: 'Make contact sheet',
    done: 'Your contact sheet is ready!',
  },
  'repair-video': {
    icon: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.2 2.2 0 0 1-3-3l7.5-7.5"/><path d="M5 4l3 3M4 8h3M8 3v3"/>',
    color: coral,
    keywords: 'repair video fix corrupted broken mp4 not playing recover',
    action: 'Repair video',
    done: 'Your video has been rebuilt!',
  },
  'burn-subtitles': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15h4M13 15h4M7 12h7"/>',
    color: coral,
    keywords:
      'burn subtitles hardcode hard subs open captions add subtitles to video permanently srt vtt ass embed',
    action: 'Burn subtitles',
    done: 'Your subtitles are now part of the video!',
  },
  'watermark-video': {
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M14 15.5h4.5v-2.5H14z"/>',
    color: coral,
    keywords: 'watermark video logo overlay brand image on video',
    action: 'Add watermark',
    done: 'Your video has been watermarked!',
  },
  'audio-converter': {
    icon: '<path d="M4 8.5h13.5L14 5M20 15.5H6.5L10 19"/><path d="M11 10.5v2.6"/><circle cx="10.2" cy="13.3" r=".9"/>',
    color: blue,
    keywords:
      'audio converter mp3 wav m4a ogg flac opus aiff convert sound music',
    action: 'Convert audio',
    done: 'Your audio has been converted!',
  },
  'trim-audio': {
    icon: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/><path d="M5 3.5v17M19 3.5v17" stroke-dasharray="1.5 2"/>',
    color: blue,
    keywords: 'trim audio cut mp3 ringtone shorten clip',
    action: 'Trim audio',
    done: 'Your audio has been trimmed!',
  },
  'join-audio': {
    icon: '<path d="M2.5 12h1.5M5.5 9v6M8.5 7v10M15.5 7v10M18.5 9v6M20 12h1.5M10.5 12h3"/>',
    color: blue,
    keywords: 'join merge combine audio mp3 songs concatenate',
    action: 'Join audio',
    done: 'Your audio files have been joined!',
  },
  'split-audio': {
    icon: '<path d="M3 12h1.5M6 9v6M9 6.5v11M15 6.5v11M18 9v6M19.5 12H21"/><path d="M12 3v18" stroke-dasharray="2 2"/>',
    color: blue,
    keywords: 'split audio cut into parts mp3 splitter segments',
    action: 'Split audio',
    done: 'Your audio has been split!',
  },
  'stereo-to-mono': {
    icon: '<circle cx="8" cy="12" r="4.5"/><circle cx="16" cy="12" r="4.5"/>',
    color: blue,
    keywords: 'stereo to mono convert audio one channel mix down',
    action: 'Convert to mono',
    done: 'Your audio is now mono!',
  },
  'change-volume': {
    icon: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    color: blue,
    keywords:
      'change volume louder quieter increase decrease boost audio db gain',
    action: 'Change volume',
    done: 'The volume has been changed!',
  },
  'fade-audio': {
    icon: '<path d="M3 19 9 7h6l6 12"/><path d="M3 19h18"/>',
    color: blue,
    keywords: 'fade in fade out audio music smooth start end',
    action: 'Add fades',
    done: 'Your fades have been added!',
  },
  'normalize-audio': {
    icon: '<path d="M3 12h2M7 9v6M11 9v6M15 9v6M19 9v6M21 12h0"/><path d="M3 6.5h18M3 17.5h18" stroke-dasharray="2 2"/>',
    color: blue,
    keywords:
      'normalize normalise loudness lufs ebu r128 podcast youtube volume level',
    action: 'Normalise loudness',
    done: 'Your audio has been normalised!',
  },
  'remove-silence': {
    icon: '<path d="M3 12h2.5M7.5 8v8M10.5 10v4M13.5 12h3M18.5 9v6M21 12h0"/><path d="M13.3 9.5v5M16.7 9.5v5" stroke-dasharray="1 1.5"/>',
    color: blue,
    keywords: 'remove silence cut pauses trim silent parts podcast voice',
    action: 'Remove silence',
    done: 'The silence has been removed!',
  },
  'clean-voice': {
    icon: '<path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5"/><path d="M19.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
    color: blue,
    keywords:
      'clean voice recording noise reduction remove background noise hum podcast',
    action: 'Clean up recording',
    done: 'Your recording has been cleaned up!',
  },
  'compress-gif': {
    icon: '<path d="M4 14h6v6M20 10h-6V4M14 10l6.5-6.5M3.5 20.5 10 14"/>',
    color: coral,
    keywords: 'compress gif reduce gif size smaller animated optimize',
    action: 'Compress GIF',
    done: 'Your GIF has been compressed!',
  },
  'resize-gif': {
    icon: '<rect x="3" y="9.5" width="11.5" height="11.5" rx="2.5"/><path d="M13 3h8v8M21 3l-8.5 8.5"/><text x="12" y="17.6" text-anchor="middle" font-size="6.6" font-weight="800" stroke="none" fill="currentColor" letter-spacing=".2">GIF</text>',
    color: coral,
    keywords: 'resize gif scale animated gif width smaller',
    action: 'Resize GIF',
    done: 'Your GIF has been resized!',
  },
  'gif-to-frames': {
    icon: '<rect x="6" y="3" width="13" height="10" rx="2"/><rect x="3" y="11" width="13" height="10" rx="2" />',
    color: coral,
    keywords: 'gif to frames split gif images png extract frames',
    action: 'Extract frames',
    done: 'Your frames are ready!',
  },
  'gif-maker': {
    icon: '<rect x="3" y="4" width="13" height="11" rx="2.2"/><path d="M8 19h11a2 2 0 0 0 2-2V8"/><path d="M8.2 7.7v4.6l3.8-2.3z"/>',
    color: coral,
    keywords:
      'gif maker images to gif make gif slideshow photos to video animation',
    action: 'Make animation',
    done: 'Your animation is ready!',
  },
};

export const metaFor = (id: string): Meta =>
  toolMeta[id] || {
    icon: doc,
    color: teal,
    keywords: '',
    action: 'Continue',
    done: 'Your file is ready!',
  };
