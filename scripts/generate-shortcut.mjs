// Generates dist/MoneyWiz.shortcut — the Scriptable-based Shortcut:
//   Extract Text from Image → Scriptable "MoneyWiz" → confirm alert → Open URL
// with an error alert branch when parsing fails. Requires the Scriptable app
// and the MoneyWiz script (dist/MoneyWiz.js) on the phone.
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
  workflow
} from './shortcut-lib.mjs'

const SCRIPTABLE_SCRIPT_NAME = 'MoneyWiz'

const nextUuid = uuidSequence()
const actions = []

function pushOutput(identifier, parameters, outputName) {
  const uuid = nextUuid()
  actions.push(action(identifier, { UUID: uuid, ...parameters }))
  return actionOutput(uuid, outputName)
}

const imageInput = imageInputActions(nextUuid)
actions.push(...imageInput.actions)

const ocrText = pushOutput('is.workflow.actions.extracttextfromimage', {
  WFImage: attachment(imageInput.imageReference)
}, 'Text from Image')

// Scriptable's "Run Script" intent; the OCR text arrives as args.shortcutParameter.
const scriptResult = pushOutput('dk.simonbs.Scriptable.ParameterizedRunScriptIntent', {
  ShowWhenRun: false,
  fileName: SCRIPTABLE_SCRIPT_NAME,
  parameter: attachment(ocrText),
  runInApp: false
}, 'Run Script')

const dictionaryValue = (key) =>
  pushOutput('is.workflow.actions.getvalueforkey', {
    WFInput: attachment(scriptResult),
    WFGetDictionaryValueType: 'Value',
    WFDictionaryKey: key
  }, 'Dictionary Value')

const url = dictionaryValue('url')
const ifGroup = nextUuid()
actions.push(ifHasAnyValue(ifGroup, url))
const summary = dictionaryValue('summary')
actions.push(action('is.workflow.actions.alert', {
  WFAlertActionTitle: 'Save to MoneyWiz?',
  WFAlertActionMessage: tokenText([summary]),
  WFAlertActionCancelButtonShown: true
}))
actions.push(action('is.workflow.actions.openurl', { WFInput: tokenText([url]) }))
actions.push(otherwise(ifGroup))
const error = dictionaryValue('error')
actions.push(action('is.workflow.actions.alert', {
  WFAlertActionTitle: 'Could not parse screenshot',
  WFAlertActionMessage: tokenText([error]),
  WFAlertActionCancelButtonShown: false
}))
actions.push(endIf(ifGroup))

emitSignedShortcut(workflow(actions), 'MoneyWiz')
