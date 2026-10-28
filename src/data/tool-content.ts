export const guides: Record<string, [string, string]> = {
  'image-compressor': [
    'Small upload limits need measured bytes, not a filename that says “compressed”. Start with the maximum size the destination accepts. Choose its required format, then adjust the quality preference. Enable smaller dimensions only when the destination allows them. The search works with actual encoded files and reports the closest result it can produce within bounded attempts.',
    'A flat signature and a textured photograph behave very differently. PNG keeps exact pixels but may be larger. JPG and WebP can reduce photographic detail to save space. Inspect small text and facial details in the before/after previews. Exact dimensions disable downscaling; an impossible minimum or maximum is reported instead of padded with filler bytes.',
  ],
  'image-resizer': [
    'Resize when a destination needs a particular width or height, even if the file size is already acceptable. Enter pixels for exact dimensions, or switch to a percentage to scale both axes together. The aspect lock is on by default. Editable profile, square, landscape and application examples can save typing, but they are not official standards.',
    'When the desired shape differs from the source, choose crop or padding explicitly. Cropping fills the frame and removes edges. Padding preserves the whole picture with empty or coloured space around it. Enlarging a small image adds pixels without recovering detail. Check the exported dimensions and keep your original for future sizes.',
  ],
  'image-converter': [
    'Use conversion when a file has the wrong format for a website, presentation or editor. JPG works well for photographs; PNG retains transparency and exact pixel values; WebP can combine compact output with transparent areas. Available encoders depend on the browser and are tested before becoming selectable.',
    'The converter keeps the original dimensions. A format change alone does not guarantee a smaller file. Animated inputs become a still image. A solid background is required for JPG because it cannot store transparency; choose the colour before exporting to avoid unexpected borders. Original metadata is not carried across.',
  ],
  'convert-to-jpg': [
    'Choose an image that needs broad JPG compatibility. Native PNG, GIF, WebP, BMP and AVIF decoding uses the browser. SVG is rebuilt from a strict set of drawing elements before decoding; scripts, resource links and unsupported elements are removed. TIFF decoding is loaded only for TIFF input and exports the first readable image.',
    'JPG discards transparency, so inspect the chosen background around logos and cutouts. Animated GIF input becomes a single frame. Some TIFF compression variants or complex SVG artwork will not survive this workflow faithfully. HEIC/HEIF must be exported as JPG or PNG in your photo application first; this page does not pretend to decode it.',
  ],
  'meme-generator': [
    'Start with an image you own or have permission to use. Add a short top caption and a bottom caption, then adjust font size, colour and alignment. An outline helps letters stay readable on busy backgrounds. The preview uses the same canvas drawing as the exported image.',
    'Keep captions short enough that the underlying picture still makes sense. Very long lines are fitted to the available width and can look narrow. Increase source resolution before editing if the finished image will be printed. PNG suits sharp lettering; JPG can be smaller for photographic backgrounds but may soften thin edges.',
  ],
  'photo-editor': [
    'Make a small, useful edit without setting up a full design project. Choose a photograph, add a text layer, change its position and select an effect. A frame can separate an image from the surrounding page. The included Loki sticker is an original geometric KittySuite drawing, rendered locally rather than downloaded from a sticker service.',
    'Effects apply to the photograph before text and stickers are drawn. Text position is expressed as percentages of the image, so the centre remains consistent across differently sized sources. A large frame can cover important edges. Inspect the full preview before export; this editor adds layers and filters but does not offer semantic object removal or a professional layer timeline.',
  ],
  'crop-image': [
    'Crop an image to focus attention or fit a particular shape. Move the selection over the preview and drag its handles to resize it, or use the labelled pixel coordinates for precise keyboard control. Aspect presets help produce a square, a landscape frame or a portrait without guessing.',
    'The crop is measured in original image pixels, even when the preview is displayed smaller on a phone. Keep all four boundaries within the image. Cropping permanently removes those outer pixels from the exported copy, but it does not change your source file. A very small crop will look soft when enlarged later, so leave enough resolution for its intended use.',
  ],
  'rotate-image': [
    'Correct orientation on a single image or a batch. Enter a clockwise angle, including the common quarter-turn values of 90, 180 and 270 degrees, and mirror the image horizontally or vertically if needed. Apply the change to all images, landscape images only or portrait images only. Images that do not match the filter are exported without that rotation.',
    'Quarter turns preserve a rectangular canvas. Other angles need a larger bounding rectangle and create empty corners. Choose JPG with a background colour if the destination does not accept transparent pixels. A batch can be downloaded individually or together as a ZIP. Confirm that the orientation filter matches your intent before sharing the outputs.',
  ],
  'remove-image-metadata': [
    'Photos from phones and cameras often carry hidden details: the GPS position where they were taken, the camera or phone model, the date and time, and the editing software. Choose one or more images and the panel lists what each one contains. Saving writes a fresh copy of the pixels without any of it, and every result is read back to confirm nothing personal is left.',
    'Removing metadata means re-encoding the image. PNG keeps every pixel exactly; JPG and WebP are saved at 95% quality, which is visually identical for photos but not bit-for-bit. If a photo was stored sideways with a rotation flag, the rotation is applied to the pixels first so the clean copy still shows the right way up. Colour profiles are not carried across, so colours are saved in standard sRGB.',
  ],
  'favicon-generator': [
    'Turn a logo or icon into everything a website needs for browser tabs, bookmarks and phone home screens. Choose a square-ish image, crop it to a square or keep the whole image with padding, and check the live previews at 16, 32 and 48 pixels, the sizes browsers really use. The download contains favicon.ico, PNG icons, a web manifest and the HTML tags to paste.',
    'Tiny icons lose fine detail, so a simple, bold mark with good contrast reads best at 16 pixels. Transparent backgrounds work for browser tabs; the Apple touch icon always gets a solid background because iOS shows transparency as black. The .ico file contains PNG images at 16, 32 and 48 pixels, which every current browser and Windows support.',
  ],
  'image-size-checker': [
    'Check an image before you upload it to a form, website or exam portal. The panel shows the real format read from the file itself (not just its name), the file size in KB and bytes, width and height in pixels, aspect ratio, megapixels, whether it has transparent areas and any metadata it carries, such as GPS location or camera details.',
    'Most upload forms set limits on file size, pixel dimensions or format. If your image is too large, continue to Compress Image for a target size in KB, or Resize Image for exact pixels. File size depends on format and content, so two images with the same dimensions can differ a lot. Nothing is uploaded: the details are read in your browser.',
  ],
  'convert-from-jpg': [
    'Convert photographs to PNG or arrange several images into an animated GIF. The frame list includes Earlier and Later controls, so order can be changed without dragging. Set the delay in milliseconds and choose whether the GIF should loop. A single image also produces a valid still GIF.',
    'GIF has a limited colour palette and is a poor substitute for a high-quality photograph. Animation frames are fitted to the first frame’s shape and capped at an 800-pixel side to keep local processing manageable. Longer delays create a slower slideshow. PNG preserves the decoded image pixels but cannot restore detail already lost to the source JPG.',
  ],
  'watermark-image': [
    'Mark a photograph with text or an image you provide. Position it with percentage coordinates, adjust opacity and rotate it to suit the composition. Image marks have an independent scale control. The repeat option distributes a mark across the picture when a single corner label would be too easy to crop away.',
    'A watermark identifies a copy but does not enforce ownership or prevent editing. Keep contrast high enough for the mark to remain visible, then lower opacity only as far as needed. Transparent PNG logos work well as image marks. Inspect bright and dark regions before exporting because the same opacity can look different across a photograph.',
  ],
  'blur-face': [
    'Manually select a face, licence plate or another region that should be less readable in an image. Drag a rectangle, use the brush for irregular regions, or enter numeric bounds and add that rectangle. Multiple regions can be marked before export, and Clear regions returns to the original preview.',
    'Blur is visual obfuscation, not secure redaction. A weak blur can leave enough structure to recognize a person or read a plate. Check the exported image at full size and use a different removal workflow when the information must be irrecoverable. Automatic detection is not active; the tool does not silently send faces to a remote model.',
  ],
  'html-to-image': [
    'Paste a small HTML fragment or choose a local HTML file. Set a canvas size and render it into a PNG. The tool builds a new allowlisted tree containing common text, list and table elements with simple inline styling. No pasted script is executed and no external image, stylesheet, iframe or font is fetched.',
    'This is a safe fragment renderer rather than a full browser-page capture. Unsupported elements are removed, and text beyond the chosen canvas is clipped. Use simple layout and inspect the preview for missing content. If precise website reproduction is required, export an image from the original trusted application instead of expecting this restricted renderer to execute it.',
  ],
  'html-to-pdf': [
    'Create a one-page PDF from a local HTML fragment or file. The same restricted renderer used for HTML images removes scripts and external resources, then embeds its PNG result into a new PDF. Width and height determine the page’s visible canvas and should be chosen before exporting.',
    'The resulting PDF is a visual snapshot, not selectable HTML text or a paginated website. Long content outside the canvas is clipped. Remote images, fonts, stylesheets and scripts are intentionally unavailable. Simplify the fragment, divide long content yourself or use a trusted source application’s PDF export when semantic text and complex pagination matter.',
  ],
  'odt-to-pdf': [
    'Turn a LibreOffice or OpenOffice Writer document into a PDF without installing an office suite. The converter reads the ODT file in your browser and lays out its paragraphs, headings, fonts, lists, tables, images, page size, margins, headers and footers again, writing real text that can be selected and searched.',
    'The layout is rebuilt by KittySuite, so it can differ slightly from LibreOffice. Check line breaks and page breaks before sending an important document. Comments, tracked changes, drawing shapes and embedded charts are not converted, and footnotes are collected at the end of the document. Text in scripts such as Hindi, Japanese or Korean is saved as page images, so it cannot be selected.',
  ],
  'jpg-to-pdf': [
    'Arrange photographs, receipts or slides into one PDF. Add several images and use the page list to put them in reading order. Choose A4 or Letter when printing, or use image dimensions for a document that follows each photograph’s shape. Orientation and margins remain editable.',
    'Fit keeps the whole image within the usable page area; Fill crops edges to cover it. A photograph with unreadable fine print remains unreadable in a PDF. Rotate misplaced pages before export and check the margins on both wide and tall images. Images are embedded locally; the tool does not recognize text or generate an OCR layer.',
  ],
  'merge-pdf': [
    'Bring related documents into one ordered PDF. Select the source PDFs together, inspect their thumbnails and arrange the resulting pages with Earlier and Later or drag controls. The final document follows the visible page order rather than the alphabetical order of filenames.',
    'Merging copies page content into a new document. Document-level features such as outlines, portfolios, form logic or certificate signatures may not survive page copying. Keep original signed documents when their authenticity matters. Encrypted inputs require a readable copy first; the separate Unlock PDF workflow uses a password you provide and produces a flattened visual copy.',
  ],
  'split-pdf': [
    'Divide a long document into smaller files without printing it. Choose a selection for one output, select Every page for individual PDFs, or enter semicolon-separated groups such as 1-3;4-6. Within a group, commas and ascending ranges describe the pages to include.',
    'Page numbers refer to the displayed document order. Check that a range begins at one and does not exceed the last page. Separate outputs can be downloaded individually or as a ZIP. Splitting copies page content but does not promise to preserve document-wide navigation, signature validity or complex form relationships across the new files.',
  ],
  'remove-pages': [
    'Remove blank pages, duplicate covers or irrelevant appendices from a PDF. Check the pages you want to discard, then export the remaining pages. Select all and Clear selection provide a quick starting point, but at least one page must remain in the output.',
    'A thumbnail is useful for navigation but can hide small differences between nearly identical pages. Open a page preview before deleting it if you are unsure. Removing a page does not scrub sensitive content elsewhere in the document. Use Redact PDF when information inside retained pages must be removed rather than simply omitted by page.',
  ],
  'extract-pages': [
    'Keep a subset of a PDF for a recipient who does not need the full document. Select the desired page checkboxes and export them into a new file. The original stays untouched, making this useful for sharing a chapter or a set of supporting pages.',
    'Selection order follows the document’s page list. Check references to missing pages before sharing an extract, especially when the original contains an index or cross-references. Page copying preserves the visible content but is not a promise to retain every document-level attachment, form relationship, outline or digital signature.',
  ],
  'organize-pdf': [
    'Build a cleaner document by arranging its pages visually. Add PDFs to insert their pages, then move pages earlier or later, drag them into position, rotate quarter turns or delete unwanted entries. Preview a page when its thumbnail is not enough to distinguish it.',
    'Export uses the selected pages in their displayed order. A change to page order can make printed page numbers or a table of contents inaccurate, because those marks are part of the original page content. Add new page numbers afterward if needed. Keep original source documents for audit trails and for features that page copying may not preserve.',
  ],
  'scan-to-pdf': [
    'Capture pages with your device camera or choose photographs already stored locally. The browser asks for camera permission only when you open it. Use good light, keep the page flat and wait for a clear preview before capturing. Reorder, rotate and crop scans before PDF export.',
    'This workflow assembles camera images; it does not correct perspective automatically or recognize text. Numeric crop values are percentages of the selected original image. Camera access requires a secure browser context and can be declined without losing the file-upload alternative. Stop the camera when finished. Check small print before choosing margins and page fit.',
  ],
  'compress-pdf': [
    'Start with a lossless structure rewrite when a PDF exceeds a sharing limit. This normalizes the writer’s representation and may improve object-stream packing without reducing image resolution. The result reports both file sizes, including when there is little saving or the output grows.',
    'Optional raster compression can help image-heavy documents, but it rebuilds every page as a JPG. That removes selectable text, links, forms and vector precision. Pick a resolution suitable for the smallest text and inspect the output at normal reading size. Already efficient PDFs may not benefit. No target size or percentage reduction is guaranteed.',
  ],
  'repair-pdf': [
    'Try a limited structure rewrite when a PDF opens inconsistently in different readers. The local parser must still be able to read the document. If it can, the writer serializes a fresh representation that may resolve some structural compatibility problems.',
    'This is not recovery of arbitrary corrupted files. Missing page data, truncated streams, damaged encryption and absent fonts cannot be reconstructed from nothing. If the parser rejects the file, the tool stops with an error instead of inventing pages. Compare the exported document with a known-good source and obtain a fresh original export when important content is missing.',
  ],
  'pdf-to-jpg': [
    'Turn PDF pages into JPG images for slides, previews or systems that accept images rather than documents. Leave the page range blank to render every page, or enter individual numbers and ascending ranges. Each selected page is rendered locally and can be downloaded separately.',
    'JPG exports contain visible page appearance, not selectable text, links or form controls. The raster resolution is capped to keep browser memory practical. Small print may need a different source workflow for high-resolution printing. Multiple outputs are also offered as a ZIP. This tool renders pages; it does not claim to extract original embedded image files without re-encoding.',
  ],
  'pdf-to-text': [
    'Extract selectable text from a PDF without uploading it. Choose the pages you need and export plain text or Markdown with simple page headings. The text engine reads the PDF’s stored text objects rather than trying to recognize photographed letters.',
    'A scanned document may produce no text at all. Multi-column layouts, tables, formulas and decorative placement can produce an unexpected reading order. The output does not recreate the page layout or infer meaningful Markdown tables. Review and edit the extracted text before using it as a source of record. For scans, run OCR PDF first to add a text layer.',
  ],
  'rotate-pdf': [
    'Correct sideways pages while keeping their page content in PDF form. Select a clockwise quarter turn and specify a page range, or leave the range empty to rotate all pages. The angle is added to each page’s existing rotation.',
    'Rotating the viewing orientation does not deskew a scanned page or straighten text within its image. Use an image editor before PDF assembly when the camera itself was tilted. Mixed page sizes remain mixed. Reopen the exported file to confirm the intended orientation, especially when another viewer applies its own display rotation.',
  ],
  'page-numbers': [
    'Add readable page labels to a document that has none. Choose a starting number, position and font size. The format supports {n} for the current number and {total} for the output page count. A range limits where the labels are drawn.',
    'Numbers are added on top of the existing page content. They do not replace labels already printed in the source, so choose a clear margin. Position values are percentages of the page dimensions. Numbering follows output page order; selecting a later range does not restart the sequence. Check the result on pages with unusual sizes or rotations.',
  ],
  'watermark-pdf': [
    'Place a text label or supplied image on selected PDF pages. Use percentage position controls, opacity and image scale to choose a visible but readable mark. A page range allows the cover or particular appendices to remain unmarked.',
    'Watermarks are additions, not access control or proof of ownership. A low-opacity label may disappear on a dark photograph, while a large opaque image can obscure text. PDF text overlays use a standard Latin font; upload a rendered PNG when a logo or another writing system is required. Keep a clean original because removing an added mark later is a different task.',
  ],
  'crop-pdf': [
    'Change which part of each PDF page a viewer displays. Drag a crop on the preview or enter its percentage bounds, then apply it to a page range. Coordinates refer to the unrotated media box, so review pages with existing rotations carefully.',
    'Cropping changes the crop box; it does not delete objects outside the visible boundary. Hidden text or images may still be recoverable. Never use this tool to remove sensitive information. For that purpose, use the dedicated raster-rebuild redaction workflow and inspect the new output. A consistent crop is most useful on documents with matching page geometry.',
  ],
  'edit-pdf': [
    'Add practical annotations to an existing PDF: a short text note, an image, a rectangle or a freehand drawing. Preview a page, position the new content and choose the output range. Numeric rectangle coordinates provide a keyboard alternative to dragging.',
    'These are additive edits. The tool does not rewrite arbitrary existing PDF text, reflow paragraphs or reconstruct document styles. A drawn rectangle does not remove content beneath it. Use a PNG overlay for complex typography or scripts that the standard text font cannot encode. Shapes are repeated across the chosen range, so limit the range when a mark belongs on one page.',
  ],
  'pdf-forms': [
    'Fill fields that already exist in an interactive PDF. The tool detects supported text fields, checkboxes, choice lists and radio groups and presents labelled controls. Unsupported fields are identified without pretending they can be edited.',
    'A PDF that only looks like a form may contain no interactive fields. In that case use visual annotations or obtain the original form template. Filling does not run embedded PDF JavaScript, calculations or remote submission actions. Review totals and validation in the exported file. Standard Latin field appearances are supported; complex scripts may need the source application.',
  ],
  upscale: [
    'Enlarge a small or low-resolution photo to twice or four times its width and height. Instead of simply stretching pixels, an AI super-resolution model (Real-ESRGAN) predicts the missing detail, so edges stay crisp and JPEG compression blocks are smoothed away. Use it for old photos, small product images or pictures saved from chat apps.',
    'Upscaling cannot recover detail that was never captured: tiny faces, text and fine textures may look painted or invented. Compare the before and after closely before printing. The 4× result has 16 times as many pixels and must fit in what your browser can draw: about 1 megapixel of input on phones and Safari, much more on desktop Chrome, Edge or Firefox. The model is small (about 5 MB) but the work is heavy: with a supported graphics card it takes seconds, on the CPU it can take a minute or more, and phones may run out of memory.',
  ],
  'ocr-pdf': [
    'Optical character recognition reads the words printed on a scanned or photographed page and stores them as an invisible text layer behind the image. The page looks the same, but you can now search it with Ctrl+F, select and copy sentences, and let screen readers and document search index it. Choose the document language first for the best accuracy.',
    'Pages that already contain real text are skipped by default, so a mixed PDF keeps its original text untouched. Accuracy depends on the scan: sharp, straight, well-lit pages at 300 dpi read best, while handwriting, tiny print, heavy stamps and unusual fonts produce more mistakes. Check important numbers against the page image. Recognition runs with Tesseract in this browser tab, typically a few seconds per page.',
  ],
  'protect-pdf': [
    'Add a password so a PDF cannot be opened without it. The file is encrypted with AES-256, the strongest standard PDF encryption, which current versions of Adobe Acrobat, Chrome, Edge, Firefox, macOS Preview and most phone readers support. Type the password twice to avoid a typo.',
    'Keep the password safe: it cannot be recovered or reset. Optional restrictions on printing, copying and editing are flags that well-behaved PDF readers respect, not cryptographic protection, so rely on the open password for confidentiality. Encryption runs locally with qpdf compiled to WebAssembly; the PDF and password never leave this browser tab.',
  ],
  'unlock-pdf': [
    'Open a password-protected PDF using the password you already know. Enter it before selecting the file. Incorrect or missing passwords produce an actionable error; the tool never guesses or bypasses an unknown password.',
    'The export is a new, flattened visual PDF built from rendered pages. It does not preserve searchable text, forms, links, attachments, vector precision or certificate signatures. This approach is useful when you need a readable visual copy and accept those losses. Retain the encrypted original for its full structure and only share documents you are authorized to access.',
  ],
  'sign-pdf': [
    'Place a visible signature on a PDF without a signing service. Draw with a pointer or touch, type a name, or upload a signature image. Choose a page range, position and size, then export and inspect the placement. A transparent PNG can retain the natural edges of a scanned signature.',
    'This is visual electronic-signature placement, not cryptographic certificate signing, identity verification or a request-signature workflow. Whether a recipient accepts it depends on their process. Do not assume it establishes a particular legal status. Keep the original document and verify that the signature does not obscure important text or fall outside a page boundary.',
  ],
  'redact-pdf': [
    'Mark the regions that must not appear in a shared PDF. Preview each relevant page and add a removal rectangle by dragging or using numeric coordinates. Multiple rectangles can be placed on different pages before export. Review every mark at a readable size.',
    'Export renders all pages, covers the selected pixels and creates a fresh PDF containing only lossless PNG page images. Original PDF text, objects, attachments, forms, links and metadata are not copied. This sacrifices searchability and vector detail to avoid retaining concealed original content. It cannot remove sensitive information you did not mark, including visible content on other pages. Inspect the final rebuilt document before sharing.',
  ],
  'compare-pdf': [
    'Choose two PDFs and inspect corresponding pages side by side. Enter a page number that exists in both documents. A third image highlights changed rendered pixels, while a text report shows the locally extracted text from each page. The report can be downloaded.',
    'Visual differences include antialiasing, font rendering and shifted layout, so they are not a semantic change count. Text comparison can miss differences in scans or produce misleading order in complex columns. A page inserted near the beginning shifts later page correspondence; compare the appropriate documents and use the side-by-side view as the final check.',
  ],
  'font-finder': [
    'Start with sharp, horizontal text on a plain background. Crop tightly around one line and type the exact characters, matching capitalization. The preparation step distinguishes light and dark text and attempts column-based glyph segmentation. Correct the displayed character labels before comparing.',
    'The original matching index is generated from individually licensed open-source font families. It loads only when you compare, then a worker shortlists candidates before downloading a small number of real fonts for whole-word rendering. Similarity measurements are comparison aids, not probabilities. Handwriting, joined scripts, distorted logos and tiny samples can fail segmentation or have no exact match in the collection.',
  ],
};
