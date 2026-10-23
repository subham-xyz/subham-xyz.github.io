export const intents = [
  {
    slug: 'compress-image-to-20kb',
    tool: 'image-compressor',
    title: 'Compress image to 20 KB',
    description:
      'Aim for a 20 KB image with local compression. Check the measured file size, dimensions and quality before downloading.',
    target: 20,
    guide:
      'A 20 KB limit leaves little room for texture. Start with a tightly framed image and choose JPG for a photograph. If the receiving portal requires fixed pixels, enter those first and keep the exact-dimensions option selected. The tool then searches quality settings without silently resizing your image. If the limit cannot be met, the result says so. PNG signatures can sometimes remain compact, but a photograph saved as PNG is often too large. Requirements vary. Check the official notice or portal before submitting.',
  },
  {
    slug: 'compress-image-to-50kb',
    tool: 'image-compressor',
    title: 'Compress image to 50 KB',
    description:
      'Prepare an image near a 50 KB maximum using local JPG, PNG or WebP encoding, with measured results and editable settings.',
    target: 50,
    guide:
      'A 50 KB budget can suit a small profile photograph or signature, but detail and dimensions still determine the final size. Choose the format the destination accepts. WebP can be compact for websites, while an application portal may accept only JPG. The target is a maximum, not a promise to generate exactly 50 KB. Enable smaller dimensions only when the destination permits them. Compare edges, fine text and facial detail in the output preview. Requirements vary. Check the official notice or portal before submitting.',
  },
  {
    slug: 'resize-photo-for-exam-form',
    tool: 'image-resizer',
    title: 'Resize photo for an exam form',
    description:
      'Set editable photo dimensions for an application form. Check output pixels, format and file size locally before submission.',
    target: 0,
    guide:
      'Read the current notice before preparing your photograph. Different portals specify different widths, heights, backgrounds and file sizes. Our photo example is not an official exam standard. Enter the dimensions from your instructions, choose crop or padding deliberately, and check the resulting file rather than its filename. A centered crop can cut hair or shoulders; padding can create borders that the portal does not accept. Keep a high-resolution original so you can adjust again without repeatedly compressing the same file. Requirements vary. Check the official notice or portal before submitting.',
  },
  {
    slug: 'jpg-to-pdf',
    tool: 'jpg-to-pdf',
    title: 'JPG to PDF',
    description:
      'Arrange JPG images into one PDF locally. Choose page size, orientation, margins and fit before downloading.',
    target: 0,
    guide:
      'Turn photographed receipts or exported slides into an ordered PDF. Choose your images together, then use Earlier and Later to put them in reading order. Use A4 or Letter for printing, or image dimensions when preserving each image shape matters more. Fit keeps the full photograph inside the margins. Fill crops edges to cover the usable page area. Check small text at a readable zoom before sending the PDF: packaging a blurry image in a document cannot recover missing detail.',
  },
  {
    slug: 'merge-pdf',
    tool: 'merge-pdf',
    title: 'Merge PDF files',
    description:
      'Combine PDFs in your chosen page order, entirely on your device. Preview the pages and download one merged file.',
    target: 0,
    guide:
      'Combine a cover sheet, report and supporting documents into one file without sending them away. Select your PDFs together and inspect the page thumbnails. The merge uses the displayed page order, so moving a page can also change the order within a source document. Use a fresh copy of signed documents: modification can invalidate certificate signatures. If an input is encrypted, provide its password through the separate unlock tool first and understand that its visual export loses interactive features.',
  },
  {
    slug: 'compress-pdf',
    tool: 'compress-pdf',
    title: 'Compress PDF locally',
    description:
      'Try lossless PDF rewriting or optional raster compression. See real file sizes and savings without uploads or guarantees.',
    target: 0,
    guide:
      'A PDF can contain efficient text, oversized scanned pages or already compressed photographs. Start with the lossless structure rewrite because it preserves readable content without reducing image resolution. If it saves little, that is a valid result. Optional rasterization replaces every page with an image and can reduce large scans, but loses text selection, forms, links and vector detail. Choose the resolution for the intended viewing size, then inspect small print. Keep the original for editing and archival use.',
  },
];
