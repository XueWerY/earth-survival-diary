// 文件系统桥接层
// 封装 Capacitor Filesystem 文件操作

import { Filesystem as CapFilesystem, Directory, Encoding } from '@capacitor/filesystem'

export { Directory, Encoding }

export const Filesystem = {
  async readFile(opts: { path: string; directory: Directory; encoding?: string }): Promise<{ data: string }> {
    return CapFilesystem.readFile(opts as any)
  },

  async writeFile(opts: { path: string; data: string; directory: Directory; encoding?: string; recursive?: boolean }): Promise<{}> {
    return CapFilesystem.writeFile(opts as any)
  },

  async deleteFile(opts: { path: string; directory: Directory }): Promise<{}> {
    return CapFilesystem.deleteFile(opts as any)
  },

  async stat(opts: { path: string; directory: Directory }): Promise<{ type: string }> {
    return CapFilesystem.stat(opts as any) as Promise<{ type: string }>
  },

  async mkdir(opts: { path: string; directory: Directory; recursive?: boolean }): Promise<{}> {
    return CapFilesystem.mkdir(opts as any)
  },

  async readdir(opts: { path: string; directory: Directory }): Promise<{ files: { name: string; type: string }[] }> {
    return CapFilesystem.readdir(opts as any) as Promise<{ files: { name: string; type: string }[] }>
  },

  async rmdir(opts: { path: string; directory: Directory; recursive?: boolean }): Promise<{}> {
    return CapFilesystem.rmdir(opts as any)
  }
}
