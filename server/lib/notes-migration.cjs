// server/lib/notes-migration.cjs
// 笔记数据一次性迁移：分类体系 → 标签体系
//
// 迁移内容：
//   1. note_categories（分类）→ note_tags（标签），复用分类 id 作为标签 id（保证幂等）
//   2. 笔记的 categoryId 字段 → tagIds 数组（首个标签即原分类）
//   3. 置顶从 notes:favorites（id 字符串数组）改为笔记自身的 pinned 字段
//      —— 该键曾被 noteStore（置顶 id）与 NotesPage（导航收藏对象）复用，互相覆盖；
//         迁移后置顶由 pinned 承载，若该键存的是 id 数组则清空，释放给导航收藏
//   4. 补齐 tagIds / trashedAt 默认值
//
// 幂等：以 system:state.notesMigratedAt 为标记，已迁移的用户直接跳过。
// 旧的 note_categories 表保留不删，迁移异常时数据仍可回溯。
//
// 安全：迁移会删除笔记的 categoryId 字段，属不可逆操作，因此迁移前会把
// 每个用户的原始笔记快照写入 <dataDir>/<用户目录编码>/notes-migration-backup-<时间戳>.yaml

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
const { safeSegment } = require('./yaml-store.cjs')

const NOTES_TABLE = 'notes'
const DEFAULT_TAG_COLOR = '#14b8a6'

function buildTagsFromCategories(categories) {
  return (Array.isArray(categories) ? categories : []).map((c, i) => ({
    id: String(c.id),
    name: c.name || String(c.id),
    color: c.color || DEFAULT_TAG_COLOR,
    order: typeof c.order === 'number' ? c.order : i
  }))
}

// 迁移前快照：写入失败不阻断迁移，仅告警（快照是保险而非必需）
function backupNotes(dataDir, userId, payload, log) {
  if (!dataDir) return null
  try {
    const dir = path.join(dataDir, safeSegment(userId))
    fs.mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = path.join(dir, `notes-migration-backup-${stamp}.yaml`)
    fs.writeFileSync(file, YAML.stringify(payload, { lineWidth: 0 }), 'utf-8')
    return file
  } catch (e) {
    log.warn({ err: e && e.message, userId }, '[笔记迁移] 备份快照写入失败，继续迁移')
    return null
  }
}

/**
 * @param {object} storage createYamlStore 返回的存储对象
 * @param {object} [logger] 可选日志器，需提供 info / warn / error
 * @param {string} [dataDir] 用户数据目录，用于写迁移前快照
 * @returns {Promise<{users:number, migrated:number, notes:number, tags:number, orphans:number}>}
 */
async function migrateNotesToTags(storage, logger, dataDir) {
  const noop = () => {}
  const log = {
    info: (logger && logger.info) ? logger.info.bind(logger) : noop,
    warn: (logger && logger.warn) ? logger.warn.bind(logger) : noop,
    error: (logger && logger.error) ? logger.error.bind(logger) : noop
  }

  const stats = { users: 0, migrated: 0, notes: 0, tags: 0, orphans: 0 }
  const emails = await storage.getAllUserEmails()

  for (const email of emails) {
    const userIndex = await storage.getUserIndexByEmail(email)
    if (!userIndex || !userIndex.id) continue
    const userId = userIndex.id
    stats.users++

    const state = (await storage.getUserKV(userId, 'system', 'state')) || {}
    if (state.notesMigratedAt) continue

    const notes = await storage.listRecords(NOTES_TABLE, userId)
    const categories = await storage.getUserKV(userId, 'notes', 'categories')
    const favorites = await storage.getUserKV(userId, 'notes', 'favorites')
    const existingTags = await storage.getUserKV(userId, 'notes', 'tags')

    // 已有标签则保留（避免覆盖），否则由分类转换而来
    const tags = (Array.isArray(existingTags) && existingTags.length > 0)
      ? existingTags
      : buildTagsFromCategories(categories)
    const tagIdSet = new Set(tags.map(t => String(t.id)))

    // 旧桌面端把置顶 id 数组存在 notes:favorites；导航收藏存的是对象数组，据此区分
    const isPinnedIdList = Array.isArray(favorites) && favorites.length > 0 && favorites.every(x => typeof x === 'string')
    const pinnedIds = isPinnedIdList ? favorites.map(String) : []

    // 迁移前快照（含原始分类与置顶键），便于异常时人工回退
    backupNotes(dataDir, userId, {
      migratedAt: new Date().toISOString(),
      note: '迁移前的原始笔记快照，用于人工回退（categoryId 即 tagIds[0] 的来源）',
      categories,
      favorites,
      notes
    }, log)

    for (const note of notes) {
      if (!note || typeof note !== 'object' || note.id === undefined) continue
      const next = { ...note }
      const legacyCategory = next.categoryId
      delete next.categoryId

      if (legacyCategory !== undefined) {
        const cid = String(legacyCategory)
        if (tagIdSet.has(cid)) {
          next.tagIds = [cid]
        } else {
          // 分类已被删除的孤儿笔记：与旧行为一致，归为无标签
          next.tagIds = []
          if (legacyCategory) stats.orphans++
        }
      }
      if (!Array.isArray(next.tagIds)) next.tagIds = []
      next.tagIds = next.tagIds.map(String)
      if (next.trashedAt === undefined) next.trashedAt = null
      next.pinned = next.pinned === true || pinnedIds.includes(String(note.id))

      await storage.upsertRecord(NOTES_TABLE, userId, note.id, next)
      stats.notes++
    }

    await storage.setUserKV(userId, 'notes', 'tags', tags)
    if (isPinnedIdList) {
      await storage.setUserKV(userId, 'notes', 'favorites', [])
    }
    await storage.setUserKV(userId, 'system', 'state', {
      ...state,
      notesMigratedAt: new Date().toISOString()
    })

    stats.migrated++
    stats.tags += tags.length
    log.info(
      { userId, notes: notes.length, tags: tags.length, orphans: stats.orphans },
      '[笔记迁移] 分类已转换为标签'
    )
  }

  return stats
}

module.exports = { migrateNotesToTags, buildTagsFromCategories, NOTES_TABLE }
