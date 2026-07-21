/**
 * migrate-docs-to-notes.cjs
 *
 * 将项目根目录的 项目规范.md 和 README.md 内容拆分多页面迁移到应用内笔记系统。
 *
 * 拆分策略：
 * - 项目规范按 H2 (##) 拆分为 Level 1 页面
 * - README 的「功能特性」下 H3 (###) 拆分为 Level 2 子页面，其余 H2 为 Level 1
 *
 * 使用: node scripts/migrate-docs-to-notes.cjs
 */

const fs = require('fs')
const path = require('path')

// ====== 工具函数 ======

function genId(prefix = 'p_') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 将纯文本按行转为 HTML 段落，保留空行、代码块和表格 */
function textToHtml(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const result = []
  let inCodeBlock = false
  let codeContent = ''
  let inTable = false
  let tableRows = []

  for (const line of lines) {
    const trimmed = line.trim()

    // 代码块
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        result.push(`<pre><code>${escapeHtml(codeContent)}</code></pre>`)
        codeContent = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeContent = ''
      }
      continue
    }
    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line
      continue
    }

    // 表格行（| ... | ... |）
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.includes('---') && trimmed.replace(/\|/g, '').replace(/-/g, '').trim() === '') {
        // 分隔行，跳过
        continue
      }
      const cells = trimmed.split('|').filter(c => c.trim()).map(c => c.trim())
      const isHeader = !inTable
      const tag = isHeader ? 'th' : 'td'
      tableRows.push(`<tr>${cells.map(c => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`)
      inTable = true
      continue
    }
    if (inTable) {
      result.push(`<table><thead>${tableRows[0] || ''}</thead><tbody>${tableRows.slice(1).join('')}</tbody></table>`)
      tableRows = []
      inTable = false
    }

    // 空行
    if (!trimmed) {
      result.push('<p><br></p>')
      continue
    }

    // 标题行（# 开头但已经是页面标题的跳过——这里保留所有内容）
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = escapeHtml(headingMatch[2])
      result.push(`<h${level}>${title}</h${level}>`)
      continue
    }

    // 普通段落
    result.push(`<p>${escapeHtml(trimmed)}</p>`)
  }

  // 处理未闭合的表格
  if (inTable && tableRows.length > 0) {
    const hasHeader = tableRows.length > 1
    if (hasHeader) {
      result.push(`<table><thead>${tableRows[0]}</thead><tbody>${tableRows.slice(1).join('')}</tbody></table>`)
    } else {
      result.push(`<table><tbody>${tableRows.join('')}</tbody></table>`)
    }
  }

  return result.join('')
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ====== Markdown 解析 ======

/**
 * 解析 Markdown 为章节数组。
 * 返回 { title, headings: [{ level, text, content }] }
 * level: 2 = H2, 3 = H3
 */
function parseMdSections(text) {
  const lines = text.split('\n')
  let h1Title = ''
  const headings = []
  let currentHeading = null
  let preContent = '' // H1 之后、第一个 H2 之前的内容

  for (const line of lines) {
    const h1m = line.match(/^#\s+(.+)/)
    if (h1m && !h1Title) {
      h1Title = h1m[1].trim()
      continue
    }
    const h2m = line.match(/^##\s+(.+)/)
    if (h2m) {
      if (currentHeading) {
        headings.push(currentHeading)
      }
      currentHeading = { level: 2, text: h2m[1].trim(), content: '' }
      continue
    }
    const h3m = line.match(/^###\s+(.+)/)
    if (h3m) {
      if (currentHeading) {
        headings.push(currentHeading)
      }
      currentHeading = { level: 3, text: h3m[1].trim(), content: '' }
      continue
    }
    if (currentHeading) {
      currentHeading.content += (currentHeading.content ? '\n' : '') + line
    } else {
      preContent += (preContent ? '\n' : '') + line
    }
  }
  if (currentHeading) {
    headings.push(currentHeading)
  }

  return { h1Title, headings, preContent: preContent.trim() }
}

// ====== 构建笔记页面 ======

function buildSpecPages(headings, h1Title) {
  const pages = []

  // 封面页
  pages.push({ id: genId(), title: '封面', level: 1, type: 'cover', content: '' })

  // 每个 H2 作为一个 Level 1 页面（忽略 H3，H3 内容合并到所属 H2 页面中）
  for (const h of headings) {
    if (h.level === 2) {
      pages.push({
        id: genId(),
        title: h.text,
        level: 1,
        content: textToHtml(h.content)
      })
    }
  }

  // 致谢页
  pages.push({ id: genId(), title: '致谢', level: 1, type: 'thanks', content: '' })

  return pages
}

function buildReadmePages(headings, h1Title) {
  const pages = []

  // 封面页
  pages.push({ id: genId(), title: '封面', level: 1, type: 'cover', content: '' })

  const featuresH2 = headings.find(h => h.level === 2 && (h.text.includes('功能特性') || h.text.includes('功能')))
  const otherH2s = headings.filter(h => h.level === 2 && h !== featuresH2)

  // 收集功能特性下的 H3 子模块
  let featuresIdx = -1
  const featureSubPages = []
  if (featuresH2) {
    featuresIdx = headings.indexOf(featuresH2)
    for (let i = featuresIdx + 1; i < headings.length; i++) {
      if (headings[i].level === 2) break
      if (headings[i].level === 3) {
        featureSubPages.push(headings[i])
      }
    }
  }

  // "功能特性" 父页面（L1）
  const featuresPageId = genId()
  const featuresH2Content = featuresH2 ? featuresH2.content.trim() : ''
  // 去除 H2 内容中实际属于第一个 H3 之前的部分（概述段落）
  let featuresIntro = ''
  if (featuresH2Content) {
    const firstH3Line = featureSubPages.length > 0
      ? featureSubPages[0].text
      : ''
    // 简单取 H2 下第一个 H3 标题之前的内容作为概述
    const idx = featuresH2Content.indexOf(firstH3Line)
    if (idx > 0) {
      featuresIntro = featuresH2Content.substring(0, idx).trim()
    } else {
      featuresIntro = featuresH2Content
    }
  }
  pages.push({
    id: featuresPageId,
    title: '功能特性',
    level: 1,
    content: textToHtml(featuresIntro)
  })

  // 功能特性下的子页面（L2）
  for (const sp of featureSubPages) {
    pages.push({
      id: genId(),
      title: sp.text,
      level: 2,
      parentId: featuresPageId,
      content: textToHtml(sp.content)
    })
  }

  // 其余 H2 章节作为 Level 1 页面
  for (const h of otherH2s) {
    // 收集该 H2 下的 H3 内容（合并到一个页面）
    const h2Idx = headings.indexOf(h)
    let mergedContent = h.content
    for (let i = h2Idx + 1; i < headings.length; i++) {
      if (headings[i].level === 2) break
      if (headings[i].level === 3) {
        mergedContent += '\n### ' + headings[i].text + '\n' + headings[i].content
      }
    }
    pages.push({
      id: genId(),
      title: h.text.length > 30 ? h.text.substring(0, 30) : h.text,
      level: 1,
      content: textToHtml(mergedContent)
    })
  }

  // 致谢页
  pages.push({ id: genId(), title: '致谢', level: 1, type: 'thanks', content: '' })

  return pages
}

// ====== 数据目录与用户 ======

function getDataDir() {
  // Windows: %APPDATA%/earth-survival-diary/data/
  const appdata = process.env.APPDATA
  if (appdata) {
    const p = path.join(appdata, 'earth-survival-diary', 'data')
    if (fs.existsSync(p)) return p
  }
  // 回退：项目根目录下的 data/
  const local = path.join(__dirname, '..', 'data')
  if (fs.existsSync(local)) return local
  return null
}

function getUsers(dataDir) {
  const usersDir = path.join(dataDir, 'users')
  if (!fs.existsSync(usersDir)) return []
  return fs.readdirSync(usersDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(usersDir, f), 'utf-8'))
        return { email: f.replace('.json', ''), id: entry.id }
      } catch { return null }
    })
    .filter(Boolean)
}

function readJson(filePath, defaultVal = null) {
  if (!fs.existsSync(filePath)) return defaultVal
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { return defaultVal }
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

const DEFAULT_CATEGORIES = [
  { id: 'personal', name: '个人', icon: '📝', color: '#667eea', isCustom: false },
  { id: 'work', name: '工作', icon: '💼', color: '#3b82f6', isCustom: false },
  { id: 'study', name: '学习', icon: '📚', color: '#10b981', isCustom: false },
  { id: 'ideas', name: '灵感', icon: '💡', color: '#f59e0b', isCustom: false },
]

// ====== 主流程 ======

function main() {
  const rootDir = path.join(__dirname, '..')

  console.log('===== Docs Migration to Notes System =====\n')

  // 1. 读取源文件
  const specPath = path.join(rootDir, '项目规范.md')
  const readmePath = path.join(rootDir, 'README.md')

  if (!fs.existsSync(specPath)) {
    console.error('Error: 项目规范.md does not exist')
    process.exit(1)
  }
  if (!fs.existsSync(readmePath)) {
    console.error('Error: README.md does not exist')
    process.exit(1)
  }

  console.log('Reading 项目规范.md ...')
  const specText = fs.readFileSync(specPath, 'utf-8')
  console.log('Reading README.md ...')
  const readmeText = fs.readFileSync(readmePath, 'utf-8')

  // 2. Parse sections
  console.log('\nParsing project spec sections...')
  const specParsed = parseMdSections(specText)
  const specPages = buildSpecPages(specParsed.headings, specParsed.h1Title)
  console.log(`  → ${specPages.length} pages (incl. cover & credits)`)

  console.log('Parsing user guide sections...')
  const readmeParsed = parseMdSections(readmeText)
  const readmePages = buildReadmePages(readmeParsed.headings, readmeParsed.h1Title)
  console.log(`  → ${readmePages.length} pages (incl. cover & credits)`)

  // 3. 查找数据目录
  const dataDir = getDataDir()
  if (!dataDir) {
    console.warn('\nWarning: Data directory not found (%APPDATA%/earth-survival-diary/data or ./data)')
    console.warn('Note creation skipped. Notes will be auto-created after first user registration on app launch.')
    console.log('\nDeleting source files...')
    fs.unlinkSync(specPath)
    fs.unlinkSync(readmePath)
    console.log('Done (no user data, source files deleted only)')
    return
  }
  console.log(`\nData directory: ${dataDir}`)

  // 4. Get users
  const users = getUsers(dataDir)
  if (users.length === 0) {
    console.warn('\nWarning: No registered users found')
    console.warn('Note creation skipped. Notes will be auto-created after first user registration on app launch.')
    console.log('\nDeleting source files...')
    fs.unlinkSync(specPath)
    fs.unlinkSync(readmePath)
    console.log('Done (no user data, source files deleted only)')
    return
  }
  console.log(`Found ${users.length} user(s): ${users.map(u => u.email).join(', ')}`)

  // 5. Create notes for each user
  const now = new Date().toISOString()

  for (const user of users) {
    console.log(`\nProcessing user: ${user.email} (${user.id})`)

    // Ensure categories exist
    const catPath = path.join(dataDir, user.id, 'notes', 'categories.json')
    let categories = readJson(catPath)
    if (!categories || categories.length === 0) {
      categories = [...DEFAULT_CATEGORIES]
      writeJson(catPath, categories)
      console.log('  → Initialized default categories')
    }

    // Read existing notes
    const notesPath = path.join(dataDir, user.id, 'notes', 'notes.json')
    let notes = readJson(notesPath, [])

    // Check for existing notes with same title
    const hasSpec = notes.some(n => n.title === '项目规范')
    const hasGuide = notes.some(n => n.title === '使用指南')

    if (hasSpec) {
      console.log('  → Project spec note already exists, skipping')
    } else {
      const specNote = {
        id: genId('n_'),
        title: '项目规范',
        content: JSON.stringify({ pages: specPages }),
        color: '#667eea',
        categoryId: 'study',
        pinned: true,
        createdAt: now,
        updatedAt: now,
      }
      notes.unshift(specNote)
      console.log(`  → Created note "Project Spec" (${specPages.length} pages)`)
    }

    if (hasGuide) {
      console.log('  → User guide note already exists, skipping')
    } else {
      const guideNote = {
        id: genId('n_'),
        title: '使用指南',
        content: JSON.stringify({ pages: readmePages }),
        color: '#667eea',
        categoryId: 'study',
        pinned: true,
        createdAt: now,
        updatedAt: now,
      }
      notes.unshift(guideNote)
      console.log(`  → Created note "User Guide" (${readmePages.length} pages)`)
    }

    // Save notes
    writeJson(notesPath, notes)
  }

  // 6. Delete source files
  console.log('\nDeleting source files...')
  fs.unlinkSync(specPath)
  console.log('  → 项目规范.md deleted')
  fs.unlinkSync(readmePath)
  console.log('  → README.md deleted')

  console.log('\n===== Migration complete =====')
}

main()
