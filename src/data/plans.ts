import { tools } from './tools';
export type Plan = {
  name: string;
  seats: string;
  price: string;
  per?: string;
  note: string;
  cta: string;
  href?: string;
  featured?: boolean;
  features: string[];
};

export const plans: Plan[] = [
  {
    name: 'Basic',
    seats: '1',
    price: 'Free',
    note: 'Everything on KittySuite today.',
    cta: 'Start for free',
    href: '/#tools',
    features: [
      `All ${tools.filter((t) => t.status === 'ready').length} local tools`,
      'No uploads, no sign-up',
      'Exam and form size presets',
    ],
  },
  {
    name: 'Premium',
    seats: '1–25',
    price: '₹500',
    per: '/ month',
    note: 'Coming soon',
    cta: 'Get Premium',
    featured: true,
    features: [
      'Bigger batches',
      'Saved presets on every device',
      'Priority for new tools',
      'Priority support',
    ],
  },
  {
    name: 'Business',
    seats: '25+',
    price: 'Let’s talk',
    note: 'Custom plans for teams and institutions.',
    cta: 'Contact us',
    href: '/feedback/?type=business',
    features: [
      'Everything in Premium',
      'Team management',
      'Custom tools for your workflow',
    ],
  },
];
