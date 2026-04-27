import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Worker } from 'tesseract.js';
import { createOcrWorker, detectFromImageLike, detectWithOcrWorker } from './ocrDetect';

const createWorkerMock = vi.hoisted(() => vi.fn());

vi.mock('tesseract.js', () => ({
  createWorker: createWorkerMock,
}));

function createMockWorker(text = 'VICTORY'): Worker {
  return {
    setParameters: vi.fn().mockResolvedValue({}),
    recognize: vi.fn().mockResolvedValue({
      data: { text, confidence: 90 },
    }),
    terminate: vi.fn().mockResolvedValue({}),
  } as unknown as Worker;
}

describe('OCR worker lifecycle', () => {
  beforeEach(() => {
    createWorkerMock.mockReset();
  });

  it('既存 worker を使う検出では createWorker を呼ばない', async () => {
    const worker = createMockWorker();

    await detectWithOcrWorker(worker, 'image.png', 1600, 900);
    await detectWithOcrWorker(worker, 'image.png', 1600, 900);

    expect(createWorkerMock).not.toHaveBeenCalled();
    expect(worker.recognize).toHaveBeenCalledTimes(2);
    expect(worker.terminate).not.toHaveBeenCalled();
  });

  it('createOcrWorker は tesseract worker を一度だけ作る', async () => {
    const worker = createMockWorker();
    createWorkerMock.mockResolvedValue(worker);

    const created = await createOcrWorker();

    expect(created).toBe(worker);
    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(createWorkerMock).toHaveBeenCalledWith('eng');
  });

  it('単発 API は検出後に worker を破棄する', async () => {
    const worker = createMockWorker();
    createWorkerMock.mockResolvedValue(worker);

    await expect(detectFromImageLike('image.png', 1600, 900)).resolves.toEqual({
      result: 'win',
      confidence: 90,
    });

    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('破棄後の再作成では新しい worker を使える', async () => {
    const worker1 = createMockWorker();
    const worker2 = createMockWorker('LOSE');
    createWorkerMock.mockResolvedValueOnce(worker1).mockResolvedValueOnce(worker2);

    const first = await createOcrWorker();
    await first.terminate();
    const second = await createOcrWorker();

    expect(first).toBe(worker1);
    expect(second).toBe(worker2);
    expect(createWorkerMock).toHaveBeenCalledTimes(2);
    expect(worker1.terminate).toHaveBeenCalledTimes(1);
  });
});
