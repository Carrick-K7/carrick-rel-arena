import { useEffect, useState } from 'react';
import type {
  Capabilities,
  InputMode,
  OutputMode,
} from '../../shared/contracts.js';
import type { ModalityPreferences } from '../modalities.js';

interface ModalitySettingsProps {
  open: boolean;
  capabilities: Capabilities | null;
  preferences: ModalityPreferences;
  speechInputSupported: boolean;
  mediaUnlocked: boolean;
  onInputChange: (mode: InputMode) => void;
  onOutputChange: (mode: OutputMode) => void;
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
  onInputChange,
  onOutputChange,
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
      !mediaUnlocked
    ) {
      setRequestedMedia(mode);
      return;
    }
    setRequestedMedia(null);
    onOutputChange(mode);
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

        <fieldset className="modality-group">
          <legend>输入方式</legend>
          <p>选择你主要用什么方式回应；语音识别后仍可编辑文字。</p>
          <div className="modality-options">
            <ModalityOption
              name="input-mode"
              value="text"
              title="文字"
              detail="键盘自由输入"
              selected={preferences.input === 'text'}
              onSelect={() => onInputChange('text')}
              testId="input-mode-text"
            />
            <ModalityOption
              name="input-mode"
              value="voice"
              title="语音"
              detail={
                speechInputSupported
                  ? '浏览器实时转写'
                  : '当前浏览器不支持'
              }
              selected={preferences.input === 'voice'}
              disabled={!speechInputSupported}
              onSelect={() => onInputChange('voice')}
              testId="input-mode-voice"
            />
          </div>
        </fieldset>

        <fieldset className="modality-group">
          <legend>输出方式</legend>
          <p>
            每次选择一种主要演出方式。所有模式都保留文字字幕，方便复盘。
          </p>
          <div className="modality-options modality-options--output">
            <ModalityOption
              name="output-mode"
              value="text"
              title="文字"
              detail="最快、零额外媒体成本"
              selected={preferences.output === 'text'}
              onSelect={() => chooseOutput('text')}
              testId="output-mode-text"
            />
            <ModalityOption
              name="output-mode"
              value="voice"
              title="语音"
              detail="自动朗读角色回应"
              selected={preferences.output === 'voice'}
              onSelect={() => chooseOutput('voice')}
              testId="output-mode-voice"
            />
            <ModalityOption
              name="output-mode"
              value="image"
              title="图像"
              detail={
                imageAvailable
                  ? '在关键剧情节点生成'
                  : '服务端尚未配置'
              }
              selected={preferences.output === 'image'}
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
                  ? '开场、转折、结局生成'
                  : '服务端尚未配置'
              }
              selected={preferences.output === 'video'}
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

        <footer className="settings-footer">
          <span>
            当前：
            {inputLabel(preferences.input)}输入 ·{' '}
            {outputLabel(preferences.output)}输出
          </span>
          <small>
            图像和视频只使用关卡预设提示词，不上传对话正文。
          </small>
        </footer>
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
        locked && !disabled ? 'is-locked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onSelect}
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

function inputLabel(mode: InputMode): string {
  return mode === 'voice' ? '语音' : '文字';
}

function outputLabel(mode: OutputMode): string {
  return {
    text: '文字',
    voice: '语音',
    image: '图像',
    video: '视频',
  }[mode];
}
