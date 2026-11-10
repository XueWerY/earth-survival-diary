import { getUserScope } from './localDataStore'
import YAML from 'yaml'

export interface NotesLibraryInfo {
  configured: boolean
  activeLibraryId: string | null
  rootPath: string | null
  rootExists: boolean
  noteCount: number
  folders: string[]
  libraries: Array<{ id: string; name: string; rootPath: string; rootExists: boolean }>
  legacyNoteCount: number
}

const api = () => {
  const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!bridge?.getNotesLibraryInfo || !bridge.selectNotesLibraryFolder) {
    throw new Error('笔记库服务不可用，请通过 pnpm dev 或 pnpm preview 打开应用')
  }
  return bridge
}

const scope = () => getUserScope()
const pinnedTabStatePath = (rootPath: string) => `${rootPath.replace(/[\\/]+$/g, '')}/.earth-survival-diary/tabs.yaml`
const folderFavoritesPath = (rootPath: string) => `${rootPath.replace(/[\\/]+$/g, '')}/.earth-survival-diary/folders.yaml`
const normalizePinnedTabIds = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is string => typeof id === 'string' && !!id.trim() && id.length <= 512 && !/[\u0000-\u001f]/.test(id)))]
  : []
const normalizeFavoriteFolderPaths = (value: unknown): string[] => {
  const paths = Array.isArray(value) ? value : value && typeof value === 'object' && 'folderPaths' in value ? value.folderPaths : []
  return Array.isArray(paths)
    ? [...new Set(paths.filter((item): item is string => typeof item === 'string' && !!item.trim() && !/[\u0000-\u001f]/.test(item)))].map(item => item.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')).filter(Boolean)
    : []
}

export async function getNotesLibraryInfo(): Promise<NotesLibraryInfo> {
  return api().getNotesLibraryInfo(scope())
}

export async function readPinnedNoteTabIds(libraryId: string, rootPath?: string): Promise<string[]> {
  const bridge = api()
  if (bridge.readPinnedNoteTabIds) return bridge.readPinnedNoteTabIds(scope(), libraryId)
  if (!rootPath || !bridge.readFile) return []
  const content = await bridge.readFile(pinnedTabStatePath(rootPath))
  if (!content) return []
  const value = YAML.parse(content)
  const storedIds = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'pinnedNoteIds' in value
      ? value.pinnedNoteIds
      : []
  return normalizePinnedTabIds(storedIds)
}

export async function writePinnedNoteTabIds(libraryId: string, ids: string[], rootPath?: string): Promise<boolean> {
  const bridge = api()
  const normalized = normalizePinnedTabIds(ids)
  if (bridge.writePinnedNoteTabIds) return bridge.writePinnedNoteTabIds(scope(), libraryId, normalized)
  if (!rootPath || !bridge.writeFile) throw new Error('笔记库固定标签状态服务不可用')
  const content = YAML.stringify({ version: 1, pinnedNoteIds: normalized }, { lineWidth: 0 })
  if (!await bridge.writeFile(pinnedTabStatePath(rootPath), content)) throw new Error('笔记库固定标签状态写入失败')
  return true
}

export async function readFavoriteNoteFolderPaths(libraryId: string, rootPath?: string): Promise<string[]> {
  const bridge = api()
  if (bridge.readFavoriteNoteFolderPaths) return normalizeFavoriteFolderPaths(await bridge.readFavoriteNoteFolderPaths(scope(), libraryId))
  if (!rootPath || !bridge.readFile) return []
  const content = await bridge.readFile(folderFavoritesPath(rootPath))
  if (!content) return []
  return normalizeFavoriteFolderPaths(YAML.parse(content))
}

export async function writeFavoriteNoteFolderPaths(libraryId: string, paths: string[], rootPath?: string): Promise<boolean> {
  const bridge = api()
  const normalized = normalizeFavoriteFolderPaths(paths)
  if (bridge.writeFavoriteNoteFolderPaths) return bridge.writeFavoriteNoteFolderPaths(scope(), libraryId, normalized)
  if (!rootPath || !bridge.writeFile) throw new Error('笔记库文件夹收藏服务不可用')
  const content = YAML.stringify({ version: 1, folderPaths: normalized }, { lineWidth: 0 })
  if (!await bridge.writeFile(folderFavoritesPath(rootPath), content)) throw new Error('笔记库文件夹收藏写入失败')
  return true
}

export async function selectNotesLibraryFolder(): Promise<NotesLibraryInfo | null> {
  return api().selectNotesLibraryFolder(scope())
}

export async function switchNotesLibrary(libraryId: string): Promise<NotesLibraryInfo> {
  return api().switchNotesLibrary(scope(), libraryId)
}

export async function removeUnavailableNotesLibrary(libraryId: string): Promise<NotesLibraryInfo> {
  const bridge = api()
  if (!bridge.removeUnavailableNotesLibrary) throw new Error('移除失效笔记库记录的服务不可用')
  return bridge.removeUnavailableNotesLibrary(scope(), libraryId)
}

export async function createNotesFolder(folderPath: string): Promise<NotesLibraryInfo> {
  return api().createNotesFolder(scope(), folderPath)
}

export async function renameNotesFolder(oldPath: string, newPath: string): Promise<NotesLibraryInfo> {
  return api().renameNotesFolder(scope(), oldPath, newPath)
}

export async function duplicateNotesFolder(sourcePath: string, targetPath: string): Promise<NotesLibraryInfo> {
  return api().duplicateNotesFolder(scope(), sourcePath, targetPath)
}

export async function openNoteLibraryPath(relativePath: string): Promise<boolean> {
  const bridge = api()
  if (!bridge.openNoteLibraryPath) throw new Error('系统默认应用打开不可用')
  return bridge.openNoteLibraryPath(scope(), relativePath)
}

export async function revealNoteLibraryPath(relativePath: string): Promise<boolean> {
  const bridge = api()
  if (!bridge.revealNoteLibraryPath) throw new Error('系统文件管理器定位不可用')
  return bridge.revealNoteLibraryPath(scope(), relativePath)
}

export async function getNoteLibraryNotePath(noteId: string): Promise<string> {
  const bridge = api()
  if (!bridge.getNoteLibraryNotePath) throw new Error('笔记库文件路径服务不可用')
  return bridge.getNoteLibraryNotePath(scope(), noteId)
}

export async function exportNotePdf(title: string, html: string, settings: Record<string, unknown>): Promise<string> {
  const bridge = api()
  if (!bridge.exportNotePdf) throw new Error('当前运行环境不支持生成 PDF')
  return bridge.exportNotePdf(title, html, settings)
}

export async function deleteNotesFolder(folderPath: string): Promise<NotesLibraryInfo> {
  return api().deleteNotesFolder(scope(), folderPath)
}
