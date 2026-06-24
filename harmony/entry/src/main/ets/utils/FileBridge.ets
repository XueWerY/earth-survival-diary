import fs from '@ohos.file.fs';

/**
 * 文件操作桥接类
 * 通过 WebView JavaScript Proxy 注入到前端，提供同步文件操作
 * 所有路径相对于 baseDir（应用沙箱 filesDir/data 目录）
 */
export class FileBridge {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    // 确保数据目录存在
    if (!fs.accessSync(baseDir)) {
      fs.mkdirSync(baseDir, true);
    }
  }

  /** 拼接完整路径 */
  private resolve(relativePath: string): string {
    return this.baseDir + '/' + relativePath;
  }

  /** 获取父目录路径 */
  private parentOf(fullPath: string): string {
    const idx = fullPath.lastIndexOf('/');
    return idx > 0 ? fullPath.substring(0, idx) : fullPath;
  }

  /** 读取文本文件，文件不存在时抛出异常 */
  readFile(relativePath: string): string {
    return fs.readTextSync(this.resolve(relativePath));
  }

  /** 写入文本文件，自动创建父目录 */
  writeFile(relativePath: string, data: string): void {
    const fullPath = this.resolve(relativePath);
    const dir = this.parentOf(fullPath);
    if (!fs.accessSync(dir)) {
      fs.mkdirSync(dir, true);
    }
    const file = fs.openSync(fullPath, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
    fs.writeSync(file.fd, data);
    fs.closeSync(file);
  }

  /** 删除文件，文件不存在时静默忽略 */
  deleteFile(relativePath: string): void {
    try {
      fs.unlinkSync(this.resolve(relativePath));
    } catch (e) {
      // 文件不存在，忽略
    }
  }

  /** 获取路径类型，返回 'file' 或 'directory'，不存在时抛出异常 */
  stat(relativePath: string): string {
    const stat = fs.statSync(this.resolve(relativePath));
    return stat.isDirectory() ? 'directory' : 'file';
  }

  /** 创建目录 */
  mkdir(relativePath: string, recursive: boolean): void {
    const fullPath = this.resolve(relativePath);
    if (!fs.accessSync(fullPath)) {
      fs.mkdirSync(fullPath, recursive);
    }
  }

  /** 列出目录内容 */
  readdir(relativePath: string): { name: string, type: string }[] {
    const entries = fs.listFileSync(this.resolve(relativePath));
    return entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file'
    }));
  }

  /** 删除目录，recursive 为 true 时递归删除 */
  rmdir(relativePath: string, recursive: boolean): void {
    const fullPath = this.resolve(relativePath);
    if (!fs.accessSync(fullPath)) return;
    if (recursive) {
      this.removeRecursive(fullPath);
    } else {
      fs.rmdirSync(fullPath);
    }
  }

  /** 递归删除目录 */
  private removeRecursive(dirPath: string): void {
    const entries = fs.listFileSync(dirPath);
    for (const entry of entries) {
      const entryPath = dirPath + '/' + entry.name;
      if (entry.isDirectory()) {
        this.removeRecursive(entryPath);
      } else {
        fs.unlinkSync(entryPath);
      }
    }
    fs.rmdirSync(dirPath);
  }
}
