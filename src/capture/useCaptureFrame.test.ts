import { describe, expect, it, vi } from 'vitest';
import { captureFrame } from './useCaptureFrame';

const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;

function createVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    readyState: HAVE_CURRENT_DATA,
    videoWidth: 1920,
    videoHeight: 1080,
    ...overrides,
  } as HTMLVideoElement;
}

function createCanvas(
  context: Pick<CanvasRenderingContext2D, 'drawImage'> | null = { drawImage: vi.fn() },
): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement;
}

describe('captureFrame', () => {
  it('video または canvas がない場合は false を返す', () => {
    const video = createVideo();
    const canvas = createCanvas();

    expect(captureFrame(null, canvas)).toBe(false);
    expect(captureFrame(video, null)).toBe(false);
  });

  it('video の readyState が不足している場合は false を返す', () => {
    const video = createVideo({ readyState: HAVE_METADATA });
    const canvas = createCanvas();

    expect(captureFrame(video, canvas)).toBe(false);
  });

  it('video サイズがない場合は false を返す', () => {
    const canvas = createCanvas();

    expect(captureFrame(createVideo({ videoWidth: 0 }), canvas)).toBe(false);
    expect(captureFrame(createVideo({ videoHeight: 0 }), canvas)).toBe(false);
  });

  it('2D context が取得できない場合は false を返す', () => {
    const video = createVideo();
    const canvas = createCanvas(null);

    expect(captureFrame(video, canvas)).toBe(false);
  });

  it('canvas サイズを video サイズに同期して描画する', () => {
    const video = createVideo({ videoWidth: 1280, videoHeight: 720 });
    const context = { drawImage: vi.fn() };
    const canvas = createCanvas(context);

    expect(captureFrame(video, canvas)).toBe(true);
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 0);
  });
});
