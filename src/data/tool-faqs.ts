// Tool-specific questions for the highest-intent tools. Shown on the tool page and
// mirrored exactly in that page's FAQPage structured data. Answers describe what the
// tool really does; keep them in step with the implementation.
import type { Faq } from './home-content';

export const toolFaqs: Record<string, Faq[]> = {
  'image-compressor': [
    {
      q: 'How do I compress an image to a specific size, like 50 KB?',
      a: 'Choose your image, enter the target size in KB and select Compress image. The tool searches for the best quality that fits under your limit and shows the real file size before you download it.',
    },
    {
      q: 'Which formats can I compress?',
      a: 'JPG, PNG and WebP. Photos usually compress best as JPG or WebP; PNG is better for screenshots, logos and images with transparency.',
    },
    {
      q: 'Will compressing reduce the quality?',
      a: 'A smaller file always keeps less detail, but moderate compression is hard to see. Compare the preview with the original, and if the limit is very small, resize the image first so fewer pixels need to fit.',
    },
    {
      q: 'Can I compress several images at once?',
      a: 'Yes. Add several images and they are compressed one after another in your browser, then you can download them together.',
    },
  ],
  'image-resizer': [
    {
      q: 'How do I resize an image to exact pixels?',
      a: 'Choose your image, enter the width and height in pixels and select Resize image. Keep the aspect-ratio lock on to avoid stretching the picture.',
    },
    {
      q: 'What is the difference between crop and padding?',
      a: 'When the new shape differs from the original, crop fills the frame and trims the edges, while padding keeps the whole picture and adds a border.',
    },
    {
      q: 'Can I resize by percentage?',
      a: 'Yes. Switch to percentage and enter a value such as 50% to halve the width and height.',
    },
  ],
  'image-converter': [
    {
      q: 'Which formats can I convert between?',
      a: 'You can convert JPG, PNG and WebP images and save them as JPG, PNG, WebP or AVIF. AVIF is offered when your browser can create it.',
    },
    {
      q: 'Does converting change the image size?',
      a: 'The width and height stay the same. The file size can go up or down, because each format stores images differently.',
    },
    {
      q: 'What happens to transparent areas?',
      a: 'PNG, WebP and AVIF can keep transparency. JPG cannot, so transparent areas are filled with the background colour you choose.',
    },
  ],
  'compress-pdf': [
    {
      q: 'How much smaller will my PDF get?',
      a: 'It depends on the file. PDFs with large photos or scans can shrink a lot, while text-only PDFs are often already compact. The result shows the real saving and tells you when a PDF was already well optimised.',
    },
    {
      q: 'Does compressing a PDF lower the quality?',
      a: 'The Recommended level rewrites the file and keeps text and quality. The Strong level turns each page into an image: the file gets much smaller, but text can no longer be selected or searched.',
    },
    {
      q: 'Is my PDF uploaded?',
      a: 'No. The PDF is processed in your browser on your device and is not sent to KittySuite.',
    },
  ],
  'odt-to-pdf': [
    {
      q: 'How do I convert an ODT file to PDF?',
      a: 'Choose the .odt file, check the page preview and select Convert to PDF. You can keep the document’s page size or switch to A4 or Letter.',
    },
    {
      q: 'Will the PDF look exactly like LibreOffice?',
      a: 'Usually very close. Text, styles, lists, tables, images, headers and footers are kept, but the layout is rebuilt in your browser, so line and page breaks can differ slightly.',
    },
    {
      q: 'Can I convert Word (.docx) files?',
      a: 'Not yet. Open the file in Word or LibreOffice, save it as ODT, then convert it here.',
    },
  ],
  'jpg-to-pdf': [
    {
      q: 'How do I combine several images into one PDF?',
      a: 'Choose all the images, drag them into the order you want, pick a page size and margins, then create the PDF. Each image becomes one page.',
    },
    {
      q: 'Which image formats are supported?',
      a: 'JPG, PNG and WebP images.',
    },
    {
      q: 'Can I make the PDF smaller afterwards?',
      a: 'Yes. Open the finished file in Compress PDF to reduce its size further.',
    },
  ],
  'pdf-to-jpg': [
    {
      q: 'Can I convert only some pages?',
      a: 'Yes. Enter the pages or ranges you need, such as 1-3, 5. Each page is saved as a separate JPG image, and several images can be downloaded together as a ZIP file.',
    },
    {
      q: 'How sharp are the images?',
      a: 'Each page is rendered at about 1,800 pixels on its longest side, which is clear on screens and fine for everyday printing.',
    },
    {
      q: 'Is my PDF uploaded?',
      a: 'No. Pages are rendered in your browser on your device.',
    },
  ],
  'merge-pdf': [
    {
      q: 'How do I merge PDF files?',
      a: 'Choose two or more PDFs, arrange them in the order you want and select Merge PDF. The pages are combined into one new document.',
    },
    {
      q: 'Is there a limit on the number of files?',
      a: 'There is no fixed limit, but everything happens in your browser, so very large files depend on your device’s memory.',
    },
  ],
  'font-finder': [
    {
      q: 'What is a font finder?',
      a: 'A font finder compares the letters in a picture with a library of fonts and suggests the typefaces that look most similar. KittySuite’s Font Finder compares your sample with 1,382 free font families from Google Fonts.',
    },
    {
      q: 'Can I identify a font from an image?',
      a: 'You can find the closest matches. The tool ranks fonts in its free font library by how similar their letter shapes are to your sample. If the original is a commercial font that is not in the library, you get the nearest free alternatives instead of the exact font.',
    },
    {
      q: 'How can I identify a typeface from a photo?',
      a: 'Use a photo taken straight on, with the text in focus. Crop one line of text, type the words exactly as they appear, including capital letters, and select Compare fonts.',
    },
    {
      q: 'How do I match a font from an uploaded image?',
      a: 'Choose or paste your image, drag across a single line of text, type those words, and adjust the ink sensitivity if letters break apart or run together. Then select Compare fonts to see ranked suggestions with live previews.',
    },
    {
      q: 'Can Google identify a font?',
      a: 'Image search tools can find pages with similar pictures or text, but they do not compare letter shapes with a font library. A dedicated font finder ranks fonts by how closely their letters match your sample.',
    },
    {
      q: 'Can I identify a font used in a PDF?',
      a: 'If the PDF contains real text, your PDF reader can often list the embedded fonts in its document properties. For scanned PDFs, take a screenshot of one line, or save the page with PDF to JPG, and use that image here.',
    },
    {
      q: 'How do I find a similar Google Font?',
      a: 'Every font in the library is a free Google Fonts family under the SIL Open Font License. Each suggestion links to its source page, where you can check the licence and download the font.',
    },
    {
      q: 'Why can font-identification results differ?',
      a: 'Results depend on the crop, the words you type, the ink sensitivity and the image quality. Bold, italic, condensed or decorative styles, and fonts that are not in the library, also change the ranking.',
    },
    {
      q: 'What makes an image easier to identify?',
      a: 'Large, sharp, horizontal text on a plain, high-contrast background works best. Several different letters help more than a single word with repeated letters.',
    },
    {
      q: 'Is KittySuite Font Finder free?',
      a: 'Yes. It is free, needs no account, and your image is compared in your browser without being uploaded.',
    },
  ],
};
