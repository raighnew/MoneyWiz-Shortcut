// Generates dist/MoneyWiz-Debug.shortcut — shows the raw OCR text that the
// iPhone extracts from a payment screenshot and copies it to the clipboard,
// so failing screenshots can be turned into fixtures for the pattern tests.
import {
  action,
  attachment,
  emitSignedShortcut,
  imageInputActions,
  tokenText,
  uuidSequence,
  workflow
} from './shortcut-lib.mjs'
import { actionOutput } from './shortcut-lib.mjs'

const nextUuid = uuidSequence()
const actions = []

const imageInput = imageInputActions(nextUuid)
actions.push(...imageInput.actions)

const ocrUuid = nextUuid()
actions.push(action('is.workflow.actions.extracttextfromimage', {
  UUID: ocrUuid,
  WFImage: attachment(imageInput.imageReference)
}))
const ocrText = actionOutput(ocrUuid, 'Text from Image')

actions.push(action('is.workflow.actions.setclipboard', {
  WFInput: tokenText([ocrText])
}))
actions.push(action('is.workflow.actions.showresult', {
  Text: tokenText(['OCR 文本（已复制到剪贴板）：\n\n', ocrText])
}))

emitSignedShortcut(workflow(actions, { glyphNumber: 59511, startColor: 4282601983 }), 'MoneyWiz-Debug')
