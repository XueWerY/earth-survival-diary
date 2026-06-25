// 文件系统桥接层
// 统一封装 Capacitor Filesystem 和 HarmonyOS 原生文件操作
// 鸿蒙端通过 window.harmonyAPI 暴露同步文件操作，前端用 Promise 包装

import { Filesystem as CapFilesystem, Directory, Encoding } from '@capacitor/filesystem'

function isHarmony(): boolean {
  return typeof window !== 'undefined' && !!(window as any).harmonyAPI
}

function harmony(): any {
  return (window as any).harmonyAPI
}

export { Directory, Encoding }

export const Filesystem = {
  async readFile(opts: { path: string; directory: Directory; encoding?: string }): Promise<{ data: string }> {
    if (isHarmony()) {
      return { data: harmony().readFile(opts.path) }
    }
    return CapFilesystem.readFile(opts as any)
  },

  async writeFile(opts: { path: string; data: string; directory: Directory; encoding?: string; recursive?: boolean }): Promise<{}> {
    if (isHarmony()) {
      harmony().writeFile(opts.path, opts.data)
      return {}
    }
    return CapFilesystem.writeFile(opts as any)
  },

  async deleteFile(opts: { path: string; directory: Directory }): Promise<{}> {
    if (isHarmony()) {
      harmony().deleteFile(opts.path)
      return {}
    }
    return CapFilesystem.deleteFile(opts as any)
  },

  async stat(opts: { path: string; directory: Directory }): Promise<{ type: string }> {
    if (isHarmony()) {
      return { type: harmony().stat(opts.path) }
    }
    return CapFilesystem.stat(opts as any) as Promise<{ type: string }>
  },

  async mkdir(opts: { path: string; directory: Directory; recursive?: boolean }): Promise<{}> {
    if (isHarmony()) {
      harmony().mkdir(opts.path, opts.recursive ?? false)
      return {}
    }
    return CapFilesystem.mkdir(opts as any)
  },

  async readdir(opts: { path: string; directory: Directory }): Promise<{ files: { name: string; type: string }[] }> {
    if (isHarmony()) {
      return { files: harmony().readdir(opts.path) }
    }
    return CapFilesystem.readdir(opts as any) as Promise<{ files: { name: string; type: string }[] }>
  },

  async rmdir(opts: { path: string; directory: Directory; recursive?: boolean }): Promise<{}> {
    if (isHarmony()) {
      harmony().rmdir(opts.path, opts.recursive ?? false)
      return {}
    }
    return CapFilesystem.rmdir(opts as any)
  }
}
