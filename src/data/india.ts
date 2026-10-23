// Common Indian application upload requirements. Values are editable starting
// points: every page reminds people to check the current official notice.
// Bank exam values follow the IBPS-style specification used in bank notices
// (e.g. IPPB 2025): photo 200×230 px 20–50 KB, signature 140×60 px 10–20 KB,
// left thumb 240×240 px 20–50 KB, declaration 800×400 px 50–100 KB.
export type ImagePreset = {
  id: string;
  label: string;
  hindi: string;
  group: string;
  width: number; // 0 keeps the original dimensions
  height: number;
  minKB: number;
  maxKB: number;
  tool: 'image-resizer' | 'image-compressor';
};

export const imagePresets: ImagePreset[] = [
  {
    id: 'bank-photo',
    label: 'Bank exam photo (IBPS, SBI, RBI)',
    hindi: 'बैंक परीक्षा फ़ोटो',
    group: 'Bank exams',
    width: 200,
    height: 230,
    minKB: 20,
    maxKB: 50,
    tool: 'image-resizer',
  },
  {
    id: 'bank-signature',
    label: 'Bank exam signature',
    hindi: 'बैंक परीक्षा हस्ताक्षर',
    group: 'Bank exams',
    width: 140,
    height: 60,
    minKB: 10,
    maxKB: 20,
    tool: 'image-resizer',
  },
  {
    id: 'bank-thumb',
    label: 'Left thumb impression',
    hindi: 'बाएँ अंगूठे का निशान',
    group: 'Bank exams',
    width: 240,
    height: 240,
    minKB: 20,
    maxKB: 50,
    tool: 'image-resizer',
  },
  {
    id: 'bank-declaration',
    label: 'Handwritten declaration',
    hindi: 'हस्तलिखित घोषणा',
    group: 'Bank exams',
    width: 800,
    height: 400,
    minKB: 50,
    maxKB: 100,
    tool: 'image-resizer',
  },
  {
    id: 'ssc-signature',
    label: 'SSC signature',
    hindi: 'SSC हस्ताक्षर',
    group: 'SSC',
    width: 0,
    height: 0,
    minKB: 10,
    maxKB: 20,
    tool: 'image-compressor',
  },
  {
    id: 'upsc-photo',
    label: 'UPSC photo',
    hindi: 'UPSC फ़ोटो',
    group: 'UPSC',
    width: 0,
    height: 0,
    minKB: 20,
    maxKB: 200,
    tool: 'image-compressor',
  },
  {
    id: 'upsc-signature',
    label: 'UPSC signature',
    hindi: 'UPSC हस्ताक्षर',
    group: 'UPSC',
    width: 0,
    height: 0,
    minKB: 20,
    maxKB: 100,
    tool: 'image-compressor',
  },
  {
    id: 'nta-photo',
    label: 'NEET / JEE / CUET photo',
    hindi: 'NEET / JEE फ़ोटो',
    group: 'NTA exams',
    width: 0,
    height: 0,
    minKB: 10,
    maxKB: 200,
    tool: 'image-compressor',
  },
  {
    id: 'nta-signature',
    label: 'NEET / JEE / CUET signature',
    hindi: 'NEET / JEE हस्ताक्षर',
    group: 'NTA exams',
    width: 0,
    height: 0,
    minKB: 4,
    maxKB: 30,
    tool: 'image-compressor',
  },
  {
    id: 'pan-photo',
    label: 'PAN card photo (up to 50 KB)',
    hindi: 'पैन कार्ड फ़ोटो',
    group: 'PAN card',
    width: 0,
    height: 0,
    minKB: 0,
    maxKB: 50,
    tool: 'image-compressor',
  },
  {
    id: 'pan-signature',
    label: 'PAN card signature (up to 50 KB)',
    hindi: 'पैन कार्ड हस्ताक्षर',
    group: 'PAN card',
    width: 0,
    height: 0,
    minKB: 0,
    maxKB: 50,
    tool: 'image-compressor',
  },
  {
    id: 'passport-size',
    label: 'Passport-size photo (3.5 × 4.5 cm)',
    hindi: 'पासपोर्ट साइज़ फ़ोटो',
    group: 'Everyday',
    width: 413,
    height: 531,
    minKB: 0,
    maxKB: 0,
    tool: 'image-resizer',
  },
  {
    id: 'under-20kb',
    label: 'Any photo under 20 KB',
    hindi: 'फ़ोटो 20 KB से कम',
    group: 'Everyday',
    width: 0,
    height: 0,
    minKB: 0,
    maxKB: 20,
    tool: 'image-compressor',
  },
  {
    id: 'under-50kb',
    label: 'Any photo under 50 KB',
    hindi: 'फ़ोटो 50 KB से कम',
    group: 'Everyday',
    width: 0,
    height: 0,
    minKB: 0,
    maxKB: 50,
    tool: 'image-compressor',
  },
  {
    id: 'under-100kb',
    label: 'Any photo under 100 KB',
    hindi: 'फ़ोटो 100 KB से कम',
    group: 'Everyday',
    width: 0,
    height: 0,
    minKB: 0,
    maxKB: 100,
    tool: 'image-compressor',
  },
];

export const presetHref = (p: ImagePreset) =>
  `/tools/${p.tool}/?preset=${p.id}`;

export const presetSpec = (p: ImagePreset) =>
  [
    p.width ? `${p.width} × ${p.height} px` : '',
    p.maxKB
      ? p.minKB
        ? `${p.minKB}–${p.maxKB} KB`
        : `up to ${p.maxKB} KB`
      : '',
    'JPG',
  ]
    .filter(Boolean)
    .join(' · ');

export type DailyTask = {
  title: string;
  hindi: string;
  note: string;
  href: string;
  icon: string; // tool id for the icon
};

export const dailyTasks: DailyTask[] = [
  {
    title: 'Exam form photo',
    hindi: 'परीक्षा फ़ॉर्म फ़ोटो',
    note: '200 × 230 px · 20–50 KB',
    href: '/tools/image-resizer/?preset=bank-photo',
    icon: 'image-resizer',
  },
  {
    title: 'Exam form signature',
    hindi: 'हस्ताक्षर का साइज़',
    note: '140 × 60 px · 10–20 KB',
    href: '/tools/image-resizer/?preset=bank-signature',
    icon: 'sign-pdf',
  },
  {
    title: 'Photo under 50 KB',
    hindi: 'फ़ोटो 50 KB से कम करें',
    note: 'Any JPG, PNG or WebP',
    href: '/tools/image-compressor/?preset=under-50kb',
    icon: 'image-compressor',
  },
  {
    title: 'PAN card photo',
    hindi: 'पैन कार्ड फ़ोटो',
    note: 'JPG up to 50 KB',
    href: '/tools/image-compressor/?preset=pan-photo',
    icon: 'image-compressor',
  },
  {
    title: 'Open e-Aadhaar PDF',
    hindi: 'ई-आधार PDF खोलें',
    note: 'Uses the password you enter',
    href: '/tools/unlock-pdf/?hint=aadhaar',
    icon: 'unlock-pdf',
  },
  {
    title: 'Photos to one PDF',
    hindi: 'फ़ोटो से PDF बनाएं',
    note: 'For document uploads',
    href: '/tools/jpg-to-pdf/',
    icon: 'jpg-to-pdf',
  },
  {
    title: 'Make a PDF smaller',
    hindi: 'PDF का साइज़ कम करें',
    note: 'Check the portal limit',
    href: '/tools/compress-pdf/',
    icon: 'compress-pdf',
  },
  {
    title: 'Scan with your phone',
    hindi: 'फ़ोन से स्कैन करें',
    note: 'Camera to PDF',
    href: '/tools/scan-to-pdf/',
    icon: 'scan-to-pdf',
  },
];
