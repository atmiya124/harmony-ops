// A minimal JSX runtime that renders straight to an HTML string, for the PDF
// document templates (opt in per file with
// `/** @jsxImportSource @/lib/documents/html */`). Next.js won't bundle
// react-dom/server into route handlers, and these templates need nothing
// from React — no state, effects or hydration — just markup.
//
// Text and attribute values are always escaped; only Html values produced by
// this runtime are inserted as markup, so customer-entered text can never
// become HTML.

export class Html {
  constructor(readonly html: string) {}
  toString(): string {
    return this.html;
  }
}

type Child = Html | string | number | boolean | null | undefined | Child[];
type Props = Record<string, unknown> & { children?: Child };
type Component = (props: never) => Html | null;

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// JSX prop names that differ from their HTML/SVG attribute names.
const ATTRIBUTE_NAMES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  stopColor: 'stop-color',
  fillRule: 'fill-rule',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
};

const VOID_ELEMENTS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

function styleText(style: Record<string, string | number>): string {
  return Object.entries(style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${typeof v === 'number' && v !== 0 ? `${v}px` : v}`)
    .join(';');
}

function renderChildren(children: Child): string {
  if (children === null || children === undefined || children === false || children === true) return '';
  if (Array.isArray(children)) return children.map(renderChildren).join('');
  if (children instanceof Html) return children.html;
  return escapeHtml(String(children));
}

function renderAttributes(props: Props): string {
  let out = '';
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'key' || value === null || value === undefined || value === false) continue;
    if (!/^[A-Za-z][\w:-]*$/.test(key)) throw new Error(`Invalid attribute name: ${key}`);
    const name = ATTRIBUTE_NAMES[key] ?? key;
    const text = key === 'style' && typeof value === 'object' ? styleText(value as Record<string, string | number>) : value === true ? '' : String(value);
    out += value === true ? ` ${name}` : ` ${name}="${escapeHtml(text)}"`;
  }
  return out;
}

export function jsx(type: string | Component, props: Props): Html {
  if (typeof type === 'function') return (type as (p: Props) => Html | null)(props) ?? new Html('');
  if (!/^[a-zA-Z][\w-]*$/.test(type)) throw new Error(`Invalid element name: ${type}`);
  const open = `<${type}${renderAttributes(props)}>`;
  if (VOID_ELEMENTS.has(type)) return new Html(open);
  return new Html(`${open}${renderChildren(props.children)}</${type}>`);
}

export const jsxs = jsx;
export const jsxDEV = jsx;

export function Fragment(props: { children?: Child }): Html {
  return new Html(renderChildren(props.children));
}

// Types for TypeScript's JSX checking in files using this runtime.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = Html;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export interface IntrinsicElements {
    // Any element, any attribute: these templates are internal and simple.
    [element: string]: Record<string, unknown>;
  }
}
