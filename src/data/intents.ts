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
];
