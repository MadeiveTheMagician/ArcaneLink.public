import { expect, test } from '@playwright/test'
import { commonCopy, settingsCopy } from '../src/system/shared/copy'
import { systemSettingsNavigationEventName } from '../src/system/shared/navigation/systemSettingsNavigation'
import { mockArcaneLinkApi } from './fixtures/arcaneLinkApi'

test.beforeEach(async ({ page }) => {
  await mockArcaneLinkApi(page)
  await page.goto('/')
  await page.locator('input[autocomplete="username"]').fill('lara')
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.locator('form').first().locator('button[type="submit"]').click()
  await expect(page.getByRole('button', { name: /Palas/ })).toBeVisible()
})

test('settings keep one category list open and collapse content sections', async ({
  page,
}) => {
  await page.evaluate((eventName) => {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          requestId: 'settings-accordion-e2e',
          tab: 'voice',
          targetId: null,
        },
      }),
    )
  }, systemSettingsNavigationEventName)

  const dialog = page.getByRole('dialog', {
    name: settingsCopy.root.title,
  })
  const navigation = dialog.getByRole('navigation', {
    name: settingsCopy.root.tabs,
  })
  const accountCategory = navigation.getByRole('button', {
    name: settingsCopy.tabs.account,
    exact: true,
  })
  const interfaceCategory = navigation.getByRole('button', {
    name: settingsCopy.tabs.interface,
    exact: true,
  })
  const voiceCategory = navigation.getByRole('button', {
    name: settingsCopy.tabs.voice,
    exact: true,
  })

  await expect(dialog).toBeVisible()
  await expect(voiceCategory).toHaveAttribute('aria-expanded', 'true')
  const accountDisclosure = navigation.locator(
    '[data-settings-category-sections="account"]',
  )
  const voiceDisclosure = navigation.locator(
    '[data-settings-category-sections="voice"]',
  )
  await expect(accountDisclosure).toHaveAttribute('aria-hidden', 'true')
  await expect(accountDisclosure).toHaveAttribute('inert', '')
  await expect(voiceDisclosure).toHaveAttribute('aria-hidden', 'false')
  await expect(voiceDisclosure).not.toHaveAttribute('inert', '')

  await accountCategory.click()
  await expect(accountCategory).toHaveAttribute('aria-expanded', 'true')
  await expect(voiceCategory).toHaveAttribute('aria-expanded', 'false')
  await expect(accountDisclosure).toHaveAttribute('aria-hidden', 'false')
  await expect(accountDisclosure).not.toHaveAttribute('inert', '')
  await expect(voiceDisclosure).toHaveAttribute('aria-hidden', 'true')
  await expect(voiceDisclosure).toHaveAttribute('inert', '')

  await accountDisclosure
    .getByRole('button', {
      name: settingsCopy.account.passwordSecurityTitle,
      exact: true,
    })
    .click()
  const sessionsToggle = dialog.locator('[data-account-sessions-toggle]')
  const sessionsContent = dialog.locator('[data-account-sessions-content]')
  await expect(sessionsToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(sessionsContent).toHaveAttribute('aria-hidden', 'true')
  await expect(sessionsContent).toHaveAttribute('inert', '')
  await sessionsToggle.click()
  await expect(sessionsToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(sessionsContent).toHaveAttribute('aria-hidden', 'false')
  await expect(sessionsContent).not.toHaveAttribute('inert', '')
  await expect(sessionsContent.getByText('Current browser')).toBeVisible()
  await expect(sessionsContent.getByText('Other browser')).toBeVisible()
  await expect(
    sessionsContent.getByText(settingsCopy.errors.loadSessions),
  ).toHaveCount(0)

  await interfaceCategory.click()
  await expect(interfaceCategory).toHaveAttribute('aria-expanded', 'true')
  await expect(accountCategory).toHaveAttribute('aria-expanded', 'false')

  await voiceCategory.click()
  const spatialNavigationLink = navigation.getByRole('button', {
    name: settingsCopy.voice.spatialAudioTitle,
    exact: true,
  })
  const spatialSection = dialog
    .getByRole('heading', {
      name: settingsCopy.voice.spatialAudioTitle,
      exact: true,
    })
    .locator('xpath=ancestor::section[1]')
  const spatialToggle = spatialSection.locator(
    '[data-settings-section-toggle]',
  )

  await expect(spatialNavigationLink).toBeDisabled()
  await expect(spatialToggle).toBeDisabled()
  await expect(spatialToggle).toHaveAttribute('aria-expanded', 'false')
  const spatialContent = spatialSection.locator(
    '[data-settings-section-content]',
  )
  await expect(spatialContent).toHaveAttribute('aria-hidden', 'true')
  await expect(spatialContent).toHaveAttribute('inert', '')

  const warningSection = dialog
    .getByRole('heading', {
      name: settingsCopy.voice.warningTitle,
      exact: true,
    })
    .locator('xpath=ancestor::section[1]')
  const warningToggle = warningSection.locator(
    '[data-settings-section-toggle]',
  )
  const collapseWarningLabel = [
    commonCopy.actions.collapse,
    settingsCopy.voice.warningTitle,
  ].join(': ')
  const expandWarningLabel = [
    commonCopy.actions.expand,
    settingsCopy.voice.warningTitle,
  ].join(': ')

  await expect(warningToggle).toHaveAccessibleName(
    settingsCopy.voice.warningTitle,
  )
  await expect(warningToggle).toHaveAttribute('title', collapseWarningLabel)
  await expect(warningToggle).toHaveAttribute('aria-expanded', 'true')
  await warningToggle.click()
  await expect(warningToggle).toHaveAttribute('title', expandWarningLabel)
  await expect(warningToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(
    warningSection.getByText(settingsCopy.voice.warningDescription),
  ).toBeHidden()
  const warningContent = warningSection.locator(
    '[data-settings-section-content]',
  )
  const warningTransition = await warningContent.evaluate((element) => {
    const computedStyle = window.getComputedStyle(element)
    return {
      duration: computedStyle.transitionDuration,
      property: computedStyle.transitionProperty,
    }
  })
  expect(warningTransition.property).toContain('grid-template-rows')
  expect(warningTransition.duration).not.toBe('0s')
  await expect(warningContent).toHaveAttribute('aria-hidden', 'true')
  await expect(warningContent).toHaveAttribute('inert', '')

  await navigation
    .getByRole('button', {
      name: settingsCopy.voice.warningTitle,
      exact: true,
    })
    .click()
  await expect(warningToggle).toHaveAttribute('title', collapseWarningLabel)
  await expect(warningToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(warningContent).toHaveAttribute('aria-hidden', 'false')
  await expect(warningContent).not.toHaveAttribute('inert', '')
})
