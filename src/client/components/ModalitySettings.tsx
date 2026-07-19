import { useEffect, useState } from 'react';
import type {
  Capabilities,
  OutputMode,
} from '../../shared/contracts.js';
import {
  hasOutput,
  type ModalityPreferences,
} from '../modalities.js';

interface ModalitySettingsProps {
  open: boolean;
  capabilities: Capabilities | null;
  preferences: ModalityPreferences;
  speechInputSupported: boolean;
  mediaUnlocked: boolean;
  onOutputToggle: (mode: OutputMode) => void;
  onUnlockMedia: (
    accessKey: string,
    output: 'image' | 'video',
  ) => Promise<void>;
  onClose: () => void;
}

export function ModalitySettings({
  open,
  capabilities,
  preferences,
  speechInputSupported,
  mediaUnlocked,
  onOutputToggle,
  onUnlockMedia,
  onClose,
}: ModalitySettingsProps) {
  const [requestedMedia, setRequestedMedia] = useState<
    'image' | 'video' | null
  >(null);
  const [accessKey, setAccessKey] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAccessKey('');
      setRequestedMedia(null);
      setUnlockError(null);
      setUnlocking(false);
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  function chooseOutput(mode: OutputMode) {
    setUnlockError(null);
    if (
      (mode === 'image' || mode === 'video') &&
      !mediaUnlocked &&
      !hasOutput(preferences, mode)
    ) {
      setRequestedMedia(mode);
      return;
    }
    setRequestedMedia(null);
    onOutputToggle(mode);
  }

  async function unlock() {
    if (!requestedMedia || unlocking || !accessKey.trim()) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      await onUnlockMedia(accessKey.trim(), requestedMedia);
      setAccessKey('');
      setRequestedMedia(null);
    } catch (error) {
      setUnlockError(
        error instanceof Error ? error.message : '媒体密钥校验失败。',
      );
    } finally {
      setUnlocking(false);
    }
  }

  const imageAvailable =
    capabilities?.imageGeneration !== 'unavailable';
  const videoAvailable =
    capabilities?.videoGeneration !== 'unavailable';

  return (
    <div
      className="settings-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        data-testid="modality-settings"
      >
        <header className="settings-header">
          <div>
            <span>互动偏好</span>
            <h1 id="settings-title">模态设置</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭模态设置"
          >
            关闭
          </button>
        </header>

        <section className="modality-group modality-inputs">
          <h2>输入方式</h2>
          <p>无需切换。键盘输入和语音转写始终同时保留。</p>
          <div className="input-capabilities">
            <article data-testid="input-mode-text">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>文字输入</strong>
                <small>随时键入或修改内容</small>
              </div>
            </article>
            <article
              className={speechInputSupported ? '' : 'is-unavailable'}
              data-testid="input-mode-voice"
            >
              <span aria-hidden="true">
                {speechInputSupported ? '✓' : '—'}
              </span>
              <div>
                <strong>语音转写</strong>
                <small>
                  {speechInputSupported
                    ? '说完后仍可编辑文字'
                    : '当前浏览器暂不支持'}
                </small>
              </div>
            </article>
          </div>
        </section>

        <fieldset className="modality-group">
          <legend>输出方式</legend>
          <p>
            可同时启用多种演出。文字始终保留，语音与影像按需叠加。
          </p>
          <div className="modality-options modality-options--output">
            <ModalityOption
              name="output-mode"
              value="text"
              title="文字"
              detail="始终保留，方便阅读与复盘"
              selected
              fixed
              onSelect={() => chooseOutput('text')}
              testId="output-mode-text"
            />
            <ModalityOption
              name="output-mode"
              value="voice"
              title="语音"
              detail="自动朗读角色回应"
              selected={hasOutput(preferences, 'voice')}
              onSelect={() => chooseOutput('voice')}
              testId="output-mode-voice"
            />
            <ModalityOption
              name="output-mode"
              value="image"
              title="图像"
              detail={
                imageAvailable
                  ? '开场与每轮实时生成'
                  : '服务端尚未配置'
              }
              selected={hasOutput(preferences, 'image')}
              locked={!mediaUnlocked}
              disabled={!imageAvailable}
              onSelect={() => chooseOutput('image')}
              testId="output-mode-image"
            />
            <ModalityOption
              name="output-mode"
              value="video"
              title="视频"
              detail={
                videoAvailable
                  ? '逐轮图片＋结算回忆短片'
                  : '服务端尚未配置'
              }
              selected={hasOutput(preferences, 'video')}
              locked={!mediaUnlocked}
              disabled={!videoAvailable}
              onSelect={() => chooseOutput('video')}
              testId="output-mode-video"
            />
          </div>
        </fieldset>

        {requestedMedia && (
          <section className="media-unlock" aria-live="polite">
            <div>
              <strong>
                解锁{requestedMedia === 'image' ? '图像' : '视频'}生成
              </strong>
              <p>
                每次刷新后都要重新输入。密钥只在当前页面内存中使用，
                不写入浏览器缓存。
              </p>
            </div>
            <form
              className="media-unlock__form"
              onSubmit={(event) => {
                event.preventDefault();
                void unlock();
              }}
            >
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                placeholder="输入媒体密钥"
                autoComplete="off"
                autoFocus
                data-testid="media-access-key"
              />
              <button
                type="submit"
                disabled={unlocking || !accessKey.trim()}
                data-testid="unlock-media"
              >
                {unlocking ? '校验中…' : '校验并启用'}
              </button>
            </form>
            {unlockError && (
              <p className="media-unlock__error" role="alert">
                {unlockError}
              </p>
            )}
          </section>
        )}
      </section>
    </div>
  );
}

function ModalityOption({
  name,
  value,
  title,
  detail,
  selected,
  fixed = false,
  locked = false,
  disabled = false,
  onSelect,
  testId,
}: {
  name: string;
  value: string;
  title: string;
  detail: string;
  selected: boolean;
  fixed?: boolean;
  locked?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      className={[
        'modality-option',
        selected ? 'is-selected' : '',
        fixed ? 'is-fixed' : '',
        locked && !disabled ? 'is-locked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled || fixed}
      disabled={disabled}
      onClick={fixed ? undefined : onSelect}
      data-name={name}
      data-value={value}
      data-testid={testId}
    >
      <span className="modality-option__indicator" aria-hidden="true" />
      <strong>{title}</strong>
      <small>{detail}</small>
      {locked && !disabled && <i>需密钥</i>}
    </button>
  );
}
