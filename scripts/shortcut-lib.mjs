// Shared builders for .shortcut files: a shortcut is a plist whose
// WFWorkflowActions array holds actions referencing each other through
// UUID attachments. Signing (required for import since iOS 15) is done
// locally by macOS's `shortcuts sign`.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

// --- value references -------------------------------------------------------

export const actionOutput = (outputUUID, outputName) =>
  ({ Type: 'ActionOutput', OutputUUID: outputUUID, OutputName: outputName })

export const variableNamed = variableName => ({ Type: 'Variable', VariableName: variableName })

export const shortcutInput = () => ({ Type: 'ExtensionInput' })

export const attachment = reference =>
  ({ WFSerializationType: 'WFTextTokenAttachment', Value: reference })

// Interpolated text: parts are literal strings or value references
// (each reference occupies one U+FFFC slot in the string).
export function tokenText(parts) {
  let string = ''
  const attachmentsByRange = {}
  for (const part of parts) {
    if (typeof part === 'string') {
      string += part
      continue
    }
    attachmentsByRange[`{${string.length}, 1}`] = part
    string += '￼'
  }
  if (Object.keys(attachmentsByRange).length === 0) return string
  return { WFSerializationType: 'WFTextTokenString', Value: { string, attachmentsByRange } }
}

// --- actions -----------------------------------------------------------------

export const action = (identifier, parameters = {}) =>
  ({ WFWorkflowActionIdentifier: identifier, WFWorkflowActionParameters: parameters })

const CONDITION_HAS_ANY_VALUE = 100

export const ifHasAnyValue = (groupingIdentifier, inputReference) =>
  action('is.workflow.actions.conditional', {
    GroupingIdentifier: groupingIdentifier,
    WFControlFlowMode: 0,
    WFCondition: CONDITION_HAS_ANY_VALUE,
    WFInput: { Type: 'Variable', Variable: attachment(inputReference) }
  })

export const otherwise = groupingIdentifier =>
  action('is.workflow.actions.conditional', { GroupingIdentifier: groupingIdentifier, WFControlFlowMode: 1 })

export const endIf = groupingIdentifier =>
  action('is.workflow.actions.conditional', { GroupingIdentifier: groupingIdentifier, WFControlFlowMode: 2 })

export const menuStart = (groupingIdentifier, prompt, itemTitles) =>
  action('is.workflow.actions.choosefrommenu', {
    GroupingIdentifier: groupingIdentifier,
    WFControlFlowMode: 0,
    WFMenuPrompt: prompt,
    WFMenuItems: itemTitles
  })

export const menuCase = (groupingIdentifier, itemTitle) =>
  action('is.workflow.actions.choosefrommenu', {
    GroupingIdentifier: groupingIdentifier,
    WFControlFlowMode: 1,
    WFMenuItemTitle: itemTitle
  })

export const menuEnd = groupingIdentifier =>
  action('is.workflow.actions.choosefrommenu', { GroupingIdentifier: groupingIdentifier, WFControlFlowMode: 2 })

// Share-sheet input when present, otherwise an explicit Select Photos action
// (the WFWorkflowNoInputBehavior "Ask For Input" fallback asks for TEXT on
// some iOS versions, so the photo picker is wired in as real actions).
// Returns the actions to prepend and the reference to the resolved image.
export function imageInputActions(nextUuid) {
  const group = nextUuid()
  const selectedPhotoUuid = nextUuid()
  const variableName = 'Screenshot'
  return {
    actions: [
      ifHasAnyValue(group, shortcutInput()),
      action('is.workflow.actions.setvariable', {
        WFVariableName: variableName,
        WFInput: attachment(shortcutInput())
      }),
      otherwise(group),
      action('is.workflow.actions.selectphoto', { UUID: selectedPhotoUuid }),
      action('is.workflow.actions.setvariable', {
        WFVariableName: variableName,
        WFInput: attachment(actionOutput(selectedPhotoUuid, 'Photos'))
      }),
      endIf(group)
    ],
    imageReference: variableNamed(variableName)
  }
}

// Deterministic UUIDs keep generated files reproducible.
export function uuidSequence() {
  let counter = 0
  return () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`
}

// --- workflow + output -------------------------------------------------------

export function workflow(actions, { glyphNumber = 59511, startColor = 4271458815, shareSheet = true } = {}) {
  return {
    WFWorkflowClientVersion: '2607.0.3',
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: '900',
    WFWorkflowIcon: { WFWorkflowIconStartColor: startColor, WFWorkflowIconGlyphNumber: glyphNumber },
    WFWorkflowImportQuestions: [],
    WFQuickActionSurfaces: [],
    WFWorkflowTypes: shareSheet ? ['ActionExtension'] : [],
    WFWorkflowInputContentItemClasses: shareSheet ? ['WFImageContentItem'] : [],
    WFWorkflowHasOutputFallback: false,
    WFWorkflowOutputContentItemClasses: [],
    WFWorkflowActions: actions
  }
}

export function emitSignedShortcut(workflowDict, name) {
  mkdirSync(resolve('dist'), { recursive: true })
  const jsonPath = resolve(`dist/${name}.workflow.json`)
  const unsignedPath = resolve(`dist/${name}.unsigned.shortcut`)
  const signedPath = resolve(`dist/${name}.shortcut`)

  writeFileSync(jsonPath, JSON.stringify(workflowDict))
  execFileSync('plutil', ['-convert', 'binary1', jsonPath, '-o', unsignedPath])
  rmSync(jsonPath)
  console.log(`Generated ${unsignedPath} (${workflowDict.WFWorkflowActions.length} actions)`)

  rmSync(signedPath, { force: true })
  // "anyone" signing talks to an Apple service and fails intermittently
  // ("Failed to modify some records"); contact-based signing happens locally
  // and still imports fine on devices using the same Apple ID.
  for (const mode of ['anyone', 'people-who-know-me']) {
    try {
      execFileSync('shortcuts', ['sign', '--mode', mode, '--input', unsignedPath, '--output', signedPath])
      console.log(`Signed    ${signedPath} (mode: ${mode}, ${statSync(signedPath).size} bytes)`)
      console.log(`Import: AirDrop dist/${name}.shortcut to your iPhone, or open it on this Mac to sync via iCloud.`)
      return
    } catch (error) {
      console.warn(`shortcuts sign --mode ${mode} failed: ${String(error.message || error).trim()}`)
    }
  }
  console.error('Signing failed — is this macOS 12+ with the Shortcuts CLI available and signed into iCloud?')
  process.exitCode = 1
}
