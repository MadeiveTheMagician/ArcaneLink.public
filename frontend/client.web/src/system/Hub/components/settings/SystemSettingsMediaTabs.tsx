import {
  getStreamingTierLabel,
  isStreamingTierAllowed,
  streamingFrameRateOptions,
  streamingResolutionOptions,
} from '../../../../shared/streaming/streamingSettings'
import type {
  StreamingFrameRate,
  StreamingOption,
  StreamingResolution,
  StreamingSettings,
} from '../../../../shared/streaming/streamingSettings'
import type { UserResponse } from '../../../../shared/types'
import { settingsCopy } from '../../../shared/copy'
import { SettingsSection } from './SystemSettingsControls'
import styles from './SystemSettingsControls.module.css'

export { VoiceSettingsTab } from './VoiceSettingsTab'

type StreamingSettingsTabProps = {
  settings: StreamingSettings
  user: UserResponse
  onChange: (patch: Partial<StreamingSettings>) => void
  onReset: () => void
}

export function StreamingSettingsTab({
  settings,
  user,
  onChange,
  onReset,
}: StreamingSettingsTabProps) {
  return (
    <>
      <SettingsSection
        title={settingsCopy.streaming.qualityTitle}
        description={settingsCopy.streaming.qualityDescription}
      >
        <StreamingRadioGroup
          name="streaming-frame-rate"
          title={settingsCopy.streaming.frameRate}
          value={settings.frameRate}
          options={streamingFrameRateOptions}
          user={user}
          onChange={(frameRate) => onChange({ frameRate })}
        />

        <StreamingRadioGroup
          name="streaming-resolution"
          title={settingsCopy.streaming.resolution}
          value={settings.resolution}
          options={streamingResolutionOptions}
          user={user}
          onChange={(resolution) => onChange({ resolution })}
        />

        <p className={styles.statusText}>
          {settingsCopy.streaming.qualityNotice}
        </p>
      </SettingsSection>

      <button
        className={styles.secondaryAction}
        type="button"
        onClick={onReset}
      >
        {settingsCopy.actions.resetStreaming}
      </button>
    </>
  )
}

function StreamingRadioGroup<
  TValue extends StreamingFrameRate | StreamingResolution,
>({
  name,
  title,
  value,
  options,
  user,
  onChange,
}: {
  name: string
  title: string
  value: TValue
  options: readonly StreamingOption<TValue>[]
  user: UserResponse
  onChange: (value: TValue) => void
}) {
  return (
    <fieldset className="ui-radio-group">
      <legend>{title}</legend>
      <div className="ui-radio-grid">
        {options.map((option) => {
          const isAllowed = isStreamingTierAllowed(option.requiredTier, user)

          return (
            <label className="ui-radio-card" key={option.value}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={!isAllowed}
                onChange={() => onChange(option.value)}
              />
              <strong>{option.label}</strong>
              <small>{option.description}</small>
              {!isAllowed && (
                <em>{getStreamingTierLabel(option.requiredTier)}</em>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
