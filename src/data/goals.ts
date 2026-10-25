export type Goal = {
  id: string;
  label: string;
  steps: [string, string, string];
  tip: string;
  primary: string;
  related: [string, string];
};
export const goals: Goal[] = [
  {
    id: 'smaller',
    label: 'Make a file smaller',
    steps: [
      'Choose your image or PDF.',
      'Set a target or optimization level.',
      'Check the actual savings and download.',
    ],
    tip: 'Size limits vary. Keep your original and check the final file before submitting.',
    primary: 'image-compressor',
    related: ['compress-pdf', 'image-resizer'],
  },
  {
    id: 'dimensions',
    label: 'Change dimensions',
    steps: [
      'Choose an image.',
      'Set pixels or a percentage; keep the aspect lock.',
      'Preview the new dimensions and download.',
    ],
    tip: 'Crop removes edges. Padding keeps the whole picture.',
    primary: 'image-resizer',
    related: ['crop-image', 'rotate-image'],
  },
  {
    id: 'format',
    label: 'Change format',
    steps: [
      'Choose your source file.',
      'Pick a format that your destination accepts.',
      'Download and check the converted file.',
    ],
    tip: 'JPG fills transparency. PNG preserves it.',
    primary: 'image-converter',
    related: ['convert-to-jpg', 'jpg-to-pdf'],
  },
  {
    id: 'protect',
    label: 'Edit or protect',
    steps: [
      'Choose the file to work on.',
      'Place your edits and preview carefully.',
      'Export a new copy and inspect it.',
    ],
    tip: 'Visual signatures are not certificate signatures. Blur is not secure redaction.',
    primary: 'photo-editor',
    related: ['watermark-image', 'redact-pdf'],
  },
  {
    id: 'pdf',
    label: 'Work with PDFs',
    steps: [
      'Choose your PDFs.',
      'Arrange pages or select the changes.',
      'Export and review the resulting PDF.',
    ],
    tip: 'Some encrypted or damaged files need a readable copy first.',
    primary: 'merge-pdf',
    related: ['organize-pdf', 'pdf-to-jpg'],
  },
  {
    id: 'font',
    label: 'Find a similar font',
    steps: [
      'Crop a clear line of text.',
      'Check the detected glyphs and type the exact words.',
      'Compare the closest free-font candidates.',
    ],
    tip: 'Custom lettering and joined scripts may not have an exact match.',
    primary: 'font-finder',
    related: ['crop-image', 'photo-editor'],
  },
];
