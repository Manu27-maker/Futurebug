/* ================================================================== */
/* FutureBug — mock data and shared constants                         */
/* These are intentionally unchanged so the UI can be tested offline. */
/* ================================================================== */

export const mockResults = [
  {
    ticket: 'Bug #4521',
    title: 'Checkout fails silently with promo + gift card combo',
    description:
      'processOrder() handles 14 responsibilities — this edge case was missed.',
    recommendation:
      'Split the function into smaller functions, each handling one responsibility.',
    suggested_fix:
      '# one responsibility per helper\ndef process_order(self, cart, user):\n    charge = self._charge(cart, user)\n    self._reserve_and_screen(cart, charge)\n    return charge',
    lines: [12, 13, 14],
  },
  {
    ticket: 'Bug #4522',
    title: 'Duplicate validation logic causes inconsistent error messages',
    description:
      'The same validation was copy-pasted in two places and diverged over time.',
    recommendation:
      'Extract duplicated validation into a reusable function or shared module.',
    suggested_fix:
      '# both copies go through one helper\nself._shared_step(promo)\n\n# then delete the duplicate copy',
    lines: [22, 23],
  },
]

export const LANGUAGES = {
  python: {
    label: 'Python',
    dot: '#4b9fe1',
    file: 'checkout_service.py',
  },
  javascript: {
    label: 'JavaScript',
    dot: '#e9c46a',
    file: 'checkout-service.js',
  },
  java: { label: 'Java', dot: '#ed8b00', file: 'CheckoutService.java' },
  typescript: { label: 'TypeScript', dot: '#3178c6', file: 'checkout-service.ts' },
  c: { label: 'C', dot: '#659ad2', file: 'checkout_service.c' },
  cpp: { label: 'C++', dot: '#00599c', file: 'checkout_service.cpp' },
  go: { label: 'Go', dot: '#00add8', file: 'checkout_service.go' },
  rust: { label: 'Rust', dot: '#ce422b', file: 'checkout_service.rs' },
  php: { label: 'PHP', dot: '#777bb4', file: 'checkout_service.php' },
  ruby: { label: 'Ruby', dot: '#cc342d', file: 'checkout_service.rb' },
  dart: { label: 'Dart', dot: '#0175c2', file: 'checkout_service.dart' },
}

export const SAMPLES = {
  python: `import logging
from payments import gateway, fraud
from inventory import reserve_stock

logger = logging.getLogger(__name__)


class CheckoutService:
    """Every checkout concern lives in one method."""

    def process_order(self, cart, user, promo=None, gift_card=None):
        total = sum(item.price for item in cart.items)
        tax = gateway.calculate_tax(total, user.region)
        charge = gateway.charge(user, total + tax)
        if promo:
            total = promo.apply(total)
            charge = gateway.reauthorize(user, total + tax)
        if gift_card:
            gift_card.redeem(charge.amount)
        reserve_stock(cart.items)
        fraud.screen(charge, user)
        self._validate_promo(promo)
        self._validate_promo(promo)  # copy-pasted in two places
        logger.info("order placed for %s", user.id)
        return charge

    def _validate_promo(self, promo):
        return promo is None or promo.is_active`,
  javascript: `import { chargeCard } from "./payments.js";
import { reserveStock } from "./inventory.js";

export class CheckoutService {
  constructor(cart, user) {
    this.cart = cart;
    this.user = user;
  }

  async processOrder(promo = null, giftCard = null) {
    let total = this.cart.items.reduce((sum, item) => sum + item.price, 0);
    const tax = await this.quoteTax(total, this.user.region);
    let charge = await chargeCard(this.user, total + tax);
    if (promo) {
      total = promo.apply(total);
      charge = await chargeCard(this.user, total + tax);
    }
    if (giftCard) {
      await giftCard.redeem(charge.amount);
    }
    await reserveStock(this.cart.items);
    this.validatePromo(promo);
    this.validatePromo(promo); // duplicated, already drifted
    return charge;
  }

  validatePromo(promo) {
    return !promo || promo.active;
  }
}`,
  java: 'class CheckoutService {\n  int total(int price, int tax) {\n    if (price > 0 && tax > 0 && price < 1000) {\n      return price + tax;\n    }\n    return price;\n  }\n}',
  typescript: 'function total(price: number, tax: number): number {\n  if (price > 0 && tax > 0 && price < 1000) {\n    return price + tax;\n  }\n  return price;\n}',
  c: 'int total(int price, int tax) {\n  if (price > 0 && tax > 0 && price < 1000) {\n    return price + tax;\n  }\n  return price;\n}',
  cpp: 'int total(int price, int tax) {\n  if (price > 0 && tax > 0 && price < 1000) {\n    return price + tax;\n  }\n  return price;\n}',
  go: 'package main\n\nfunc total(price int, tax int) int {\n  if price > 0 && tax > 0 && price < 1000 {\n    return price + tax\n  }\n  return price\n}',
  rust: 'fn total(price: i32, tax: i32) -> i32 {\n    if price > 0 && tax > 0 && price < 1000 {\n        return price + tax;\n    }\n    price\n}',
  php: '<?php\nfunction total(int $price, int $tax): int {\n  if ($price > 0 && $tax > 0 && $price < 1000) {\n    return $price + $tax;\n  }\n  return $price;\n}',
  ruby: 'def total(price, tax)\n  if price > 0 && tax > 0 && price < 1000\n    price + tax\n  else\n    price\n  end\nend',
  dart: 'int total(int price, int tax) {\n  if (price > 0 && tax > 0 && price < 1000) {\n    return price + tax;\n  }\n  return price;\n}',
}

export const TONES = ['red', 'amber']

export const MAX_SOURCE_BYTES = 200 * 1024

const SOURCE_EXTENSIONS = {
  py: 'python',
  pyw: 'python',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  java: 'java',
  ts: 'typescript',
  tsx: 'typescript',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  dart: 'dart',
}

/** Map a file name to a language the analyzer supports, or null. */
export function languageForFile(fileName) {
  const extension = fileName.includes('.')
    ? fileName.split('.').pop().toLowerCase()
    : ''

  return Object.hasOwn(SOURCE_EXTENSIONS, extension)
    ? SOURCE_EXTENSIONS[extension]
    : null
}

/** Best-effort language guess for pasted snippets; file extensions take priority in the UI. */
export function detectLanguageFromCode(source, fallback = 'python') {
  const code = source || ''
  const tests = [
    ['php', /<\?php|\$[A-Za-z_]\w*\s*=/],
    ['dart', /import\s+['"]dart:|\bWidget\s+build\s*\(/],
    ['go', /^\s*package\s+\w+|\bfunc\s+main\s*\(/m],
    ['rust', /^\s*(?:pub\s+)?fn\s+\w+|\blet\s+mut\s+/m],
    ['python', /^\s*def\s+\w+\s*\(|^\s*from\s+\w+\s+import\s+/m],
    ['ruby', /^\s*def\s+\w+|\bputs\s+['"]/m],
    ['typescript', /\binterface\s+\w+|:\s*(?:string|number|boolean)\b|\btype\s+\w+\s*=/],
    ['java', /\bpublic\s+(?:static\s+)?class\s+\w+|\bpublic\s+static\s+void\s+main\s*\(/],
    ['cpp', /#include\s*<\w+>|\bstd::|\bcout\s*<</],
    ['c', /#include\s*[<"](?:stdio|stdlib|string)\.h[>"]|\bprintf\s*\(/],
    ['javascript', /\b(?:const|let)\s+\w+\s*=|\bexport\s+(?:default|const|function)|\([^)]*\)\s*=>/],
  ]
  return tests.find(([, pattern]) => pattern.test(code))?.[0] || fallback
}

export const THEME_KEY = 'futurebug-theme'

export function getInitialTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be blocked; fall back to the default.
  }
  return 'dark'
}

export function formatLines(lines) {
  if (!lines || lines.length === 0) return '—'

  const sorted = [...lines].sort((a, b) => a - b)
  const contiguous = sorted.every(
    (line, index) => index === 0 || line === sorted[index - 1] + 1,
  )

  if (!contiguous) return sorted.join(', ')
  if (sorted.length === 1) return String(sorted[0])

  return `${sorted[0]}–${sorted[sorted.length - 1]}`
}
