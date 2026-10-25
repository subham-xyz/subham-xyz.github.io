// Search titles and descriptions for the main tool pages.
// Tools without an entry fall back to "<name> — Free, No Upload | KittySuite"
// and their catalogue description plus the local-processing line.
export type ToolSeo = { title: string; description: string; h1?: string };

export const toolSeo: Record<string, ToolSeo> = {
  'image-compressor': {
    title: 'Compress Images Online Free – JPG, PNG & WebP | KittySuite',
    description:
      'Compress JPG, PNG and WebP images to an exact size such as 20 KB, 50 KB or 100 KB. Free, and your images are processed in your browser, never uploaded.',
    h1: 'Compress Images Online',
  },
  'image-resizer': {
    title: 'Resize Images Online Free – Pixels or Percent | KittySuite',
    description:
      'Resize photos to exact pixel sizes or by percentage, with crop or padding and ready-made exam photo sizes. Free and private: nothing is uploaded.',
    h1: 'Resize Images Online',
  },
  'image-converter': {
    title: 'Image Converter – JPG, PNG, WebP & AVIF Free | KittySuite',
    description:
      'Convert images between JPG, PNG, WebP and AVIF in your browser. Keeps the original dimensions and transparency where the format allows. No uploads.',
    h1: 'Convert Images Online',
  },
  'convert-to-jpg': {
    title: 'Convert PNG, WebP, GIF & TIFF to JPG Free | KittySuite',
    description:
      'Turn PNG, WebP, GIF, BMP, AVIF, TIFF or simple SVG images into JPG files with a background colour you choose. Free, private and processed in your browser.',
  },
  'crop-image': {
    title: 'Crop Images Online Free – Ratios or Pixels | KittySuite',
    description:
      'Crop photos visually or to exact pixel bounds, with square, 4:3 and 16:9 ratios. Free, fast and private: your image never leaves your device.',
  },
  'photo-editor': {
    title: 'Free Photo Editor – Text, Filters & Frames | KittySuite',
    description:
      'Adjust brightness and colour, add filters, text, frames and stickers to a photo in your browser. Free, no sign-up and no uploads.',
  },
  'jpg-to-pdf': {
    title: 'JPG to PDF Converter – Combine Images Free | KittySuite',
    description:
      'Put JPG and PNG images into one PDF in the order you choose, with page size, margins and fit options. Free and processed on your device.',
  },
  'merge-pdf': {
    title: 'Merge PDF Files Online Free – No Upload | KittySuite',
    description:
      'Combine several PDF files into one document in the page order you choose. Free, and the PDFs are merged in your browser, never uploaded.',
  },
  'compress-pdf': {
    title: 'Compress PDF Online Free – Reduce PDF Size | KittySuite',
    description:
      'Reduce PDF file size with a lossless rewrite or stronger image compression, and see the real saving. Free and private: your PDF stays on your device.',
  },
  'split-pdf': {
    title: 'Split PDF Online Free – Pages or Ranges | KittySuite',
    description:
      'Split a PDF into page ranges, single pages or a custom selection and download the parts. Free, and the file is processed in your browser.',
  },
  'pdf-to-jpg': {
    title: 'PDF to JPG Converter – Pages to Images Free | KittySuite',
    description:
      'Turn PDF pages into JPG images and download them together as a ZIP. Free, no sign-up, and your PDF is never uploaded.',
  },
  'sign-pdf': {
    title: 'Sign PDF Online Free – Draw, Type or Upload | KittySuite',
    description:
      'Add a drawn, typed or uploaded signature to any page of a PDF. Free and private: the document is signed in your browser, not on a server.',
  },
  'unlock-pdf': {
    title: 'Unlock PDF With Your Password – Free | KittySuite',
    description:
      'Open a password-protected PDF with its password and save an unlocked copy, including e-Aadhaar PDFs. Free, and nothing is uploaded.',
  },
  'rotate-pdf': {
    title: 'Rotate PDF Pages Online Free | KittySuite',
    description:
      'Rotate all pages of a PDF or only a selected range by 90 or 180 degrees, then download the fixed file. Free and processed on your device.',
  },
  'edit-pdf': {
    title: 'Edit PDF Online Free – Text, Images & Drawing | KittySuite',
    description:
      'Add text, images, shapes and freehand drawings to PDF pages in your browser. Free, no account needed, and your PDF is never uploaded.',
  },
  'watermark-pdf': {
    title: 'Add a Watermark to PDF Free – Text or Image | KittySuite',
    description:
      'Place a text or image watermark on chosen PDF pages with opacity and rotation controls. Free and private: processed in your browser.',
  },
  'font-finder': {
    title: 'Font Finder – Identify Fonts From Images | KittySuite',
    description:
      'Crop text from a screenshot or photo and compare it with free open fonts to find a close match. Private: the image is matched in your browser.',
  },
  'scan-to-pdf': {
    title: 'Scan Documents to PDF With Your Camera | KittySuite',
    description:
      'Use your phone or laptop camera to capture pages, crop them and save one PDF. Free, and the photos never leave your device.',
  },
};

export const localLine =
  'Free and private: files are processed in your browser and never uploaded.';
