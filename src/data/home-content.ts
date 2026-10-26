// Homepage copy that is shared by the visible page and its structured data.
// Every statement here must match how the tools actually work today.
export type Faq = { q: string; a: string };

export const homeFaqs: Faq[] = [
  {
    q: 'Is KittySuite free?',
    a: 'Yes. Every tool on KittySuite today is free to use, with no trial period, watermark or daily limit added by the site.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. There is no sign-up and no login. Open a tool, choose your file and download the result.',
  },
  {
    q: 'Are my files uploaded or stored?',
    a: 'No. Your files are processed by your own browser on your device and are not sent to KittySuite, so there is nothing for us to store. Your browser may remember small preferences, such as your theme and recently used tools, on this device only.',
  },
  {
    q: 'Which image formats are supported?',
    a: 'The image tools work with JPG, PNG and WebP. The converter can also save AVIF when your browser supports it, and Convert to JPG accepts GIF, BMP, TIFF and simple SVG files as well.',
  },
  {
    q: 'Which PDF tools are available?',
    a: 'You can compress, merge, split, rotate, crop, sign, protect, unlock, redact, compare and OCR PDFs, add page numbers or watermarks, fill forms, and convert between PDF and JPG.',
  },
  {
    q: 'Does KittySuite work on mobile?',
    a: 'Yes. The tools work in modern mobile browsers. Very large files and heavy tasks such as OCR or upscaling can be slow on phones because they depend on your device’s memory and processor.',
  },
  {
    q: 'How do I choose the right tool?',
    a: 'Type what you want to do in the search box, for example “compress to 50 KB” or “jpg to pdf”. KittySuite suggests the matching tool and can fill in the settings for you.',
  },
];

export const whyItems = [
  {
    title: 'Processed in your browser',
    text: 'Files are handled on your device instead of being uploaded to a server.',
  },
  {
    title: 'No account needed',
    text: 'No sign-up, no login and no email address. Just open a tool.',
  },
  {
    title: 'Free core tools',
    text: 'Compress, convert, resize, merge and more, without watermarks.',
  },
  {
    title: 'Quick to find',
    text: 'Search in plain words, like “compress to 50 KB” or “merge pdf”.',
  },
];
