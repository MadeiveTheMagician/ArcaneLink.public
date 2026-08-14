import {
  communicationIconNames,
  identityIconNames,
  navigationIconNames,
  type CommunicationIconName,
  type IdentityIconName,
  type NavigationIconName,
  type SystemIconName,
} from './SystemIcon.types'
import { renderCommunicationGlyph } from './SystemCommunicationGlyph'
import { renderIdentityGlyph } from './SystemIdentityGlyph'
import { renderNavigationGlyph } from './SystemNavigationGlyph'
import { assertUnreachable } from './systemIconGlyphUtils'

function includesIconName<T extends SystemIconName>(
  names: readonly T[],
  name: SystemIconName,
): name is T {
  return (names as readonly SystemIconName[]).includes(name)
}

export function SystemIconGlyph({ name }: { name: SystemIconName }) {
  if (includesIconName(navigationIconNames, name)) {
    return renderNavigationGlyph(name as NavigationIconName)
  }

  if (includesIconName(communicationIconNames, name)) {
    return renderCommunicationGlyph(name as CommunicationIconName)
  }

  if (includesIconName(identityIconNames, name)) {
    return renderIdentityGlyph(name as IdentityIconName)
  }

  return assertUnreachable(name)
}
