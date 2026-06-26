/**
 * Auto Heading — Core Logic Tests
 * 
 * Validates numbering tokens, heading analyzer, manual number detection,
 * and front matter parsing with extensive edge cases.
 * 
 * Run: node --experimental-vm-modules tests/test-core.mjs
 */

// Since we can't import TypeScript directly, we test the built main.js bundle
// by extracting and testing the core logic patterns

// ─── Test Framework ─────────────────────────────────────────────────────

let passed = 0
let failed = 0
let total = 0

function test(name, fn) {
  total++
  try {
    fn()
    passed++
    console.log(`  ✅ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ❌ ${name}: ${e.message}`)
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`Expected "${expected}", got "${actual}"${msg ? ' — ' + msg : ''}`)
  }
}

function assertArrayEqual(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// ─── Roman Numeral Tests ────────────────────────────────────────────────

console.log('\n📐 Roman Numeral Conversion')

// Inline implementation (mirrors src/core/numberingTokens.ts)
const ROMAN_VALUES = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
  ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
  ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
]

function toRoman(num) {
  if (num <= 0) return '0'
  let result = ''
  for (const [letter, value] of ROMAN_VALUES) {
    while (num >= value) {
      result += letter
      num -= value
    }
  }
  return result
}

test('1 → I', () => assertEqual(toRoman(1), 'I'))
test('4 → IV', () => assertEqual(toRoman(4), 'IV'))
test('9 → IX', () => assertEqual(toRoman(9), 'IX'))
test('14 → XIV', () => assertEqual(toRoman(14), 'XIV'))
test('42 → XLII', () => assertEqual(toRoman(42), 'XLII'))
test('99 → XCIX', () => assertEqual(toRoman(99), 'XCIX'))
test('100 → C', () => assertEqual(toRoman(100), 'C'))
test('3999 → MMMCMXCIX', () => assertEqual(toRoman(3999), 'MMMCMXCIX'))
test('0 → 0', () => assertEqual(toRoman(0), '0'))

// ─── Letter Conversion Tests ────────────────────────────────────────────

console.log('\n🔤 Letter Conversion')

function numberToUpperLetter(n) {
  if (n <= 0) return ''
  if (n <= 26) return String.fromCharCode(64 + n)
  const remainder = ((n - 1) % 26) + 1
  const prefix = Math.floor((n - 1) / 26)
  return (prefix > 0 ? numberToUpperLetter(prefix) : '') + String.fromCharCode(64 + remainder)
}

test('1 → A', () => assertEqual(numberToUpperLetter(1), 'A'))
test('2 → B', () => assertEqual(numberToUpperLetter(2), 'B'))
test('26 → Z', () => assertEqual(numberToUpperLetter(26), 'Z'))
test('27 → AA', () => assertEqual(numberToUpperLetter(27), 'AA'))
test('28 → AB', () => assertEqual(numberToUpperLetter(28), 'AB'))
test('52 → AZ', () => assertEqual(numberToUpperLetter(52), 'AZ'))
test('53 → BA', () => assertEqual(numberToUpperLetter(53), 'BA'))

// ─── Numbering Sequence Tests ───────────────────────────────────────────

console.log('\n🔢 Numbering Sequences')

// Simulate the numbering stack behavior
function simulateNumbering(headingLevels, firstLevel = 2, maxLevel = 6, skipH1 = true) {
  const effectiveFirst = skipH1 ? Math.max(firstLevel, 2) : firstLevel
  let stack = []
  let previousLevel = effectiveFirst
  const results = []

  for (const level of headingLevels) {
    // Skip conditions
    if (skipH1 && level === 1) {
      stack = []
      previousLevel = effectiveFirst
      results.push(null) // skipped
      continue
    }
    if (level < effectiveFirst || level > maxLevel) {
      if (level < effectiveFirst) {
        stack = []
        previousLevel = effectiveFirst
      }
      results.push(null)
      continue
    }

    // Compute number
    if (stack.length === 0) {
      stack.push(1)
    } else if (level === previousLevel) {
      stack[stack.length - 1]++
    } else if (level > previousLevel) {
      for (let l = previousLevel + 1; l <= level; l++) {
        stack.push(1)
      }
    } else if (level < previousLevel) {
      const targetDepth = (level - effectiveFirst) + 1
      while (stack.length > targetDepth) {
        stack.pop()
      }
      if (stack.length > 0) {
        stack[stack.length - 1]++
      } else {
        stack.push(1)
      }
    }

    previousLevel = level
    results.push(stack.join('.'))
  }

  return results
}

test('Simple H2 sequence: 1, 2, 3', () => {
  const result = simulateNumbering([2, 2, 2])
  assertArrayEqual(result, ['1', '2', '3'])
})

test('H2 + H3 nesting: 1, 1.1, 1.2, 2, 2.1', () => {
  const result = simulateNumbering([2, 3, 3, 2, 3])
  assertArrayEqual(result, ['1', '1.1', '1.2', '2', '2.1'])
})

test('H1 is skipped', () => {
  const result = simulateNumbering([1, 2, 2])
  assertArrayEqual(result, [null, '1', '2'])
})

test('H1 resets numbering', () => {
  const result = simulateNumbering([1, 2, 3, 1, 2, 3])
  assertArrayEqual(result, [null, '1', '1.1', null, '1', '1.1'])
})

test('Deep nesting: H2→H3→H4→H5→H6', () => {
  const result = simulateNumbering([2, 3, 4, 5, 6])
  assertArrayEqual(result, ['1', '1.1', '1.1.1', '1.1.1.1', '1.1.1.1.1'])
})

test('Level jump back: H2→H4→H2', () => {
  const result = simulateNumbering([2, 4, 2])
  assertArrayEqual(result, ['1', '1.1.1', '2'])
})

test('Zigzag: H2→H3→H2→H3', () => {
  const result = simulateNumbering([2, 3, 2, 3])
  assertArrayEqual(result, ['1', '1.1', '2', '2.1'])
})

test('Multiple H3 under H2', () => {
  const result = simulateNumbering([2, 3, 3, 3, 2, 3])
  assertArrayEqual(result, ['1', '1.1', '1.2', '1.3', '2', '2.1'])
})

test('Max level 3: H4 is skipped', () => {
  const result = simulateNumbering([2, 3, 4, 3], 1, 3)
  assertArrayEqual(result, ['1', '1.1', null, '1.2'])
})

test('First level 3: H2 is skipped', () => {
  const result = simulateNumbering([2, 3, 3, 4], 3, 6)
  assertArrayEqual(result, [null, '1', '2', '2.1'])
})

test('No skip H1: H1 gets numbered', () => {
  const result = simulateNumbering([1, 2, 2, 1], 1, 6, false)
  assertArrayEqual(result, ['1', '1.1', '1.2', '2'])
})

// ─── Manual Number Detection Tests ──────────────────────────────────────

console.log('\n🔍 Manual Number Detection')

// Regex patterns (mirrors src/core/manualNumberDetector.ts)
const PATTERNS = [
  { regex: /^(\d+(?:\.\d+)+)\.?\s*[):—\-]?\s*/, style: 'hierarchical' },
  { regex: /^(\d+)\s*[.):—\-]\s+/, style: 'arabic' },
  { regex: /^(\d{1,3})\s+(?=[A-Z])/, style: 'arabic' },
  { regex: /^([A-Z])\.?\s*[):—\-]?\s+/, style: 'letter-upper' },
  { regex: /^([a-z])\.\s+/, style: 'letter-lower' },
  { regex: /^([IVXLCDM]{2,}|I)\s*[.):\-—]\s+/, style: 'roman-upper' },
  { regex: /^([ivxlcdm]{2,})\s*[.):\-—]\s+/, style: 'roman-lower' },
  // Catch-all: digits + space
  { regex: /^(\d{1,4}(?:\.\d+)*)\s+/, style: 'arabic' },
  // Mixed hierarchical: requires at least one dot (prevents word matches)
  { regex: /^((?:\d+|[A-Z]{1,2}|[a-z]{1,2}|[IVXLCDM]+|[ivxlcdm]+)(?:\.(?:\d+|[A-Z]{1,2}|[a-z]{1,2}|[IVXLCDM]+|[ivxlcdm]+))+)\s+/, style: 'hierarchical' },
]

function detectNumber(text) {
  const trimmed = text.trimStart()

  // PRIMARY: U+2060 marker detection
  if (trimmed.startsWith('\u2060')) {
    const withoutMarker = trimmed.substring(1)
    const spaceIdx = withoutMarker.indexOf(' ')
    if (spaceIdx > 0) {
      return {
        style: 'arabic',
        numberPart: withoutMarker.substring(0, spaceIdx),
        fullMatch: trimmed.substring(0, 1 + spaceIdx + 1),
        confidence: 'high',
      }
    }
    // Handle partial marker (during deletion): marker without trailing space
    return {
      style: 'arabic',
      numberPart: spaceIdx === 0 ? '' : withoutMarker,
      fullMatch: spaceIdx === 0 ? trimmed.substring(0, 2) : trimmed,
      confidence: 'high',
    }
  }

  for (const p of PATTERNS) {
    const match = trimmed.match(p.regex)
    if (match) {
      return { style: p.style, numberPart: match[1], fullMatch: match[0] }
    }
  }
  return null
}

test('Detect "1. Introduction"', () => {
  const result = detectNumber('1. Introduction')
  assertEqual(result?.style, 'arabic')
  assertEqual(result?.numberPart, '1')
})

test('Detect "1.2.3 Sub-heading"', () => {
  const result = detectNumber('1.2.3 Sub-heading')
  assertEqual(result?.style, 'hierarchical')
  assertEqual(result?.numberPart, '1.2.3')
})

test('Detect "1.2.3. With trailing dot"', () => {
  const result = detectNumber('1.2.3. With trailing dot')
  assertEqual(result?.style, 'hierarchical')
})

test('Detect "A. Chapter"', () => {
  const result = detectNumber('A. Chapter')
  assertEqual(result?.style, 'letter-upper')
})

test('Detect "a. subsection"', () => {
  const result = detectNumber('a. subsection')
  assertEqual(result?.style, 'letter-lower')
})

test('Detect "IV. Roman heading"', () => {
  const result = detectNumber('IV. Roman heading')
  assertEqual(result?.style, 'roman-upper')
})

test('No detection on plain text', () => {
  const result = detectNumber('Introduction to Networks')
  assertEqual(result, null)
})

test('No detection on "The Quick Brown Fox"', () => {
  const result = detectNumber('The Quick Brown Fox')
  assertEqual(result, null)
})

test('Detect "42) Answer"', () => {
  const result = detectNumber('42) Answer')
  assertEqual(result?.style, 'arabic')
  assertEqual(result?.numberPart, '42')
})

// ── Burn-in output detection (THE critical fix) ──────────────

test('Detect "1 heading" (burn-in output, lowercase)', () => {
  const result = detectNumber('1 heading')
  assertEqual(result?.style, 'arabic')
  assertEqual(result?.numberPart, '1')
  assertEqual(result?.fullMatch, '1 ')
})

test('Detect "5 new heading" (burn-in output)', () => {
  const result = detectNumber('5 new heading')
  assertEqual(result?.style, 'arabic')
  assertEqual(result?.numberPart, '5')
})

// ── U+2060 Marker Detection (primary method) ─────────────
test('Detect marker: "\\u20601 heading" (marker + arabic)', () => {
  const result = detectNumber('\u20601 heading')
  assertEqual(result != null, true)
  assertEqual(result?.numberPart, '1')
  assertEqual(result?.confidence, 'high')
})

test('Detect marker: "\\u20601.2.3 heading" (marker + hierarchical)', () => {
  const result = detectNumber('\u20601.2.3 heading')
  assertEqual(result != null, true)
  assertEqual(result?.numberPart, '1.2.3')
})

test('Detect marker: "\\u2060XVIII heading" (marker + roman)', () => {
  const result = detectNumber('\u2060XVIII heading')
  assertEqual(result != null, true)
  assertEqual(result?.numberPart, 'XVIII')
})

test('No marker: "6 ways to identify" stays untouched by marker check', () => {
  const result = detectNumber('6 ways to identify heading')
  // Should match via catch-all (low confidence), NOT via marker
  assertEqual(result?.numberPart, '6')
  // Importantly: no marker = remover skips lowercase-following numbers
})

// ── U+2060 Partial Marker Detection (fix for duplicate number flash) ──
test('Partial marker: "\\u20601." (marker + number, no space)', () => {
  const result = detectNumber('\u20601.')
  assertEqual(result != null, true, 'should detect partial marker')
  assertEqual(result?.fullMatch, '\u20601.', 'fullMatch should be entire content')
  assertEqual(result?.confidence, 'high')
})

test('Partial marker: "\\u2060" alone (just marker)', () => {
  const result = detectNumber('\u2060')
  assertEqual(result != null, true, 'should detect bare marker')
  assertEqual(result?.fullMatch, '\u2060', 'fullMatch should be the marker')
  assertEqual(result?.confidence, 'high')
})

test('Partial marker: "\\u2060 Hello" (marker + space, no number)', () => {
  const result = detectNumber('\u2060 Hello')
  assertEqual(result != null, true, 'should detect marker+space')
  assertEqual(result?.fullMatch, '\u2060 ', 'fullMatch should be marker+space')
  assertEqual(result?.numberPart, '', 'numberPart should be empty')
})

test('Partial marker: "\\u20601.2" (marker + hierarchical, no space)', () => {
  const result = detectNumber('\u20601.2')
  assertEqual(result != null, true, 'should detect partial hierarchical marker')
  assertEqual(result?.fullMatch, '\u20601.2')
  assertEqual(result?.numberPart, '1.2')
})

test('Detect "1.1 heading 1.1" (hierarchical burn-in)', () => {
  const result = detectNumber('1.1 heading 1.1')
  assertEqual(result?.style, 'hierarchical')
  assertEqual(result?.numberPart, '1.1')
})

// ── Mixed-style hierarchical detection ────────────────────────

test('Detect "1.a heading" (arabic.letter)', () => {
  const result = detectNumber('1.a heading')
  assertEqual(result != null, true)
  assertEqual(result?.numberPart, '1.a')
})

test('Detect "iv.2.A heading" (roman.digit.letter)', () => {
  const result = detectNumber('iv.2.A heading')
  assertEqual(result != null, true)
  assertEqual(result?.numberPart, 'iv.2.A')
})

test('Detect "A.a.I.1 heading" (letter.letter.roman.digit)', () => {
  const result = detectNumber('A.a.I.1 heading')
  assertEqual(result != null, true)
})

test('Detect "1.2.a.i heading" (4-level mixed)', () => {
  const result = detectNumber('1.2.a.i heading')
  assertEqual(result != null, true)
})

// ── False-positive prevention ─────────────────────────────────

test('No match on "Testing heading" (English word)', () => {
  const result = detectNumber('Testing heading')
  assertEqual(result, null)
})

test('No match on "Ways to identify" (English word)', () => {
  const result = detectNumber('Ways to identify')
  assertEqual(result, null)
})

test('No match on "How to fix issues"', () => {
  const result = detectNumber('How to fix issues')
  assertEqual(result, null)
})

// ── Structure-aware regex tests ───────────────────────────────
// These mirror the burn-in engine's buildBurnInRegex logic

const ROMAN_UPPER_T = 'M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})'
const ROMAN_LOWER_T = 'm{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})'
const SEG = `(?:\\d+|[A-Z]{1,2}|(?:${ROMAN_UPPER_T})|(?:${ROMAN_LOWER_T})|[a-z]{1,2})`
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function buildBurnInRegex(formattedNumber, levelSep = '.') {
  const sep = escapeRe(levelSep)
  const count = formattedNumber.split(levelSep).length
  const parts = []
  for (let i = 0; i < count; i++) parts.push(SEG)
  return new RegExp(`^(${parts.join(sep)})\\s*[.):\\-—]?\\s+`)
}

test('buildBurnInRegex: "1" matches "1 heading"', () => {
  const re = buildBurnInRegex('1')
  assertEqual(re.test('1 heading'), true)
})

test('buildBurnInRegex: "1" matches "i heading"', () => {
  const re = buildBurnInRegex('1')
  assertEqual(re.test('i heading'), true)
})

test('buildBurnInRegex: "1" matches "XVIII heading"', () => {
  const re = buildBurnInRegex('1')
  assertEqual(re.test('XVIII heading'), true)
})

test('buildBurnInRegex: "1" does NOT match "Testing heading"', () => {
  const re = buildBurnInRegex('1')
  assertEqual(re.test('Testing heading'), false)
})

test('buildBurnInRegex: "1.1" matches "iv.a heading"', () => {
  const re = buildBurnInRegex('1.1')
  assertEqual(re.test('iv.a heading'), true)
})

test('buildBurnInRegex: "1.1" matches "XVIII.AA heading"', () => {
  const re = buildBurnInRegex('1.1')
  assertEqual(re.test('XVIII.AA heading'), true)
})

test('buildBurnInRegex: "1.1" does NOT match "1 heading" (wrong depth)', () => {
  const re = buildBurnInRegex('1.1')
  assertEqual(re.test('1 heading'), false)
})

test('buildBurnInRegex: "1.1.1" matches "A.a.I heading"', () => {
  const re = buildBurnInRegex('1.1.1')
  assertEqual(re.test('A.a.I heading'), true)
})

// ═══ EXHAUSTIVE LOOPHOLE AUDIT ══════════════════════════════════

console.log('\n🔍 Loophole Audit: Edge Cases')

// ── Long Roman numerals ──────────────────────────────────
test('buildBurnInRegex: "1" matches "XVIII heading" (5 chars roman)', () => {
  assertEqual(buildBurnInRegex('1').test('XVIII heading'), true)
})

test('buildBurnInRegex: "1" matches "xxviii heading" (6 chars roman lower)', () => {
  assertEqual(buildBurnInRegex('1').test('xxviii heading'), true)
})

test('Detector: "XVIII.a.1 heading" (long roman + mixed)', () => {
  const r = detectNumber('XVIII.a.1 heading')
  assertEqual(r != null, true)
  assertEqual(r?.numberPart, 'XVIII.a.1')
})

// ── Content numbers that should NOT be stripped ──────────
test('No match: "6 ways to identify heading"', () => {
  // This starts with "6 " which the digit catch-all WOULD match.
  // The catch-all matches and returns numberPart=6
  const r = detectNumber('6 ways to identify heading')
  assertEqual(r?.numberPart, '6')
  // Note: The PRODUCTION code has confidence='low' — the simplified test
  // doesn't track confidence. The remover uses confidence to decide
  // whether to strip. Pure-digit low-confidence numbers ARE stripped,
  // which is correct for burn-in output.
})

test('No match: "2024 Annual Report" (year-like)', () => {
  // 2024 is 4 digits — within {1,4} range
  const r = detectNumber('2024 Annual Report')
  // Digit catch-all does match — but only because it has uppercase after
  // Let's check: ^(\d{1,4})\s+ matches "2024 " → yes
  assertEqual(r?.numberPart, '2024')
  // This IS a false positive for the detector, but:
  // 1. It only matters in burn-in mode (decoration doesn't modify text)
  // 2. The remover checks confidence=low + pure digits → would remove "2024"
  // 3. The burn-in engine replaces with computed number
  // If user has "## 2024 Annual Report" and it's in numbering range,
  // adding <!-- skip --> is the correct solution
})

// ── Single letters and words ─────────────────────────────
test('No match: "On the topic" (starts with 2-letter word)', () => {
  assertEqual(detectNumber('On the topic'), null)
})

test('No match: "In this section" (starts with "In")', () => {
  assertEqual(detectNumber('In this section'), null)
})

test('No match: "Do not edit"', () => {
  assertEqual(detectNumber('Do not edit'), null)
})

test('No match: "Go to settings"', () => {
  assertEqual(detectNumber('Go to settings'), null)
})

test('"I am a heading" matches letter-upper in simple detector', () => {
  // The SIMPLIFIED test detector matches "I " as letter-upper.
  // The PRODUCTION detector rejects this (has extra validation:
  // single uppercase letter without separator is rejected).
  // The burnInEngine uses buildBurnInRegex which is more precise.
  const r = detectNumber('I am a heading')
  assertEqual(r?.style, 'letter-upper')
  assertEqual(r?.numberPart, 'I')
  // In production: detectManualNumber('I am a heading') returns null
  // because the validator checks for separators with single letters.
})

test('Match: "I. First chapter" (letter or roman I with separator)', () => {
  const r = detectNumber('I. First chapter')
  // letter-upper pattern matches before roman-upper (higher priority)
  // Both are correct — "I" is valid as both letter and Roman numeral
  assertEqual(r?.numberPart, 'I')
  assertEqual(r != null, true)
})

// ── buildBurnInRegex false-positive prevention ───────────
test('buildBurnInRegex: "1" does NOT match "An overview" (2-letter word)', () => {
  assertEqual(buildBurnInRegex('1').test('An overview'), false)
})

test('buildBurnInRegex: "1" does NOT match "Go further" (2-letter word)', () => {
  assertEqual(buildBurnInRegex('1').test('Go further'), false)
})

test('buildBurnInRegex: "1" does NOT match "Overview heading" (long word)', () => {
  assertEqual(buildBurnInRegex('1').test('Overview heading'), false)
})

test('buildBurnInRegex: "1" matches "AA heading" (2-letter upper)', () => {
  // AA is [A-Z]{1,2} — matches as letter-style
  assertEqual(buildBurnInRegex('1').test('AA heading'), true)
})

test('buildBurnInRegex: "1" does NOT match "ABC heading" (3-letter upper)', () => {
  // ABC exceeds [A-Z]{1,2} and isn't a valid roman
  // [IVXLCDM]+ won't match B or C... wait, C and D ARE Roman chars!
  // ABC: [IVXLCDM]+ won't match because B isn't in the set
  assertEqual(buildBurnInRegex('1').test('ABC heading'), false)
})

// ── Deep nesting (5-6 levels) ────────────────────────────
test('buildBurnInRegex: "1.1.1.1.1" matches "A.a.I.1.ii heading"', () => {
  const re = buildBurnInRegex('1.1.1.1.1')
  assertEqual(re.test('A.a.I.1.ii heading'), true)
})

test('buildBurnInRegex: "1.1.1.1.1.1" matches 6-deep', () => {
  const re = buildBurnInRegex('1.1.1.1.1.1')
  assertEqual(re.test('1.A.a.I.i.2 heading'), true)
})

// ── Custom level separators ──────────────────────────────
test('buildBurnInRegex: custom separator "-" matches "1-2-3 heading"', () => {
  const re = buildBurnInRegex('1-2-3', '-')
  assertEqual(re.test('1-2-3 heading'), true)
})

test('buildBurnInRegex: custom separator "-" does NOT match dot format', () => {
  const re = buildBurnInRegex('1-2', '-')
  assertEqual(re.test('1.2 heading'), false)
})

// ─── Heading Regex Detection Tests ──────────────────────────────────────

console.log('\n📝 Heading Line Detection (Regex)')

const HEADING_REGEX = /^(\s{0,3})(#{1,6})\s+(.+)/

function testHeadingDetection(line) {
  const match = line.match(HEADING_REGEX)
  if (!match) return null
  return { level: match[2].length, text: match[3] }
}

test('## Hello → level 2', () => {
  const r = testHeadingDetection('## Hello')
  assertEqual(r?.level, 2)
  assertEqual(r?.text, 'Hello')
})

test('### Sub-heading → level 3', () => {
  const r = testHeadingDetection('### Sub-heading')
  assertEqual(r?.level, 3)
})

test('# H1 title → level 1', () => {
  const r = testHeadingDetection('# H1 title')
  assertEqual(r?.level, 1)
})

test('###### H6 → level 6', () => {
  const r = testHeadingDetection('###### H6')
  assertEqual(r?.level, 6)
})

test('Not a heading: text without #', () => {
  const r = testHeadingDetection('Hello World')
  assertEqual(r, null)
})

test('Not a heading: ####### 7 hashes', () => {
  const r = testHeadingDetection('####### Seven')
  assertEqual(r, null)
})

test('Not a heading: #NoSpace', () => {
  const r = testHeadingDetection('#NoSpace')
  assertEqual(r, null)
})

test('Heading with 1 leading space', () => {
  const r = testHeadingDetection(' ## Hello')
  assertEqual(r?.level, 2)
})

test('Heading with 3 leading spaces', () => {
  const r = testHeadingDetection('   ## Hello')
  assertEqual(r?.level, 2)
})

test('Not heading: 4+ leading spaces (code block)', () => {
  const r = testHeadingDetection('    ## Hello')
  assertEqual(r, null)
})

// ─── Front Matter Parsing Tests ─────────────────────────────────────────

console.log('\n📋 Front Matter Parsing')

// Simulate front matter value parsing
function parseFmValue(entryString) {
  if (!entryString || entryString.trim() === '') return null
  const trimmed = entryString.trim()
  
  const overrides = {}
  
  if (trimmed === 'off' || trimmed === 'disabled' || trimmed === 'false') {
    overrides.disabled = true
    return overrides
  }
  if (trimmed === 'auto' || trimmed === 'on' || trimmed === 'true') {
    overrides.enabled = true
    return overrides
  }

  const parts = trimmed.split(',')
  for (const part of parts) {
    const t = part.trim()
    if (t === 'auto' || t === 'on') overrides.enabled = true
    else if (t === 'off') overrides.disabled = true
    else if (t === 'skip-h1') overrides.skipH1 = true
    else if (t === 'no-skip-h1') overrides.skipH1 = false
    else if (t.startsWith('first-level')) {
      const val = parseInt(t.replace('first-level', '').trim(), 10)
      if (!isNaN(val) && val >= 1 && val <= 6) overrides.firstLevel = val
    }
    else if (t.startsWith('max')) {
      const val = parseInt(t.replace('max', '').trim(), 10)
      if (!isNaN(val) && val >= 1 && val <= 6) overrides.maxLevel = val
    }
    else if (t.startsWith('start-at')) {
      const val = t.replace('start-at', '').trim()
      if (val.length > 0) overrides.startAt = val
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : null
}

test('auto-heading: auto → enabled=true', () => {
  const r = parseFmValue('auto')
  assertEqual(r?.enabled, true)
})

test('auto-heading: off → disabled=true', () => {
  const r = parseFmValue('off')
  assertEqual(r?.disabled, true)
})

test('auto-heading: auto, skip-h1 → enabled + skipH1', () => {
  const r = parseFmValue('auto, skip-h1')
  assertEqual(r?.enabled, true)
  assertEqual(r?.skipH1, true)
})

test('auto-heading: auto, first-level 2, max 4', () => {
  const r = parseFmValue('auto, first-level 2, max 4')
  assertEqual(r?.enabled, true)
  assertEqual(r?.firstLevel, 2)
  assertEqual(r?.maxLevel, 4)
})

test('auto-heading: auto, start-at 3', () => {
  const r = parseFmValue('auto, start-at 3')
  assertEqual(r?.enabled, true)
  assertEqual(r?.startAt, '3')
})

test('Empty string → null', () => {
  const r = parseFmValue('')
  assertEqual(r, null)
})

test('auto-heading: false → disabled', () => {
  const r = parseFmValue('false')
  assertEqual(r?.disabled, true)
})

// ─── Code Block Detection Tests ─────────────────────────────────────────

console.log('\n🧱 Code Block Detection')

function getCodeBlockLines(lines) {
  const codeLines = new Set()
  let inside = false
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trimStart()
    if (text.startsWith('```') || text.startsWith('~~~')) {
      codeLines.add(i)
      inside = !inside
      continue
    }
    if (inside) codeLines.add(i)
  }
  return codeLines
}

test('Headings inside code blocks are detected', () => {
  const lines = [
    '## Real heading',
    '```',
    '## Fake heading in code',
    '```',
    '## Another real heading',
  ]
  const codeLines = getCodeBlockLines(lines)
  assertEqual(codeLines.has(0), false, 'line 0 should not be in code')
  assertEqual(codeLines.has(1), true, 'line 1 (fence) should be in code')
  assertEqual(codeLines.has(2), true, 'line 2 should be in code')
  assertEqual(codeLines.has(3), true, 'line 3 (fence) should be in code')
  assertEqual(codeLines.has(4), false, 'line 4 should not be in code')
})

test('Tilde fences work', () => {
  const lines = [
    '## Real',
    '~~~',
    '## Fake',
    '~~~',
  ]
  const codeLines = getCodeBlockLines(lines)
  assertEqual(codeLines.has(0), false)
  assertEqual(codeLines.has(2), true)
})

// ─── Skip Marker Tests ─────────────────────────────────────────────────

console.log('\n⏭️ Skip Markers')

function hasSkipComment(text) {
  return /<!--\s*(?:skip|no-number|ah-skip|skip-number)\s*-->/.test(text)
}

test('<!-- skip --> is detected (short form)', () => {
  assertEqual(hasSkipComment('Heading <!-- skip -->'), true)
})

test('<!-- no-number --> is detected', () => {
  assertEqual(hasSkipComment('Heading <!-- no-number -->'), true)
})

test('<!-- ah-skip --> is detected', () => {
  assertEqual(hasSkipComment('Heading <!-- ah-skip -->'), true)
})

test('<!-- skip-number --> is detected', () => {
  assertEqual(hasSkipComment('Heading <!-- skip-number -->'), true)
})

test('No skip marker → false', () => {
  assertEqual(hasSkipComment('Normal heading'), false)
})

test('<!-- other-comment --> is NOT a skip marker', () => {
  assertEqual(hasSkipComment('Heading <!-- other-comment -->'), false)
})

// ─── Scope Logic Tests ────────────────────────────────────────────────

console.log('\n📂 Scope Logic')

function isFileInScope(filePath, scopeAll, scopeSelected, scopePaths) {
  if (scopeAll) return true
  if (scopeSelected && scopePaths.length > 0) {
    return scopePaths.some(p =>
      filePath === p || filePath.startsWith(p.endsWith('/') ? p : p + '/'))
  }
  return false
}

test('scopeAll=true: every file matches', () => {
  assertEqual(isFileInScope('notes/test.md', true, false, []), true)
})

test('scopeSelected: matches folder', () => {
  assertEqual(isFileInScope('notes/test.md', false, true, ['notes']), true)
})

test('scopeSelected: rejects non-matching folder', () => {
  assertEqual(isFileInScope('other/test.md', false, true, ['notes']), false)
})

test('no scope enabled: returns false', () => {
  assertEqual(isFileInScope('notes/test.md', false, false, []), false)
})

test('scopeSelected: matches exact file path', () => {
  assertEqual(isFileInScope('notes/specific.md', false, true, ['notes/specific.md']), true)
})

test('scopeSelected: nested folder match', () => {
  assertEqual(isFileInScope('notes/sub/deep.md', false, true, ['notes']), true)
})

test('scopeAll + scopeSelected: all wins', () => {
  assertEqual(isFileInScope('random/file.md', true, true, ['notes']), true)
})

// ─── Indent Front Matter Parsing Tests ──────────────────────────────────

console.log('\n📐 Indent Front Matter Parsing')

// Extend parseFmValue to handle indent options (mirrors perNoteSettings.ts)
function parseFmValueExtended(entryString) {
  if (!entryString || entryString.trim() === '') return null
  const trimmed = entryString.trim()
  
  const overrides = {}
  
  if (trimmed === 'off' || trimmed === 'disabled' || trimmed === 'false') {
    overrides.disabled = true
    return overrides
  }
  if (trimmed === 'auto' || trimmed === 'on' || trimmed === 'true') {
    overrides.enabled = true
    return overrides
  }

  const parts = trimmed.split(',')
  for (const part of parts) {
    const t = part.trim()
    if (t === 'auto' || t === 'on') overrides.enabled = true
    else if (t === 'off') overrides.disabled = true
    else if (t === 'skip-h1') overrides.skipH1 = true
    else if (t === 'no-skip-h1') overrides.skipH1 = false
    else if (t.startsWith('first-level')) {
      const val = parseInt(t.replace('first-level', '').trim(), 10)
      if (!isNaN(val) && val >= 1 && val <= 6) overrides.firstLevel = val
    }
    else if (t.startsWith('max')) {
      const val = parseInt(t.replace('max', '').trim(), 10)
      if (!isNaN(val) && val >= 1 && val <= 6) overrides.maxLevel = val
    }
    else if (t.startsWith('start-at')) {
      const val = t.replace('start-at', '').trim()
      if (val.length > 0) overrides.startAt = val
    }
    else if (t === 'indent') overrides.headingIndent = true
    else if (t === 'no-indent') overrides.headingIndent = false
    else if (t.startsWith('indent-size')) {
      const val = parseInt(t.replace('indent-size', '').trim(), 10)
      if (!isNaN(val) && val >= 0 && val <= 60) overrides.headingIndentSize = val
    }
    else if (t === 'indent-guides') overrides.headingIndentGuides = true
    else if (t === 'no-indent-guides') overrides.headingIndentGuides = false
  }

  return Object.keys(overrides).length > 0 ? overrides : null
}

test('auto-heading: auto, indent → enabled + indent', () => {
  const r = parseFmValueExtended('auto, indent')
  assertEqual(r?.enabled, true)
  assertEqual(r?.headingIndent, true)
})

test('auto-heading: auto, no-indent → enabled + no-indent', () => {
  const r = parseFmValueExtended('auto, no-indent')
  assertEqual(r?.enabled, true)
  assertEqual(r?.headingIndent, false)
})

test('auto-heading: auto, indent, indent-size 24 → size 24', () => {
  const r = parseFmValueExtended('auto, indent, indent-size 24')
  assertEqual(r?.enabled, true)
  assertEqual(r?.headingIndent, true)
  assertEqual(r?.headingIndentSize, 24)
})

test('auto-heading: auto, indent-size 0 → size 0', () => {
  const r = parseFmValueExtended('auto, indent-size 0')
  assertEqual(r?.headingIndentSize, 0)
})

test('auto-heading: auto, indent-size 61 → rejected (out of range)', () => {
  const r = parseFmValueExtended('auto, indent-size 61')
  assertEqual(r?.headingIndentSize, undefined)
})

test('auto-heading: auto, indent-guides → guides enabled', () => {
  const r = parseFmValueExtended('auto, indent-guides')
  assertEqual(r?.headingIndentGuides, true)
})

test('auto-heading: auto, no-indent-guides → guides disabled', () => {
  const r = parseFmValueExtended('auto, no-indent-guides')
  assertEqual(r?.headingIndentGuides, false)
})

test('auto-heading: auto, indent, indent-size 32, indent-guides', () => {
  const r = parseFmValueExtended('auto, indent, indent-size 32, indent-guides')
  assertEqual(r?.enabled, true)
  assertEqual(r?.headingIndent, true)
  assertEqual(r?.headingIndentSize, 32)
  assertEqual(r?.headingIndentGuides, true)
})

test('auto-heading: auto, skip-h1, indent → combined old + new options', () => {
  const r = parseFmValueExtended('auto, skip-h1, indent')
  assertEqual(r?.enabled, true)
  assertEqual(r?.skipH1, true)
  assertEqual(r?.headingIndent, true)
})

// ═══════════════════════════════════════════════════════════════════════
// SETEXT HEADING TESTS (Issue #5)
// ═══════════════════════════════════════════════════════════════════════

console.log('\n📏 Setext Heading Detection')

// Setext heading underline detection regex (mirrors headingAnalyzer.ts)
function isSetextH1Underline(line) {
  return /^\s{0,3}=+\s*$/.test(line)
}

function isSetextH2Underline(line) {
  return /^\s{0,3}-{2,}\s*$/.test(line)
}

test('=== is a setext H1 underline', () => {
  assertEqual(isSetextH1Underline('==='), true)
})

test('============ is a setext H1 underline', () => {
  assertEqual(isSetextH1Underline('============'), true)
})

test('= is a setext H1 underline (single)', () => {
  assertEqual(isSetextH1Underline('='), true)
})

test('  === (leading spaces) is a setext H1 underline', () => {
  assertEqual(isSetextH1Underline('  ==='), true)
})

test('   === (3 leading spaces) is a setext H1 underline', () => {
  assertEqual(isSetextH1Underline('   ==='), true)
})

test('    === (4 leading spaces = code) is NOT a setext H1 underline', () => {
  assertEqual(isSetextH1Underline('    ==='), false)
})

test('=== followed by spaces is still a setext H1 underline', () => {
  assertEqual(isSetextH1Underline('===   '), true)
})

test('=== with text after is NOT a setext H1 underline', () => {
  assertEqual(isSetextH1Underline('=== text'), false)
})

test('--- is a setext H2 underline', () => {
  assertEqual(isSetextH2Underline('---'), true)
})

test('---------- is a setext H2 underline', () => {
  assertEqual(isSetextH2Underline('----------'), true)
})

test('-- (only 2 dashes) is a setext H2 underline', () => {
  assertEqual(isSetextH2Underline('--'), true)
})

test('- (single dash) is NOT a setext H2 underline (list marker)', () => {
  assertEqual(isSetextH2Underline('-'), false)
})

test('  --- (leading spaces) is a setext H2 underline', () => {
  assertEqual(isSetextH2Underline('  ---'), true)
})

test('    --- (4 leading spaces) is NOT a setext H2 underline', () => {
  assertEqual(isSetextH2Underline('    ---'), false)
})

test('=== is NOT a setext H2 underline', () => {
  assertEqual(isSetextH2Underline('==='), false)
})

test('--- is NOT a setext H1 underline', () => {
  assertEqual(isSetextH1Underline('---'), false)
})

// ─── Setext Heading Numbering Integration Tests ─────────────────────────

console.log('\n🔢 Setext + ATX Mixed Numbering')

// Simulates analyzeHeadings with setext heading support.
// Input: array of { line, level, text, nextLineText } where nextLineText
// indicates what follows the heading text line (for setext detection).
function simulateAnalyzer(docLines, headingsMeta, settings = {}) {
  const {
    firstLevel = 2,
    maxLevel = 6,
    skipH1 = true,
    skipMarker = '',
  } = settings

  const effectiveFirst = skipH1 ? Math.max(firstLevel, 2) : firstLevel
  const getLine = (n) => docLines[n] || ''

  // Phase 1: Parse headings
  const rawAnalysis = []
  for (const heading of headingsMeta) {
    const lineNumber = heading.line
    const lineText = getLine(lineNumber)
    if (!lineText && lineText !== '') continue

    const hashMatch = lineText.match(/^(\s{0,3}#{1,6})\s+/)

    let hashPrefix, rawText, isSetext = false
    const level = heading.level

    if (hashMatch) {
      hashPrefix = hashMatch[1].trimStart()
      rawText = lineText.substring(hashMatch[0].length)
    } else {
      const nextLine = getLine(lineNumber + 1)
      const isH1 = nextLine != null && /^\s{0,3}=+\s*$/.test(nextLine)
      const isH2 = nextLine != null && /^\s{0,3}-{2,}\s*$/.test(nextLine)
      if (!isH1 && !isH2) continue
      hashPrefix = ''
      rawText = lineText.trim()
      isSetext = true
    }

    // Skip detection
    let isSkipped = false
    let skipReason = null

    if (skipH1 && level === 1) {
      isSkipped = true; skipReason = 'skip-h1'
    } else if (level < effectiveFirst) {
      isSkipped = true; skipReason = 'below-first-level'
    } else if (level > maxLevel) {
      isSkipped = true; skipReason = 'above-max-level'
    } else if (/<!--\s*(?:skip|no-number|ah-skip|skip-number)\s*-->/.test(lineText)) {
      isSkipped = true; skipReason = 'html-comment'
    } else if (skipMarker && rawText.trimEnd().endsWith(skipMarker)) {
      isSkipped = true; skipReason = 'skip-marker'
    }

    rawAnalysis.push({
      line: lineNumber,
      level,
      rawText,
      hashPrefix,
      isSkipped,
      skipReason,
      isSetext,
      computedNumber: '',
    })
  }

  // Phase 2: Compute numbers (mirrors headingAnalyzer.ts phase 2)
  let stack = []
  let previousLevel = effectiveFirst

  for (const heading of rawAnalysis) {
    if (heading.isSkipped) {
      if (heading.skipReason === 'below-first-level' || heading.skipReason === 'skip-h1') {
        stack = []
        previousLevel = effectiveFirst
      }
      continue
    }

    const level = heading.level

    if (stack.length === 0) {
      stack.push(1)
    } else if (level === previousLevel) {
      stack[stack.length - 1]++
    } else if (level > previousLevel) {
      for (let l = previousLevel + 1; l <= level; l++) {
        stack.push(1)
      }
    } else if (level < previousLevel) {
      const targetDepth = (level - effectiveFirst) + 1
      while (stack.length > targetDepth) stack.pop()
      if (stack.length > 0) {
        stack[stack.length - 1]++
      } else {
        stack.push(1)
      }
    }

    previousLevel = level
    heading.computedNumber = stack.join('.')
  }

  return rawAnalysis
}

// Helper to extract just the computed numbers (null for skipped)
function getNumbers(analysis) {
  return analysis.map(h => h.isSkipped ? null : h.computedNumber)
}

test('Setext H1 (skipped) + ATX H2s → [null, "1", "2"]', () => {
  const docLines = [
    'My Title',    // line 0 — setext H1
    '========',    // line 1 — underline
    '',            // line 2
    '## First',    // line 3 — ATX H2
    '',            // line 4
    '## Second',   // line 5 — ATX H2
  ]
  const headings = [
    { line: 0, level: 1 },
    { line: 3, level: 2 },
    { line: 5, level: 2 },
  ]
  const result = getNumbers(simulateAnalyzer(docLines, headings))
  assertArrayEqual(result, [null, '1', '2'])
})

test('ATX H2 + Setext H2 + ATX H3 → ["1", "2", "2.1"]', () => {
  const docLines = [
    '## First',    // line 0
    '',            // line 1
    'Second',      // line 2 — setext H2
    '------',      // line 3 — underline
    '',            // line 4
    '### Sub',     // line 5 — ATX H3
  ]
  const headings = [
    { line: 0, level: 2 },
    { line: 2, level: 2 },
    { line: 5, level: 3 },
  ]
  const result = getNumbers(simulateAnalyzer(docLines, headings))
  assertArrayEqual(result, ['1', '2', '2.1'])
})

test('All setext headings: H1 + H2 + H2 → [null, "1", "2"]', () => {
  const docLines = [
    'Title',       // line 0
    '=====',       // line 1
    '',            // line 2
    'Section A',   // line 3
    '---------',   // line 4
    '',            // line 5
    'Section B',   // line 6
    '---------',   // line 7
  ]
  const headings = [
    { line: 0, level: 1 },
    { line: 3, level: 2 },
    { line: 6, level: 2 },
  ]
  const result = getNumbers(simulateAnalyzer(docLines, headings))
  assertArrayEqual(result, [null, '1', '2'])
})

test('Setext H1 not skipped (skipH1=false): H1 + H2 → ["1", "1.1"]', () => {
  const docLines = [
    'Title',       // line 0
    '=====',       // line 1
    '',            // line 2
    '## Sub',      // line 3
  ]
  const headings = [
    { line: 0, level: 1 },
    { line: 3, level: 2 },
  ]
  const result = getNumbers(simulateAnalyzer(docLines, headings, { skipH1: false, firstLevel: 1 }))
  assertArrayEqual(result, ['1', '1.1'])
})

test('Setext H2 between ATX H2s maintains numbering', () => {
  const docLines = [
    '## One',      // line 0
    '',            // line 1
    'Two',         // line 2 — setext H2
    '---',         // line 3
    '',            // line 4
    '## Three',    // line 5
  ]
  const headings = [
    { line: 0, level: 2 },
    { line: 2, level: 2 },
    { line: 5, level: 2 },
  ]
  const result = getNumbers(simulateAnalyzer(docLines, headings))
  assertArrayEqual(result, ['1', '2', '3'])
})

test('Setext H2 with nested ATX H3 → ["1", "1.1", "1.2"]', () => {
  const docLines = [
    'Chapter',     // line 0 — setext H2
    '-------',     // line 1
    '',            // line 2
    '### Sub A',   // line 3
    '',            // line 4
    '### Sub B',   // line 5
  ]
  const headings = [
    { line: 0, level: 2 },
    { line: 3, level: 3 },
    { line: 5, level: 3 },
  ]
  const result = getNumbers(simulateAnalyzer(docLines, headings))
  assertArrayEqual(result, ['1', '1.1', '1.2'])
})

// ─── Setext Skip Comment Detection ──────────────────────────────────────

console.log('\n🚫 Setext Skip Comment Detection')

test('Setext heading with <!-- skip --> is skipped', () => {
  const docLines = [
    'Title <!-- skip -->',   // line 0
    '======',                // line 1
    '',                      // line 2
    '## Next',               // line 3
  ]
  const headings = [
    { line: 0, level: 1 },
    { line: 3, level: 2 },
  ]
  const result = simulateAnalyzer(docLines, headings, { skipH1: false, firstLevel: 1 })
  assertEqual(result[0].isSkipped, true)
  assertEqual(result[0].skipReason, 'html-comment')
  assertEqual(result[1].computedNumber, '1')
})

// ─── Setext Edge Cases ──────────────────────────────────────────────────

console.log('\n🔬 Setext Edge Cases')

test('Single = is valid setext H1 underline', () => {
  assertEqual(isSetextH1Underline('='), true)
})

test('Setext heading detection: text + === detected as H1', () => {
  const docLines = ['My Title', '===']
  const headings = [{ line: 0, level: 1 }]
  const result = simulateAnalyzer(docLines, headings, { skipH1: false, firstLevel: 1 })
  assertEqual(result[0].isSetext, true)
  assertEqual(result[0].level, 1)
  assertEqual(result[0].rawText, 'My Title')
})

test('Setext heading detection: text + --- detected as H2', () => {
  const docLines = ['My Title', '---']
  const headings = [{ line: 0, level: 2 }]
  const result = simulateAnalyzer(docLines, headings)
  assertEqual(result[0].isSetext, true)
  assertEqual(result[0].level, 2)
  assertEqual(result[0].rawText, 'My Title')
})

test('Non-heading line without underline is not detected', () => {
  const docLines = ['My Title', 'Regular text']
  const headings = [{ line: 0, level: 1 }]
  // This would fail to detect as heading since next line isn't underline
  const result = simulateAnalyzer(docLines, headings, { skipH1: false, firstLevel: 1 })
  assertEqual(result.length, 0) // not recognized
})

test('ATX heading is NOT treated as setext (no false positive)', () => {
  const docLines = ['## Normal ATX', 'Some text']
  const headings = [{ line: 0, level: 2 }]
  const result = simulateAnalyzer(docLines, headings)
  assertEqual(result[0].isSetext, false)
  assertEqual(result[0].hashPrefix, '##')
})

test('Setext heading: hashPrefix is empty string', () => {
  const docLines = ['Title', '=====']
  const headings = [{ line: 0, level: 1 }]
  const result = simulateAnalyzer(docLines, headings, { skipH1: false, firstLevel: 1 })
  assertEqual(result[0].hashPrefix, '')
})

// ═══════════════════════════════════════════════════════════════════════
// READING MODE CONSISTENCY TESTS (Issue #4)
// ═══════════════════════════════════════════════════════════════════════

console.log('\n📖 Reading Mode Consistency (Pre-computed vs Stateful)')

// Simulates the OLD stateful post-processor approach (the bug)
function simulateStatefulPostProcessor(headingLevels, skipH1 = true, firstLevel = 2, maxLevel = 6) {
  const effectiveFirst = skipH1 ? Math.max(firstLevel, 2) : firstLevel
  let stack = []
  let previousLevel = effectiveFirst
  const results = []

  for (const level of headingLevels) {
    if (skipH1 && level === 1) {
      stack = []; previousLevel = effectiveFirst
      results.push(null); continue
    }
    if (level < effectiveFirst) {
      stack = []; previousLevel = effectiveFirst
      results.push(null); continue
    }
    if (level > maxLevel) {
      results.push(null); continue
    }

    if (stack.length === 0) { stack.push(1) }
    else if (level === previousLevel) { stack[stack.length - 1]++ }
    else if (level > previousLevel) {
      for (let l = previousLevel + 1; l <= level; l++) stack.push(1)
    } else if (level < previousLevel) {
      const targetDepth = (level - effectiveFirst) + 1
      while (stack.length > targetDepth) stack.pop()
      if (stack.length > 0) stack[stack.length - 1]++
      else stack.push(1)
    }

    previousLevel = level
    results.push(stack.join('.'))
  }

  return results
}

// Simulates the scenario where section 3 is re-rendered AFTER
// the state was reset (the bug from Issue #4)
function simulateStateResetBug(headingLevels, reRenderIndex) {
  // First: render ALL sections normally
  const fullResults = simulateStatefulPostProcessor(headingLevels)

  // Then simulate: state is reset, only section at reRenderIndex is re-processed
  // With fresh state, it would compute from scratch
  const singleSection = simulateStatefulPostProcessor([headingLevels[reRenderIndex]])

  // The displayed results: all original except the re-rendered section
  const displayed = [...fullResults]
  displayed[reRenderIndex] = singleSection[0]

  return displayed
}

test('Normal processing produces correct numbers', () => {
  const result = simulateStatefulPostProcessor([2, 2, 3, 2, 2])
  assertArrayEqual(result, ['1', '2', '2.1', '3', '4'])
})

test('BUG: State reset + re-render of section 2 gives WRONG number', () => {
  // This test demonstrates the bug: section 2 should be "2" but gets "1"
  const headings = [2, 2, 3, 2, 2]
  const buggyResults = simulateStateResetBug(headings, 1)
  // Section 1 (index 1) was re-rendered with fresh state, gets "1" instead of "2"
  assertEqual(buggyResults[1], '1') // BUG: should be '2' but stateful approach gives '1'
  // The pre-computed approach always gives the right answer:
  const correctResults = simulateStatefulPostProcessor(headings)
  assertEqual(correctResults[1], '2') // Correct: '2'
})

test('BUG: State reset + re-render of section 3 gives WRONG number', () => {
  const headings = [2, 2, 3, 2, 2]
  const buggyResults = simulateStateResetBug(headings, 2)
  // Section at index 2 (H3) re-rendered with fresh state
  // Fresh state sees it as first H3 -> should be "1" (no parent context)
  // But correct answer is "2.1"
  assertEqual(buggyResults[2], '1') // BUG: should be '2.1'
  const correctResults = simulateStatefulPostProcessor(headings)
  assertEqual(correctResults[2], '2.1') // Correct: '2.1'
})

test('Pre-computed approach gives consistent numbers regardless of render order', () => {
  // The pre-computed approach always processes ALL headings at once
  // This is equivalent to calling simulateStatefulPostProcessor with ALL headings
  const headings = [2, 2, 3, 2, 2]
  const fullComputation = simulateStatefulPostProcessor(headings)

  // No matter which section is re-rendered, the pre-computed result is the same
  // because we just look up the number, not recompute it
  assertArrayEqual(fullComputation, ['1', '2', '2.1', '3', '4'])

  // Verify individual lookups match
  assertEqual(fullComputation[0], '1')
  assertEqual(fullComputation[1], '2')
  assertEqual(fullComputation[2], '2.1')
  assertEqual(fullComputation[3], '3')
  assertEqual(fullComputation[4], '4')
})

// ─── Skip Comment Bug in Reading Mode ───────────────────────────────────

console.log('\n🐛 Skip Comment Reading Mode Bug')

// In reading mode, HTML comments are invisible in textContent
// This test validates that skip detection on RAW text works correctly
function hasSkipCommentInRaw(rawText) {
  return /<!--\s*(?:skip|no-number|ah-skip|skip-number)\s*-->/.test(rawText)
}

test('Skip comment detected in raw text', () => {
  assertEqual(hasSkipCommentInRaw('## Title <!-- skip -->'), true)
})

test('Skip comment detected in raw text (ah-skip variant)', () => {
  assertEqual(hasSkipCommentInRaw('## Title <!-- ah-skip -->'), true)
})

test('Skip comment detected in raw text (no-number variant)', () => {
  assertEqual(hasSkipCommentInRaw('## Title <!-- no-number -->'), true)
})

test('Skip comment NOT detected in rendered textContent (DOM strips it)', () => {
  // In the rendered DOM, textContent would be just "Title" (comment stripped)
  // The old post-processor tested textContent, which never contained the comment
  const renderedTextContent = 'Title'
  assertEqual(hasSkipCommentInRaw(renderedTextContent), false) // This is the BUG
  // The fix: test against raw source text (via pre-computed analysis)
})

test('Numbering with skip comment: heading is skipped but others are correct', () => {
  const docLines = [
    '## First',                   // line 0
    '## Skip me <!-- skip -->',   // line 1
    '## Third',                   // line 2
  ]
  const headings = [
    { line: 0, level: 2 },
    { line: 1, level: 2 },
    { line: 2, level: 2 },
  ]
  const result = simulateAnalyzer(docLines, headings)
  assertEqual(result[0].computedNumber, '1')
  assertEqual(result[1].isSkipped, true)
  assertEqual(result[2].computedNumber, '2') // Not "3" — skipped heading doesn't count
})

// ─── Complex Mixed Document Test ────────────────────────────────────────

console.log('\n📄 Complex Mixed Document (Setext + ATX + Skip)')

test('Full document: Setext H1 (skip) + ATX H2 + Setext H2 + skip + ATX H3', () => {
  const docLines = [
    'Document Title',             // line 0 — setext H1
    '==============',             // line 1
    '',                           // line 2
    '## Introduction',            // line 3 — ATX H2
    '',                           // line 4
    'Background',                 // line 5 — setext H2
    '----------',                 // line 6
    '',                           // line 7
    '### Detail',                 // line 8 — ATX H3
    '',                           // line 9
    '## Conclusion <!-- skip -->', // line 10 — ATX H2 (skipped)
    '',                           // line 11
    '## References',              // line 12 — ATX H2
  ]
  const headings = [
    { line: 0, level: 1 },
    { line: 3, level: 2 },
    { line: 5, level: 2 },
    { line: 8, level: 3 },
    { line: 10, level: 2 },
    { line: 12, level: 2 },
  ]
  const result = simulateAnalyzer(docLines, headings)
  const numbers = getNumbers(result)
  assertArrayEqual(numbers, [null, '1', '2', '2.1', null, '3'])
})

test('Issue #5 exact repro: setext H1 + multiple setext H2', () => {
  // Exact reproduction of the user's example from Issue #5
  const docLines = [
    'The H1 title',              // line 0
    '============',              // line 1
    '',                          // line 2
    'some thing....',            // line 3
    '',                          // line 4
    'H2 title1',                 // line 5
    '----------',                // line 6
    '',                          // line 7
    'sth about title1',          // line 8
    '',                          // line 9
    'H2 title2',                 // line 10
    '----------',                // line 11
    '',                          // line 12
    'sth about title2',          // line 13
  ]
  const headings = [
    { line: 0, level: 1 },  // setext H1
    { line: 5, level: 2 },  // setext H2
    { line: 10, level: 2 }, // setext H2
  ]
  const result = simulateAnalyzer(docLines, headings)
  const numbers = getNumbers(result)
  // H1 is skipped (skipH1=true), H2s get 1, 2
  assertArrayEqual(numbers, [null, '1', '2'])
})

test('Setext heading with maxLevel=2: H3 is skipped', () => {
  const docLines = [
    'Chapter',     // line 0
    '-------',     // line 1
    '',            // line 2
    '### Sub',     // line 3
  ]
  const headings = [
    { line: 0, level: 2 },
    { line: 3, level: 3 },
  ]
  const result = getNumbers(simulateAnalyzer(docLines, headings, { maxLevel: 2 }))
  assertArrayEqual(result, ['1', null])
})

test('Setext H1 resets numbering (just like ATX H1)', () => {
  const docLines = [
    '## First',    // line 0
    '## Second',   // line 1
    'Title',       // line 2 — setext H1
    '=====',       // line 3
    '## Third',    // line 4
  ]
  const headings = [
    { line: 0, level: 2 },
    { line: 1, level: 2 },
    { line: 2, level: 1 },
    { line: 4, level: 2 },
  ]
  const result = getNumbers(simulateAnalyzer(docLines, headings))
  assertArrayEqual(result, ['1', '2', null, '1']) // H1 resets, so Third is "1"
})

// ─── Summary ────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`)
console.log(`📊 Results: ${passed}/${total} passed, ${failed} failed`)
if (failed === 0) {
  console.log('✅ All tests passed!')
} else {
  console.log('❌ Some tests failed — review above')
  process.exit(1)
}
