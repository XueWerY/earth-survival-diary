type MediaUploadTarget =
  | { mode: 'asset'; scope: string; mimeType: string; fileName: string }

/** 音视频走分块传输，避免主进程从 Windows 文件路径读取时无进度地阻塞。 */
export function shouldUploadMediaInChunks(mimeType: string): boolean {
  return /^(audio|video)\//i.test(String(mimeType || ''))
}

/** Electron 路径不可用时，以小块传输文件，避免 renderer 读取整个媒体文件或构造 Base64。 */
export async function uploadPickedMediaFileInChunks(
  file: File,
  target: MediaUploadTarget,
  onProgress?: (loaded: number, total: number) => void,
): Promise<string | null> {
  if (file.size > 512 * 1024 * 1024) throw new Error('媒体文件不能超过 512 MB')
  const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!bridge?.beginPickedMediaUpload || !bridge.appendPickedMediaUploadChunk
    || !bridge.finishPickedMediaUpload || !bridge.cancelPickedMediaUpload) return null

  const uploadId = await bridge.beginPickedMediaUpload(target)
  let unsubscribe = () => {}
  try {
    const chunkSize = 4 * 1024 * 1024
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const bytes = new Uint8Array(await withTimeout(
        file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer(),
        '读取媒体文件分块超时，请检查文件是否可正常读取后重试',
      ))
      const loaded = await bridge.appendPickedMediaUploadChunk(uploadId, bytes)
      onProgress?.(loaded, file.size)
    }
    const reference = await withTimeout(
      new Promise<string>((resolve, reject) => {
        unsubscribe = bridge.finishPickedMediaUpload(uploadId, result => {
          if (result.uploadId !== uploadId) return
          unsubscribe()
          if (result.error) reject(new Error(result.error))
          else if (typeof result.reference === 'string' && result.reference) resolve(result.reference)
          else reject(new Error('主进程返回了无效的媒体保存结果'))
        })
      }),
      '页面未及时收到主进程的媒体保存回调，请重试',
      MEDIA_FINISH_RESPONSE_TIMEOUT_MS,
    )
    bridge.reportMediaUploadCheckpoint?.('upload-service-resumed')
    console.info('[媒体上传] 渲染进程已收到主进程保存确认')
    return reference
  } catch (error) {
    unsubscribe()
    try {
      await withTimeout(
        bridge.cancelPickedMediaUpload(uploadId),
        '取消媒体上传超时',
        MEDIA_CANCEL_TIMEOUT_MS,
      )
    } catch (cleanupError) {
      console.warn('[媒体上传] 上传失败后的清理未及时完成', cleanupError)
    }
    throw error
  }
}

const MEDIA_IO_IDLE_TIMEOUT_MS = 60_000
const MEDIA_CANCEL_TIMEOUT_MS = 5_000
const MEDIA_FINISH_RESPONSE_TIMEOUT_MS = 20_000

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = MEDIA_IO_IDLE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export function subscribeToMediaSaveProgress(
  jobId: string,
  onProgress?: (loaded: number, total: number) => void,
): () => void {
  const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!bridge?.onMediaSaveProgress || !onProgress) return () => {}
  return bridge.onMediaSaveProgress(progress => {
    if (progress.jobId === jobId) onProgress(progress.loaded, progress.total)
  })
}

export function createMediaSaveJobId(): string {
  return 'media-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}
