// Search titles and descriptions for the main tool pages.
// Tools without an entry fall back to "<name> — Free, No Upload | KittySuite"
// and their catalogue description plus the local-processing line.
export type ToolSeo = { title: string; description: string; h1?: string };

export const toolSeo: Record<string, ToolSeo> = {
  'image-compressor': {
    title: 'Compress Image – Reduce JPG, PNG & WebP Size | KittySuite',
    description:
      'Compress JPG, PNG and WebP images to an exact size such as 20 KB, 50 KB or 100 KB. Free, and your images are processed in your browser, never uploaded.',
    h1: 'Compress Image',
  },
  'image-resizer': {
    title: 'Resize Image Online – Change Size in Pixels | KittySuite',
    description:
      'Resize photos to exact pixel sizes or by percentage, with crop or padding and ready-made exam photo sizes. Free and private: nothing is uploaded.',
    h1: 'Resize Image',
  },
  'image-converter': {
    title: 'Image Converter – JPG, PNG, WebP & AVIF Free | KittySuite',
    description:
      'Convert images between JPG, PNG, WebP and AVIF in your browser. Keeps the original dimensions and transparency where the format allows. No uploads.',
    h1: 'Image Converter',
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
      'Strip EXIF data, GPS location, camera details and dates from JPG, PNG and WebP photos in your browser. Batch-friendly and never uploaded.',
    h1: 'Remove Image Metadata',
  },
  'favicon-generator': {
    title: 'Favicon Generator – ICO, PNG & Apple Icons | KittySuite',
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
    title: 'Compress PDF – Reduce PDF File Size Free | KittySuite',
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
    title: 'Font Finder by Image – Find Fonts From a Photo | KittySuite',
    description:
      'What font is this? Upload a screenshot or photo, crop one line of text and compare it with 1,382 free Google Fonts. Free; your image is never uploaded.',
    h1: 'Font Finder: find similar fonts from an image',
  },
  'scan-to-pdf': {
    title: 'Scan Documents to PDF With Your Camera | KittySuite',
    description:
      'Use your phone or laptop camera to capture pages, crop them and save one PDF. Free, and the photos never leave your device.',
  },
  'meme-generator': {
    title: 'Meme Generator – Add Captions to Your Image | KittySuite',
    description:
      'Make a meme from your own picture with outlined top and bottom captions, font size and colour controls. Free, no watermark, made in your browser.',
  },
  'convert-from-jpg': {
    title: 'Convert JPG to PNG or Animated GIF Free | KittySuite',
    description:
      'Turn JPG photos into PNG files, or arrange several images into an animated GIF with your own frame timing. Free and processed on your device.',
  },
  'html-to-image': {
    title: 'HTML to Image – Render HTML as PNG or JPG | KittySuite',
    description:
      'Paste or upload an HTML fragment and save it as a PNG or JPG image. External resources are blocked and nothing is uploaded. Free to use.',
  },
  'watermark-image': {
    title: 'Watermark Image Online – Add Text or Logo Free | KittySuite',
    description:
      'Add a text or logo watermark to a photo with position, opacity, rotation and repeat controls. Free, private and processed in your browser.',
  },
  'blur-face': {
    title: 'Blur Face in Photo – Hide Faces & Details Free | KittySuite',
    description:
      'Blur faces, number plates and private details in a photo with rectangles or a brush. Free, and the image is edited in your browser, never uploaded.',
  },
  'remove-pages': {
    title: 'Remove Pages From PDF – Delete Pages Free | KittySuite',
    description:
      'Select the pages you don’t need and save a new PDF without them. Free, no sign-up, and your document is processed in your browser.',
  },
  'extract-pages': {
    title: 'Extract Pages From PDF – Save Selected Pages | KittySuite',
    description:
      'Pick the pages you need from a PDF and save them as a new document. Free, quick and private: the file never leaves your device.',
  },
  'organize-pdf': {
    title: 'Organize PDF Pages – Reorder, Rotate & Insert | KittySuite',
    description:
      'Drag PDF pages into a new order, rotate or delete them, and insert pages from other PDFs. Free, and everything happens in your browser.',
  },
  'repair-pdf': {
    title: 'Repair PDF – Rewrite a Damaged PDF Free | KittySuite',
    description:
      'Rebuild the structure of a PDF that opens but misbehaves, then download a clean copy. Free and local; badly corrupted files may not be recoverable.',
  },
  'html-to-pdf': {
    title: 'HTML to PDF – Convert HTML Code to PDF Free | KittySuite',
    description:
      'Paste or upload an HTML fragment and save it as a PDF in your browser. External resources are blocked for safety and nothing is uploaded.',
  },
  'pdf-to-text': {
    title: 'PDF to Text & Markdown – Extract PDF Text Free | KittySuite',
    description:
      'Extract selectable text from a PDF and download it as plain text or Markdown. Free and private; scanned pages need OCR PDF first.',
  },
  'page-numbers': {
    title: 'Add Page Numbers to PDF Online Free | KittySuite',
    description:
      'Number the pages of a PDF with your choice of position, size, format and page range. Free, no sign-up, and the PDF is processed on your device.',
  },
  'crop-pdf': {
    title: 'Crop PDF Pages Online – Trim Margins Free | KittySuite',
    description:
      'Trim the margins of PDF pages with a visual crop box, for all pages or a range. Free and private: the document stays in your browser.',
  },
  'pdf-forms': {
    title: 'Fill PDF Forms Online Free – No Upload | KittySuite',
    description:
      'Type into the text fields, checkboxes and choices already in a PDF form, then save the filled copy. Free, and your answers stay on your device.',
  },
  'redact-pdf': {
    title: 'Redact PDF – Permanently Black Out Text Free | KittySuite',
    description:
      'Mark areas of a PDF to remove and rebuild the pages so the hidden content is really gone. Free, private and processed in your browser.',
  },
  'compare-pdf': {
    title: 'Compare PDF Files – Find Differences Free | KittySuite',
    description:
      'Open two PDFs side by side and compare their pages and extracted text to spot changes. Free, and both files stay on your device.',
  },
};

export const localLine =
  'Free and private: files are processed in your browser and never uploaded.';
