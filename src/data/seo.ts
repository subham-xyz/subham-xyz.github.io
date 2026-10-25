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
  'remove-image-metadata': {
    title: 'Remove EXIF & GPS Location from Photos Free | KittySuite',
    description:
      'Strip EXIF data, GPS location, camera details and dates from JPG, PNG and WebP photos in your browser. Batch-friendly, checked after saving, never uploaded.',
    h1: 'Remove Image Metadata',
  },
  'favicon-generator': {
    title: 'Favicon Generator – ICO, PNG & Apple Touch Icon | KittySuite',
    description:
      'Create favicon.ico, 16–512 px PNG icons, an Apple touch icon, a web manifest and the HTML tags from your logo. Free and private: made in your browser.',
  },
  'image-size-checker': {
    title: 'Image Size Checker – KB, Pixels, Format & EXIF | KittySuite',
    description:
      'Check an image’s file size in KB, width and height in pixels, real format, aspect ratio, transparency and hidden metadata. Free, instant and private.',
  },
  'rotate-image': {
    title: 'Rotate & Flip Images Online Free | KittySuite',
    description:
      'Rotate photos 90°, 180° or any angle and flip them horizontally or vertically, one image or a batch. Free and private: processed in your browser.',
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
  upscale: {
    title: 'AI Image Upscaler – Enlarge Photos 2× or 4× | KittySuite',
    description:
      'Upscale photos 2× or 4× with an AI model that runs in your browser. Sharper edges, fewer JPEG blocks, and nothing is uploaded.',
    h1: 'Upscale Image',
  },
  'remove-background': {
    title: 'Remove Background From Image – Free, No Upload | KittySuite',
    description:
      'Remove photo backgrounds with an AI model that runs in your browser. Get a transparent PNG or a white background. Your image is never uploaded.',
    h1: 'Remove Image Background',
  },
  'ocr-pdf': {
    title: 'OCR PDF – Make Scanned PDFs Searchable, Free | KittySuite',
    description:
      'Make scanned PDFs searchable and selectable with OCR that runs in your browser. English, Spanish, French, German, Portuguese, Italian. No uploads.',
    h1: 'OCR PDF',
  },
  'protect-pdf': {
    title: 'Protect PDF With a Password – AES-256, Free | KittySuite',
    description:
      'Add a password to a PDF with AES-256 encryption in your browser. Optionally block printing and copying. Free, and the PDF is never uploaded.',
    h1: 'Password Protect a PDF',
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
    title: 'Font Finder – Find Similar Fonts From an Image | KittySuite',
    description:
      'Crop text from a screenshot or photo and see the closest matches among 1,382 free open-licence fonts. Private: the image is compared in your browser.',
    h1: 'Find Similar Fonts',
  },
  'scan-to-pdf': {
    title: 'Scan Documents to PDF With Your Camera | KittySuite',
    description:
      'Use your phone or laptop camera to capture pages, crop them and save one PDF. Free, and the photos never leave your device.',
  },
};

export const localLine =
  'Free and private: files are processed in your browser and never uploaded.';
