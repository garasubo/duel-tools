export interface LabelColor {
  bg: string;
  text: string;
  border: string;
  removeText: string;
  removeHover: string;
}

const LABEL_COLORS: LabelColor[] = [
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', removeText: 'text-teal-400', removeHover: 'hover:text-teal-700' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', removeText: 'text-rose-400', removeHover: 'hover:text-rose-700' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', removeText: 'text-sky-400', removeHover: 'hover:text-sky-700' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', removeText: 'text-amber-400', removeHover: 'hover:text-amber-700' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', removeText: 'text-violet-400', removeHover: 'hover:text-violet-700' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', removeText: 'text-emerald-400', removeHover: 'hover:text-emerald-700' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', removeText: 'text-fuchsia-400', removeHover: 'hover:text-fuchsia-700' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', removeText: 'text-indigo-400', removeHover: 'hover:text-indigo-700' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', removeText: 'text-orange-400', removeHover: 'hover:text-orange-700' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', removeText: 'text-cyan-400', removeHover: 'hover:text-cyan-700' },
];

/**
 * Deterministically maps a label name to a color from the palette,
 * so that the same label always gets the same color and different
 * labels are visually distinguishable.
 */
export function getLabelColor(label: string): LabelColor {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % LABEL_COLORS.length;
  return LABEL_COLORS[index];
}
