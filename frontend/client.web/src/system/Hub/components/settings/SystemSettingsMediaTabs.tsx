import { useCallback, useEffect, useRef, useState } from 'react'
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
import { SystemSelect } from '../../../shared/ui/SystemSelect'
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
      <CameraDeviceSettings
        cameraDeviceId={settings.cameraDeviceId}
        onChange={(cameraDeviceId) => onChange({ cameraDeviceId })}
      />
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

function CameraDeviceSettings({
  cameraDeviceId,
  onChange,
}: {
  cameraDeviceId: string
  onChange: (deviceId: string) => void
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'ready' | 'permission' | 'error'
  >('idle')
  const refreshSequenceRef = useRef(0)

  const refreshDevices = useCallback(async (requestPermission = false) => {
    const sequence = ++refreshSequenceRef.current
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.enumerateDevices) {
      setStatus('error')
      return
    }

    setStatus('loading')
    try {
      let cameras = (await mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'videoinput',
      )
      if (
        requestPermission && mediaDevices.getUserMedia &&
        !cameras.some((camera) => camera.deviceId)
      ) {
        const permissionStream = await mediaDevices.getUserMedia({ video: true })
        try {
          cameras = (await mediaDevices.enumerateDevices()).filter(
            (device) => device.kind === 'videoinput',
          )
        } finally {
          permissionStream.getTracks().forEach((track) => track.stop())
        }
      }

      if (sequence === refreshSequenceRef.current) {
        setDevices(cameras.filter((camera) => camera.deviceId && camera.deviceId !== 'default'))
        setStatus(cameras.some((camera) => !camera.deviceId) ? 'permission' : 'ready')
      }
    } catch {
      if (sequence === refreshSequenceRef.current) {
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    const onDevicesChanged = () => void refreshDevices()
    onDevicesChanged()
    navigator.mediaDevices?.addEventListener?.('devicechange', onDevicesChanged)
    return () => {
      refreshSequenceRef.current += 1
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDevicesChanged)
    }
  }, [refreshDevices])

  const selectedCameraMissing =
    cameraDeviceId !== 'default' &&
    !devices.some((device) => device.deviceId === cameraDeviceId)

  return (
    <SettingsSection title={settingsCopy.streaming.camera}>
      <SystemSelect
        aria-label={settingsCopy.streaming.camera}
        value={cameraDeviceId}
        onValueChange={onChange}
      >
        <option value="default">{settingsCopy.streaming.cameraDefault}</option>
        {selectedCameraMissing && (
          <option value={cameraDeviceId} disabled>
            {settingsCopy.streaming.cameraDeviceUnavailable}
          </option>
        )}
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `${settingsCopy.streaming.cameraDeviceFallback} ${index + 1}`}
          </option>
        ))}
      </SystemSelect>
      <button
        className={styles.secondaryAction}
        type="button"
        disabled={status === 'loading'}
        onClick={() => void refreshDevices(true)}
      >
        {settingsCopy.streaming.cameraDevicesRefresh}
      </button>
      {status === 'error' && (
        <p className={styles.statusText} role="status">
          {settingsCopy.streaming.cameraDevicesUnavailable}
        </p>
      )}
      {status === 'permission' && (
        <p className={styles.statusText} role="status">
          {settingsCopy.streaming.cameraPermissionNeeded}
        </p>
      )}
      {status === 'ready' && devices.length === 0 && (
        <p className={styles.statusText} role="status">
          {settingsCopy.streaming.cameraDevicesMissing}
        </p>
      )}
    </SettingsSection>
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
