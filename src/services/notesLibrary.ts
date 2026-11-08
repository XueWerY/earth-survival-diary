import { getUserScope } from './localDataStore'

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

export async function getNotesLibraryInfo(): Promise<NotesLibraryInfo> {
  return api().getNotesLibraryInfo(scope())
}

export async function selectNotesLibraryFolder(): Promise<NotesLibraryInfo | null> {
  return api().selectNotesLibraryFolder(scope())
}

export async function switchNotesLibrary(libraryId: string): Promise<NotesLibraryInfo> {
  return api().switchNotesLibrary(scope(), libraryId)
}

export async function createNotesFolder(folderPath: string): Promise<NotesLibraryInfo> {
  return api().createNotesFolder(scope(), folderPath)
}

export async function renameNotesFolder(oldPath: string, newPath: string): Promise<NotesLibraryInfo> {
  return api().renameNotesFolder(scope(), oldPath, newPath)
}

export async function deleteNotesFolder(folderPath: string): Promise<NotesLibraryInfo> {
  return api().deleteNotesFolder(scope(), folderPath)
}
