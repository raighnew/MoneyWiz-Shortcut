// Generates dist/MoneyWiz-Pure.shortcut — a 100% built-in-actions Shortcut
// (no Scriptable required) with ZERO prompts:
//   Select Photos → OCR → Match Text chains (amount/date/merchant) → keyword
//   category chain (silent Shopping fallback) → platform→account chain →
//   moneywiz:// URL → MoneyWiz opens prefilled for review + save.
//
// Parameter keys are verified against real device-exported shortcuts (an
// unknown key gets "repaired" to Ask Each Time on import, which pops input
// dialogs at runtime):
//   text.match          → text (token string)     ← NOT WFInput
//   text.match.getgroup → matches (attachment)    ← NOT WFInput
//   setvariable         → WFVariableName + WFInput (attachment)
//   urlencode/replace   → WFInput (token string)
//   openurl             → WFInput (attachment)
//   conditional         → WFInput {Type:Variable, Variable: attachment}
//
// With --ai, a category that no keyword rule matched is classified by the
// Apple Intelligence "Use Model" action (is.workflow.actions.askllm, iOS 26+,
// action spec taken from Apple's bundled gallery shortcuts) before falling
// back per platform — dist/MoneyWiz-Pure-AI.shortcut.
//
// All regex patterns come from src/pure/patterns.ts (tested in test/pure.test.ts).
import {
  action,
  actionOutput,
  attachment,
  endIf,
  emitSignedShortcut,
  ifHasAnyValue,
  imageInputActions,
  otherwise,
  tokenText,
  uuidSequence,
  variableNamed,
  workflow
} from './shortcut-lib.mjs'
import {
  AI_CATEGORY_CHOICES,
  AI_CATEGORY_PROMPT_PREFIX,
  AMOUNT_PATTERNS,
  CATEGORY_RULES,
  CURRENCY,
  DATE_PADDING_RULES,
  DATE_SEPARATOR_PATTERN,
  DATE_PATTERN,
  FALLBACK_ACCOUNT,
  FALLBACK_CATEGORY_PATH,
  MERCHANT_NOISE_PATTERN,
  MERCHANT_PATTERNS,
  PLATFORM_RULES,
  SAVE_MODE
} from '../src/pure/patterns.ts'
import { encodeCategoryParam } from '../src/moneywiz/index.ts'

const isAiBuild = process.argv.includes('--ai')

const nextUuid = uuidSequence()
const actions = []
const push = (value) => { actions.push(value) }

function pushOutput(identifier, parameters, outputName) {
  const uuid = nextUuid()
  actions.push(action(identifier, { UUID: uuid, ...parameters }))
  return actionOutput(uuid, outputName)
}

// Match Text has no multiline toggle, so the flag goes inline;
// case-insensitivity matches the 'im' flags used in the Node tests.
const pushMatch = (pattern, subjectReference) =>
  pushOutput('is.workflow.actions.text.match', {
    WFMatchTextPattern: `(?m)${pattern}`,
    WFMatchTextCaseSensitive: false,
    text: tokenText([subjectReference])
  }, 'Matches')

const pushCaptureGroup = (matchesReference) =>
  pushOutput('is.workflow.actions.text.match.getgroup', {
    matches: attachment(matchesReference),
    WFGetGroupType: 'Group At Index',
    WFGroupIndex: 1
  }, 'Match Group')

const pushFirstItem = (listReference) =>
  pushOutput('is.workflow.actions.getitemfromlist', {
    WFInput: attachment(listReference),
    WFItemSpecifier: 'First Item'
  }, 'Item from List')

const pushText = (parts) =>
  pushOutput('is.workflow.actions.gettext', { WFTextActionText: tokenText(parts) }, 'Text')

const pushUrlEncode = (reference) =>
  pushOutput('is.workflow.actions.urlencode', {
    WFEncodeMode: 'Encode',
    WFInput: tokenText([reference])
  }, 'URL Encoded Text')

const pushSetVariable = (variableName, reference) =>
  push(action('is.workflow.actions.setvariable', {
    WFVariableName: variableName,
    WFInput: attachment(reference)
  }))

const pushSetVariableToText = (variableName, textParts) =>
  pushSetVariable(variableName, pushText(textParts))

// Emits a nested If/Otherwise cascade that tries each item's pattern against
// the subject (the OCR text by default) in order: the first match wins and
// gets onMatch(item, matches); onExhausted emits the no-match branch.
function pushFirstMatchChain(items, getPattern, onMatch, onExhausted, subject = ocrText) {
  const [item, ...rest] = items
  if (item === undefined) {
    onExhausted()
    return
  }
  const matches = pushMatch(getPattern(item), subject)
  const group = nextUuid()
  push(ifHasAnyValue(group, matches))
  onMatch(item, matches)
  push(otherwise(group))
  pushFirstMatchChain(rest, getPattern, onMatch, onExhausted, subject)
  push(endIf(group))
}

// --- 1. Screenshot from the share sheet, or the photo picker, then OCR ----------

const imageInput = imageInputActions(nextUuid)
imageInput.actions.forEach(push)

const ocrText = pushOutput('is.workflow.actions.extracttextfromimage', {
  WFImage: attachment(imageInput.imageReference)
}, 'Text from Image')

// --- 2. Amount: 实付 → 合计 → split 实付 → 价格/付款/金额 → bare line ----------
// No prompt on failure: the amount stays empty and is typed in MoneyWiz.

pushFirstMatchChain(AMOUNT_PATTERNS, pattern => pattern, (_pattern, matches) => {
  const captured = pushFirstItem(pushCaptureGroup(matches))
  const withoutThousandsSeparators = pushOutput('is.workflow.actions.text.replace', {
    WFReplaceTextFind: ',',
    WFReplaceTextReplace: '',
    WFReplaceTextCaseSensitive: false,
    WFReplaceTextRegularExpression: false,
    WFInput: tokenText([captured])
  }, 'Updated Text')
  pushSetVariable('Amount', withoutThousandsSeparators)
}, () => pushSetVariableToText('Amount', ['']))

// --- 3. Date (optional URL segment) --------------------------------------------

{
  const matches = pushMatch(DATE_PATTERN, ocrText)
  const group = nextUuid()
  push(ifHasAnyValue(group, matches))
  let normalized = pushOutput('is.workflow.actions.text.replace', {
    WFReplaceTextFind: DATE_SEPARATOR_PATTERN,
    WFReplaceTextReplace: '-',
    WFReplaceTextCaseSensitive: false,
    WFReplaceTextRegularExpression: true,
    WFInput: tokenText([pushFirstItem(matches)])
  }, 'Updated Text')
  for (const rule of DATE_PADDING_RULES) {
    normalized = pushOutput('is.workflow.actions.text.replace', {
      WFReplaceTextFind: rule.pattern,
      WFReplaceTextReplace: rule.replacement,
      WFReplaceTextCaseSensitive: false,
      WFReplaceTextRegularExpression: true,
      WFInput: tokenText([normalized])
    }, 'Updated Text')
  }
  const encoded = pushUrlEncode(normalized)
  pushSetVariableToText('DateSeg', ['&date=', encoded])
  push(otherwise(group))
  pushSetVariableToText('DateSeg', [''])
  push(endIf(group))
}

// --- 4. Merchant → description (optional URL segment) ---------------------------

pushFirstMatchChain(MERCHANT_PATTERNS, pattern => pattern, (_pattern, matches) => {
  const captured = pushFirstItem(pushCaptureGroup(matches))
  const cleaned = pushOutput('is.workflow.actions.text.replace', {
    WFReplaceTextFind: MERCHANT_NOISE_PATTERN,
    WFReplaceTextReplace: '',
    WFReplaceTextCaseSensitive: false,
    WFReplaceTextRegularExpression: true,
    WFInput: tokenText([captured])
  }, 'Updated Text')
  const trimmed = pushOutput('is.workflow.actions.text.trimwhitespace', {
    WFInput: tokenText([cleaned])
  }, 'Text')
  const encoded = pushUrlEncode(trimmed)
  pushSetVariableToText('DescSeg', ['&description=', encoded])
}, () => pushSetVariableToText('DescSeg', ['']))

// --- 5. Platform detection chain: sets the account, payee AND category fallback --

// The URL scheme requires account names without spaces.
const encodeAccountForUrl = (name) => encodeURIComponent(name.replace(/\s+/g, ''))

pushFirstMatchChain(PLATFORM_RULES, rule => rule.pattern, (rule) => {
  pushSetVariableToText('Account', [encodeAccountForUrl(rule.account)])
  pushSetVariableToText('PayeeSeg', [`&payee=${encodeURIComponent(rule.payee)}`])
  pushSetVariableToText('FallbackCategory', [encodeCategoryParam(rule.fallbackCategoryPath)])
}, () => {
  pushSetVariableToText('Account', [encodeAccountForUrl(FALLBACK_ACCOUNT)])
  pushSetVariableToText('PayeeSeg', [''])
  pushSetVariableToText('FallbackCategory', [encodeCategoryParam(FALLBACK_CATEGORY_PATH)])
})

// --- 6. Category: keyword chain, silent per-platform fallback -------------------
// Category names go into the URL verbatim, so encode each hierarchy segment
// at generation time ("Dining Out" → Dining%20Out, "Gas & Fuel" → Gas%20%26%20Fuel).

// --ai: ask the on-device model, validate its one-word reply against the
// known choices, and only then give up to the per-platform fallback.
function pushAiCategoryFallback() {
  const reply = pushOutput('is.workflow.actions.askllm', {
    WFLLMModel: 'Apple Intelligence',
    WFGenerativeResultType: 'Text',
    WFLLMPrompt: tokenText([AI_CATEGORY_PROMPT_PREFIX, ocrText])
  }, 'Response')
  pushFirstMatchChain(AI_CATEGORY_CHOICES, choice => choice.pattern, (choice) => {
    pushSetVariableToText('Category', [encodeCategoryParam(choice.categoryPath)])
  }, () => pushSetVariableToText('Category', [variableNamed('FallbackCategory')]), reply)
}

pushFirstMatchChain(CATEGORY_RULES, rule => rule.pattern, (rule) => {
  pushSetVariableToText('Category', [encodeCategoryParam(rule.categoryPath)])
}, () => {
  if (isAiBuild) {
    pushAiCategoryFallback()
  } else {
    pushSetVariableToText('Category', [variableNamed('FallbackCategory')])
  }
})

// --- 7. Hand off to MoneyWiz (prefilled, user reviews and saves there) -----------

const url = pushText([
  'moneywiz://expense?amount=', variableNamed('Amount'),
  '&account=', variableNamed('Account'),
  `&currency=${CURRENCY}`,
  '&category=', variableNamed('Category'),
  variableNamed('PayeeSeg'),
  variableNamed('DescSeg'),
  variableNamed('DateSeg'),
  `&save=${SAVE_MODE}`
])

// --debug: show + copy the assembled URL instead of opening MoneyWiz, so a
// misbehaving field can be pinpointed on-device.
const isDebugBuild = process.argv.includes('--debug')
if (isDebugBuild) {
  push(action('is.workflow.actions.setclipboard', { WFInput: tokenText([url]) }))
  push(action('is.workflow.actions.showresult', {
    Text: tokenText(['URL（已复制到剪贴板）：\n\n', url])
  }))
} else {
  push(action('is.workflow.actions.openurl', { WFInput: attachment(url) }))
}

const variantSuffix = `${isAiBuild ? '-AI' : ''}${isDebugBuild ? '-Debug' : ''}`
emitSignedShortcut(
  // Icon color changes with each structural fix (and per variant) so a stale
  // or wrong import is recognizable at a glance.
  workflow(actions, {
    glyphNumber: 59511,
    startColor: isAiBuild ? 946986751 : 4271458815,
    shareSheet: true
  }),
  `MoneyWiz-Pure${variantSuffix}`
)
