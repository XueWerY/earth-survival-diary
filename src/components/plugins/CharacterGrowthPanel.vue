<template>
  <div class="growth-panel" :class="`game-${game}`">
    <section class="account-toolbar">
      <el-select
        v-if="records.accounts.length"
        :model-value="records.selectedUid"
        class="account-select"
        :placeholder="game === 'genshin' ? '选择账号' : '选择 UID'"
        @change="selectAccount"
      >
        <el-option
          v-for="account in records.accounts"
          :key="account.uid"
          :label="accountLabel(account)"
          :value="account.uid"
        />
      </el-select>
      <el-input
        v-model="newUid"
        class="uid-input"
        maxlength="9"
        :placeholder="game === 'genshin' ? '账号 UID（用于区分）' : '9 位 UID'"
        @keyup.enter="addAccount"
      />
      <el-input
        v-model="newAlias"
        class="alias-input"
        maxlength="30"
        placeholder="备注（可选）"
        @keyup.enter="addAccount"
      />
      <el-button type="primary" :disabled="!isUidValid(newUid) || addingAccount" :loading="addingAccount" @click="addAccount">
        {{ game === 'genshin' ? '添加账号' : '添加 UID' }}
      </el-button>
      <el-button
        v-if="activeAccount && game === 'star-rail'"
        :disabled="fetching || cooldownSeconds > 0"
        :loading="fetching"
        @click="refreshShowcase"
      >
        {{ cooldownSeconds > 0 ? `稍后刷新 ${formatDuration(cooldownSeconds)}` : '刷新展柜' }}
      </el-button>
      <el-button v-if="activeAccount" class="delete-account" text @click="deleteAccount">
        {{ game === 'genshin' ? '删除账号' : '删除 UID' }}
      </el-button>
    </section>

    <div v-if="saveError" class="notice notice-error" role="alert">{{ saveError }}</div>
    <div v-if="loadError" class="notice notice-error" role="alert">{{ loadError }}</div>
    <div v-if="requestMessage" class="notice" :class="requestIsError ? 'notice-error' : 'notice-info'" role="status">
      {{ requestMessage }}
      <span v-if="activeAccount?.snapshot?.characters.length === 0" class="notice-tail">仍可手动添加角色。</span>
    </div>

    <div v-if="!ready" class="empty-state loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在读取本机记录…</span>
    </div>

    <template v-else-if="activeAccount">
      <section class="player-card">
        <div class="player-avatar" :class="{ 'avatar-genshin': game === 'genshin' }">
          {{ (game === 'genshin' ? (activeAccount.alias || '手') : (activeAccount.playerName || activeAccount.alias || 'UID')).slice(0, 1) }}
        </div>
        <div class="player-copy">
          <div class="player-title">
            <strong>{{ game === 'genshin' ? (activeAccount.alias || '手动记录') : (activeAccount.playerName || activeAccount.alias || '公开展柜') }}</strong>
            <span class="uid-chip">UID {{ activeAccount.uid }}</span>
          </div>
          <div class="player-meta">
            <span v-if="game === 'star-rail' && activeAccount.playerLevel !== null && activeAccount.playerLevel !== undefined">
              开拓等级 {{ activeAccount.playerLevel }}
            </span>
            <span v-if="game === 'star-rail' && activeAccount.worldLevel !== null && activeAccount.worldLevel !== undefined">
              均衡等级 {{ activeAccount.worldLevel }}
            </span>
            <span v-if="game === 'star-rail' && activeAccount.fetchedAt">展柜读取 {{ formatDate(activeAccount.fetchedAt) }}</span>
            <span v-if="game === 'star-rail' && cooldownSeconds > 0">API 缓存还需 {{ formatDuration(cooldownSeconds) }}</span>
          </div>
        </div>
        <div class="player-actions">
          <el-button size="small" @click="startNewCharacter">{{ game === 'genshin' ? '添加角色' : '手动添加角色' }}</el-button>
        </div>
      </section>

      <div v-if="allCharacters.length" class="character-workspace" :class="{ 'character-workspace-genshin': game === 'genshin' }">
        <aside class="character-list" :class="{ 'character-list-genshin': game === 'genshin' }" aria-label="角色列表">
          <div v-if="game === 'genshin'" class="roster-heading">
            <div>
              <h3>角色名册</h3>
              <span>{{ genshinAvatarCatalogError || (genshinAvatarCatalogLoaded ? (genshinAvatarIconsByName.size ? '头像按角色 ID 或名称自动匹配，点击角色查看培养信息' : '头像图鉴已加载；未匹配到时可填写官方角色 ID') : '正在获取角色头像图鉴…') }}</span>
            </div>
            <div class="roster-heading-actions">
              <small>{{ allCharacters.length }} 位角色</small>
              <el-button v-if="!genshinAvatarCatalogLoaded" size="small" text :loading="genshinAvatarCatalogLoading" @click="loadGenshinAvatarCatalog">
                {{ genshinAvatarCatalogError ? '重试' : '加载头像' }}
              </el-button>
            </div>
          </div>
          <button
            v-for="character in allCharacters"
            :key="character.id"
            type="button"
            class="character-tile"
            :class="{ active: selectedCharacterId === character.id, manual: character.manual, 'character-tile-genshin': game === 'genshin' }"
            @click="selectedCharacterId = character.id"
          >
            <img v-if="character.icon && !brokenAvatarUrls.has(character.icon)" :src="character.icon" :alt="''" loading="lazy" @error="markAvatarBroken(character.icon)" />
            <span class="character-initial" :hidden="Boolean(character.icon && !brokenAvatarUrls.has(character.icon))">{{ character.name.slice(0, 1) }}</span>
            <span class="character-tile-name">{{ character.name }}</span>
            <span class="character-tile-level">{{ character.metrics.level ?? '—' }}</span>
          </button>
        </aside>

        <section v-if="selectedCharacter" class="character-detail">
          <div class="detail-heading">
            <div>
              <div class="eyebrow">{{ game === 'genshin' || selectedCharacter.manual ? '手动记录角色' : '公开展柜角色' }}</div>
              <h3>{{ selectedCharacter.name }}</h3>
              <span v-if="game === 'star-rail' && selectedCharacter.id && !selectedCharacter.manual" class="character-id">角色 ID {{ selectedCharacter.id }}</span>
            </div>
            <el-button @click="editCharacter(selectedCharacter)">{{ game === 'genshin' ? '角色信息与目标' : '数值与目标' }}</el-button>
          </div>

          <div class="progress-card">
            <div class="progress-header">
              <span>养成目标进度</span>
              <strong v-if="selectedProgress.total">{{ selectedProgress.done }} / {{ selectedProgress.total }} 项 · {{ selectedProgress.percent }}%</strong>
              <strong v-else>尚未设置目标</strong>
            </div>
            <div v-if="selectedProgress.total" class="progress-track">
              <span :style="{ width: `${selectedProgress.percent}%` }" />
            </div>
            <div v-else class="progress-hint">为等级、命座/星魂、技能或武器设置数值目标后显示进度。</div>
          </div>

          <div class="metrics-grid">
            <div v-for="metric in metricDefinitions" :key="metric.key" class="metric-card">
              <span>{{ metric.label }}</span>
              <strong>{{ formatMetric(currentMetric(metric.key)) }}<small v-if="goalMetric(metric.key) !== null"> / {{ formatMetric(goalMetric(metric.key)) }}</small></strong>
              <span class="metric-foot" :class="metricStateClass(metric.key)">{{ metricStateText(metric.key) }}</span>
            </div>
          </div>

          <div v-if="selectedCharacter.weaponName || selectedCharacter.gear.length" class="equipment-section">
            <h4>{{ game === 'genshin' ? '武器与圣遗物' : '光锥与遗器' }}</h4>
            <div v-if="selectedCharacter.weaponName" class="weapon-row">
              <span class="equipment-symbol">{{ game === 'genshin' ? '⚔' : '✧' }}</span>
              <div>
                <strong>{{ selectedCharacter.weaponName }}</strong>
                <span>
                  {{ game === 'genshin' ? '武器' : '光锥' }} · Lv. {{ selectedCharacter.metrics.weaponLevel ?? '—' }}
                  <template v-if="selectedCharacter.weaponRank !== null"> · {{ game === 'genshin' ? '精炼' : '叠影' }} {{ selectedCharacter.weaponRank }}</template>
                </span>
              </div>
            </div>
            <div v-if="selectedCharacter.gear.length" class="gear-list">
              <div v-for="(piece, index) in selectedCharacter.gear" :key="`${index}-${piece}`" class="gear-chip">{{ piece }}</div>
            </div>
          </div>
          <div v-else-if="game === 'star-rail' && !selectedCharacter.manual" class="detail-footnote">展柜没有返回装备细节，可在“数值与目标”中补充数值。</div>
        </section>
      </div>

      <section v-else class="empty-state">
        <div class="empty-symbol">{{ game === 'genshin' ? '✧' : '星' }}</div>
        <strong>{{ game === 'genshin' ? '还没有角色记录' : (activeAccount.snapshot ? '展柜里暂时没有可展示的角色' : '尚未读取角色展柜') }}</strong>
        <p v-if="game === 'genshin'">角色、等级、命之座、天赋、武器和圣遗物信息由你手动填写。</p>
        <p v-else>{{ activeAccount.snapshot ? '展柜未公开或没有设置展示角色。你仍可以手动添加角色并记录培养目标。' : '点击“刷新展柜”读取公开角色；也可以先手动添加角色。' }}</p>
        <div class="empty-actions">
          <el-button v-if="game === 'star-rail' && !activeAccount.snapshot" type="primary" :disabled="fetching || cooldownSeconds > 0" :loading="fetching" @click="refreshShowcase">读取公开展柜</el-button>
          <el-button type="primary" plain @click="startNewCharacter">{{ game === 'genshin' ? '添加角色' : '手动添加角色' }}</el-button>
        </div>
      </section>
    </template>

    <section v-else-if="ready" class="empty-state first-run">
      <div class="empty-symbol">{{ game === 'genshin' ? '✧' : '星' }}</div>
      <strong>{{ game === 'genshin' ? '创建一个原神账号' : `添加一个 ${gameTitle} UID` }}</strong>
      <p v-if="game === 'genshin'">输入账号 UID 作为本地分类标识；角色和培养信息全部由你填写，不会读取展柜。</p>
      <p v-else>使用 Enka.Network 公开展柜，无需登录。输入 UID 即可读取角色数据。</p>
    </section>

    <el-dialog v-model="editorVisible" :title="game === 'genshin' ? (editingId ? '编辑角色信息' : '添加角色') : (editingId ? '数值与培养目标' : '手动添加角色')" width="min(680px, 94vw)" destroy-on-close>
      <div class="editor-body">
        <label class="form-field">
          <span>角色名称</span>
          <el-input v-model="editName" maxlength="40" placeholder="输入角色名称" />
        </label>
        <label v-if="!editingId" class="form-field">
          <span>{{ game === 'genshin' ? '角色 ID（匹配头像，可选）' : '角色 ID（可选）' }}</span>
          <el-input v-model="editId" maxlength="40" :placeholder="game === 'genshin' ? '填写官方角色 ID 可匹配头像，也可留空' : '自定义条目会自动生成 ID'" />
        </label>
        <template v-if="game === 'genshin'">
          <label class="form-field">
            <span>武器名称</span>
            <el-input v-model="editWeaponName" maxlength="60" placeholder="可不填写" />
          </label>
          <label class="form-field">
            <span>武器精炼等级</span>
            <el-input-number v-model="editWeaponRank" :min="1" :max="5" :step="1" controls-position="right" placeholder="未记录" />
          </label>
          <label class="form-field form-field-top">
            <span>圣遗物记录</span>
            <el-input v-model="editGear" type="textarea" :rows="4" placeholder="每行填写一件圣遗物，可记录套装、等级或词条" />
          </label>
        </template>
        <div class="editor-table-head">
          <span>数值</span><span>当前</span><span>目标</span>
        </div>
        <div v-for="metric in metricDefinitions" :key="metric.key" class="editor-metric-row">
          <label :for="`current-${metric.key}`">{{ metric.label }}</label>
          <el-input-number
            :id="`current-${metric.key}`"
            v-model="editCurrent[metric.key]"
            :min="0"
            :max="metric.max"
            :step="1"
            controls-position="right"
            placeholder="未记录"
          />
          <el-input-number
            v-model="editGoals[metric.key]"
            :min="0"
            :max="metric.max"
            :step="1"
            controls-position="right"
            placeholder="不设置"
          />
        </div>
        <p class="editor-tip">{{ game === 'genshin' ? '当前数值、培养目标和装备明细均保存在本机，可随时手动修改。' : '展柜刷新时只替换线上数据；这里手动补充的当前值和目标会保留。未填写当前值时使用展柜数据。' }}</p>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editorVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!editName.trim()" @click="saveCharacterEdit">保存</el-button>
        </div>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { getData, setData } from '../../services/storageService'

type Game = 'star-rail' | 'genshin'
type MetricKey = 'level' | 'rank' | 'skill1' | 'skill2' | 'skill3' | 'trace' | 'weaponLevel'
type Metrics = Partial<Record<MetricKey, number | null>>

interface CharacterSnapshot {
  id: string
  name: string
  icon?: string
  manual?: boolean
  metrics: Metrics
  weaponName?: string
  weaponRank?: number | null
  gear: string[]
}
interface AccountSnapshot {
  playerName?: string
  playerLevel?: number | null
  worldLevel?: number | null
  characters: CharacterSnapshot[]
}
interface SavedAccount {
  uid: string
  alias?: string
  playerName?: string
  playerLevel?: number | null
  worldLevel?: number | null
  fetchedAt?: string
  cacheUntil?: number
  retryAfter?: number
  showcaseKnown?: boolean
  snapshot?: AccountSnapshot
  lastError?: string
}
interface CharacterCustom {
  uid: string
  id: string
  name: string
  icon?: string
  manual: boolean
  current: Metrics
  goals: Metrics
  weaponName?: string
  weaponRank?: number | null
  gear?: string[]
}
interface RecordsFile {
  version: number
  selectedUid: string
  accounts: SavedAccount[]
  customs: CharacterCustom[]
}
interface MetricDefinition { key: MetricKey; label: string; max: number }
interface Catalogs {
  characters: Record<string, any>
  equipment: Record<string, any>
  relics: Record<string, any>
  relicSets: Record<string, any>
  relicMainAffixes: Record<string, any>
  relicSubAffixes: Record<string, any>
  loc: Record<string, any>
}

const props = defineProps<{ game: Game; storageId: string }>()
const game = props.game
const gameTitle = game === 'genshin' ? '原神' : '星穹铁道'
const metricDefinitions = computed<MetricDefinition[]>(() => [
  { key: 'level', label: '角色等级', max: game === 'genshin' ? 90 : 80 },
  { key: 'rank', label: game === 'genshin' ? '命之座' : '星魂', max: 6 },
  ...(game === 'genshin'
    ? [
        { key: 'skill1' as const, label: '普通攻击天赋', max: 15 },
        { key: 'skill2' as const, label: '元素战技天赋', max: 15 },
        { key: 'skill3' as const, label: '元素爆发天赋', max: 15 },
      ]
    : [{ key: 'trace' as const, label: '已解锁行迹节点', max: 100 }]),
  { key: 'weaponLevel', label: game === 'genshin' ? '武器等级' : '光锥等级', max: game === 'genshin' ? 90 : 80 },
])

const emptyRecords = (): RecordsFile => ({ version: 1, selectedUid: '', accounts: [], customs: [] })
const records = ref<RecordsFile>(emptyRecords())
const ready = ref(false)
const loadError = ref('')
const saveError = ref('')
const requestMessage = ref('')
const requestIsError = ref(false)
const fetching = ref(false)
const addingAccount = ref(false)
const newUid = ref('')
const newAlias = ref('')
const selectedCharacterId = ref('')
const editorVisible = ref(false)
const editingId = ref('')
const editName = ref('')
const editId = ref('')
const editWeaponName = ref('')
const editWeaponRank = ref<number | null>(null)
const editGear = ref('')
const editCurrent = reactive<Metrics>({})
const editGoals = reactive<Metrics>({})
const editCurrentBaseline = reactive<Metrics>({})
const cooldownNow = ref(Date.now())
let cooldownTimer: ReturnType<typeof setInterval> | undefined
let messageTimer: ReturnType<typeof setTimeout> | undefined

const activeAccount = computed(() => records.value.accounts.find(account => account.uid === records.value.selectedUid) || null)
const cooldownSeconds = computed(() => {
  const account = activeAccount.value
  if (!account) return 0
  const until = Math.max(account.cacheUntil || 0, account.retryAfter || 0)
  return Math.max(0, Math.ceil((until - cooldownNow.value) / 1000))
})

const accountCustoms = computed(() => records.value.customs.filter(item => item.uid === records.value.selectedUid))
const allCharacters = computed<CharacterSnapshot[]>(() => {
  const account = activeAccount.value
  if (!account) return []
  const showcase = (game === 'star-rail' ? account.snapshot?.characters || [] : []).map(character => {
    const custom = records.value.customs.find(item => item.uid === account.uid && item.id === character.id)
    return custom?.name ? { ...character, name: custom.name } : character
  })
  const manual = accountCustoms.value.filter(item => item.manual).map(item => ({
    id: item.id,
    name: item.name,
    icon: game === 'genshin' ? (findGenshinAvatarIcon(item.id, item.name) || item.icon) : item.icon,
    manual: true,
    metrics: item.current || {},
    weaponName: item.weaponName,
    weaponRank: item.weaponRank,
    gear: Array.isArray(item.gear) ? item.gear : [],
  } satisfies CharacterSnapshot))
  const ids = new Set(showcase.map(character => character.id))
  return [...showcase, ...manual.filter(character => !ids.has(character.id))]
})

const selectedCharacter = computed(() => allCharacters.value.find(character => character.id === selectedCharacterId.value) || allCharacters.value[0] || null)
const selectedCustom = computed(() => {
  const character = selectedCharacter.value
  if (!character || !activeAccount.value) return null
  return records.value.customs.find(item => item.uid === activeAccount.value?.uid && item.id === character.id) || null
})

const selectedProgress = computed(() => {
  const targets = metricDefinitions.value.map(metric => ({ current: currentMetric(metric.key), goal: goalMetric(metric.key) })).filter(item => item.goal !== null && item.goal !== undefined)
  const done = targets.filter(item => item.current !== null && item.current !== undefined && item.current >= (item.goal as number)).length
  return { total: targets.length, done, percent: targets.length ? Math.round(done / targets.length * 100) : 0 }
})

const catalogs: Catalogs = { characters: {}, equipment: {}, relics: {}, relicSets: {}, relicMainAffixes: {}, relicSubAffixes: {}, loc: {} }
const catalogsLoaded = ref(false)
const genshinAvatarCatalogLoaded = ref(false)
const genshinAvatarCatalogLoading = ref(false)
const genshinAvatarCatalogError = ref('')
const brokenAvatarUrls = ref(new Set<string>())
let catalogPromise: Promise<void> | null = null
let genshinAvatarCatalogPromise: Promise<void> | null = null
const genshinAvatarIconsById = new Map<string, string>()
const genshinAvatarIconsByName = new Map<string, string>()

function isUidValid(uid: string) { return /^\d{9}$/.test(uid.trim()) }
function accountLabel(account: SavedAccount) {
  const label = account.alias || account.playerName
  return label && label !== account.uid ? `${label} · ${account.uid}` : account.uid
}
function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes ? `${minutes}分${String(rest).padStart(2, '0')}秒` : `${rest}秒`
}
function formatMetric(value: number | null | undefined) { return value === null || value === undefined ? '待补充' : String(value) }
function markAvatarBroken(url: string) {
  if (brokenAvatarUrls.value.has(url)) return
  brokenAvatarUrls.value = new Set([...brokenAvatarUrls.value, url])
}
function normalizeGenshinCharacterName(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s·・,，.。'’"“”()（）【】_\-]/g, '')
}
function findGenshinAvatarIcon(id: string, name: string) {
  // Reading the ref makes the roster computed refresh after the remote index is loaded.
  void genshinAvatarCatalogLoaded.value
  const byId = genshinAvatarIconsById.get(String(id || '').trim())
  if (byId) return byId
  return genshinAvatarIconsByName.get(normalizeGenshinCharacterName(name)) || ''
}
function metricCurrentFromCharacter(character: CharacterSnapshot, key: MetricKey) {
  const custom = records.value.customs.find(item => item.uid === records.value.selectedUid && item.id === character.id)
  if (custom && Object.prototype.hasOwnProperty.call(custom.current, key)) return custom.current[key] ?? null
  return character.metrics[key] ?? null
}
function currentMetric(key: MetricKey) {
  const character = selectedCharacter.value
  return character ? metricCurrentFromCharacter(character, key) : null
}
function goalMetric(key: MetricKey) {
  return selectedCustom.value?.goals[key] ?? null
}
function metricStateClass(key: MetricKey) {
  const current = currentMetric(key)
  const goal = goalMetric(key)
  if (goal === null || goal === undefined) return 'state-none'
  if (current === null || current === undefined) return 'state-missing'
  return current >= goal ? 'state-done' : 'state-pending'
}
function metricStateText(key: MetricKey) {
  const current = currentMetric(key)
  const goal = goalMetric(key)
  if (goal === null || goal === undefined) return current === null || current === undefined ? '当前值待补充' : '未设置目标'
  if (current === null || current === undefined) return '当前值待补充'
  return current >= goal ? '已达成' : `还差 ${goal - current}`
}

async function persist() {
  saveError.value = ''
  const ok = await setData(props.storageId, 'records', records.value)
  if (!ok) saveError.value = '本机记录保存失败。请确认已登录到本地用户，并检查应用数据目录权限。'
}

function setNotice(message: string, isError = false) {
  requestMessage.value = message
  requestIsError.value = isError
  if (messageTimer) clearTimeout(messageTimer)
  if (!isError) messageTimer = setTimeout(() => { requestMessage.value = '' }, 8500)
}

function firstCharacterIdForAccount(account: SavedAccount | null | undefined) {
  if (!account) return ''
  if (game === 'star-rail') return account.snapshot?.characters[0]?.id || ''
  return records.value.customs.find(item => item.uid === account.uid)?.id || ''
}

function migrateGenshinRecordsToManual() {
  let changed = false
  for (const account of records.value.accounts) {
    for (const custom of records.value.customs.filter(item => item.uid === account.uid)) {
      custom.current ||= {}
      custom.goals ||= {}
      if (!custom.manual) {
        custom.manual = true
        changed = true
      }
    }
    for (const character of account.snapshot?.characters || []) {
      let custom = records.value.customs.find(item => item.uid === account.uid && item.id === character.id)
      if (!custom) {
        custom = { uid: account.uid, id: character.id, name: character.name, manual: true, current: {}, goals: {} }
        records.value.customs.push(custom)
      }
      custom.name ||= character.name
      custom.icon ||= character.icon
      custom.manual = true
      custom.current ||= {}
      for (const [key, value] of Object.entries(character.metrics || {})) {
        if (!Object.prototype.hasOwnProperty.call(custom.current, key)) custom.current[key as MetricKey] = value
      }
      custom.weaponName ||= character.weaponName
      if (custom.weaponRank === null || custom.weaponRank === undefined) custom.weaponRank = character.weaponRank
      if (!custom.gear?.length) custom.gear = Array.isArray(character.gear) ? [...character.gear] : []
      changed = true
    }
    if (account.playerName && !account.alias) {
      account.alias = account.playerName
      changed = true
    }
    if (account.snapshot || account.playerName || account.fetchedAt || account.cacheUntil || account.retryAfter || account.showcaseKnown || account.lastError) {
      delete account.snapshot
      delete account.playerName
      delete account.fetchedAt
      delete account.cacheUntil
      delete account.retryAfter
      delete account.showcaseKnown
      delete account.lastError
      changed = true
    }
  }
  return changed
}

async function loadRecords() {
  let migratedGenshinRecords = false
  try {
    const saved = await getData<RecordsFile>(props.storageId, 'records')
    if (saved && typeof saved === 'object') {
      const accountFields = new Set(['uid', 'alias', 'playerName', 'playerLevel', 'worldLevel', 'fetchedAt', 'cacheUntil', 'retryAfter', 'showcaseKnown', 'snapshot', 'lastError'])
      records.value = {
        version: 1,
        selectedUid: typeof saved.selectedUid === 'string' ? saved.selectedUid : '',
        accounts: Array.isArray(saved.accounts) ? saved.accounts.filter(item => item && /^\d{9}$/.test(String(item.uid || ''))).map(item => {
          const account = Object.fromEntries(Object.entries(item).filter(([key]) => accountFields.has(key))) as unknown as SavedAccount
          if (Object.keys(item).some(key => !accountFields.has(key))) {
            account.cacheUntil = 0
            account.retryAfter = 0
            account.lastError = ''
          }
          return account
        }) : [],
        customs: Array.isArray(saved.customs) ? saved.customs.filter(item => item && typeof item.uid === 'string' && typeof item.id === 'string') : [],
      }
      if (!records.value.accounts.some(account => account.uid === records.value.selectedUid)) records.value.selectedUid = records.value.accounts[0]?.uid || ''
      if (game === 'genshin') migratedGenshinRecords = migrateGenshinRecordsToManual()
      if (migratedGenshinRecords) await persist()
    }
  } catch {
    loadError.value = '读取本机角色记录失败。'
  } finally {
    ready.value = true
    if (records.value.selectedUid) {
      const account = activeAccount.value
      selectedCharacterId.value = firstCharacterIdForAccount(account)
      if (game === 'star-rail' && account && (!account.snapshot || (account.cacheUntil || 0) <= Date.now()) && !(account.retryAfter && account.retryAfter > Date.now())) void fetchShowcase(account)
    }
  }
}

async function selectAccount(uid: string) {
  records.value.selectedUid = uid
  const account = activeAccount.value
  selectedCharacterId.value = firstCharacterIdForAccount(account)
  requestMessage.value = ''
  await persist()
  if (game === 'star-rail' && account && (!account.snapshot || (account.cacheUntil || 0) <= Date.now()) && !(account.retryAfter && account.retryAfter > Date.now())) void fetchShowcase(account)
}

async function addAccount() {
  const uid = newUid.value.trim()
  if (!isUidValid(uid) || addingAccount.value) return
  addingAccount.value = true
  try {
    let account = records.value.accounts.find(item => item.uid === uid)
    if (!account) {
      account = { uid, alias: newAlias.value.trim() || undefined }
      records.value.accounts.push(account)
    } else if (newAlias.value.trim()) {
      account.alias = newAlias.value.trim()
    }
    records.value.selectedUid = uid
    selectedCharacterId.value = firstCharacterIdForAccount(account)
    newUid.value = ''
    newAlias.value = ''
    await persist()
    if (game === 'star-rail') await fetchShowcase(account)
  } finally {
    addingAccount.value = false
  }
}

async function deleteAccount() {
  const account = activeAccount.value
  if (!account) return
  const label = accountLabel(account)
  if (!window.confirm(`删除 ${label} 及该 UID 下的手动补充和目标记录？`)) return
  records.value.accounts = records.value.accounts.filter(item => item.uid !== account.uid)
  records.value.customs = records.value.customs.filter(item => item.uid !== account.uid)
  records.value.selectedUid = records.value.accounts[0]?.uid || ''
  selectedCharacterId.value = firstCharacterIdForAccount(records.value.accounts[0])
  requestMessage.value = ''
  await persist()
}

async function fetchText(url: string): Promise<{ status: number; text: string; error?: string }> {
  const api = (window as any).electronAPI
  if (api?.httpGetText) return await api.httpGetText(url)
  try {
    const response = await fetch(url, { cache: 'force-cache' })
    return { status: response.status, text: await response.text() }
  } catch (error) {
    return { status: 0, text: '', error: error instanceof Error ? error.message : String(error) }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback()), timeoutMs) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function fetchJson(url: string) {
  const response = await withTimeout(fetchText(url), 9000, () => ({ status: 0, text: '', error: '请求超时' }))
  if (response.status < 200 || response.status >= 300) throw new Error(response.error || `HTTP ${response.status}`)
  return JSON.parse(response.text)
}

async function loadCatalogs() {
  if (catalogsLoaded.value) return
  if (catalogPromise) return catalogPromise
  catalogPromise = (async () => {
    const requests = [
      ['characters', 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/characters.json'],
      ['equipment', 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/light_cones.json'],
      ['relics', 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/relics.json'],
      ['relicSets', 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/relic_sets.json'],
      ['relicMainAffixes', 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/relic_main_affixes.json'],
      ['relicSubAffixes', 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/cn/relic_sub_affixes.json'],
    ] as const
    await Promise.all(requests.map(async ([key, url]) => {
      try { (catalogs as any)[key] = await fetchJson(url) } catch { /* 在线目录不是展柜数据的前置条件 */ }
    }))
    catalogsLoaded.value = true
  })().finally(() => { catalogPromise = null })
  return catalogPromise
}

async function loadGenshinAvatarCatalog() {
  if (game !== 'genshin' || genshinAvatarCatalogLoaded.value) return
  if (genshinAvatarCatalogPromise) return genshinAvatarCatalogPromise
  genshinAvatarCatalogLoading.value = true
  genshinAvatarCatalogError.value = ''
  genshinAvatarCatalogPromise = (async () => {
    try {
      const [characters, localizations] = await Promise.all([
        fetchJson('https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json'),
        fetchJson('https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/loc.json').catch(() => null),
      ])
      if (!characters || typeof characters !== 'object' || !Object.keys(characters).length) {
        throw new Error('角色图鉴数据为空')
      }

      const locales = localizations && typeof localizations === 'object' ? Object.values(localizations) : []
      for (const [id, entry] of Object.entries(characters as Record<string, any>)) {
        if (!entry || typeof entry !== 'object') continue
        const iconName = String(entry.SideIconName || entry.sideIconName || '').trim()
        if (!iconName) continue
        const iconUrl = `https://enka.network/ui/${encodeURIComponent(iconName)}.png`
        genshinAvatarIconsById.set(String(id), iconUrl)

        const nameHash = String(entry.NameTextMapHash ?? entry.nameTextMapHash ?? '')
        if (!nameHash) continue
        for (const locale of locales) {
          if (!locale || typeof locale !== 'object') continue
          const localizedName = (locale as Record<string, unknown>)[nameHash]
          const normalizedName = normalizeGenshinCharacterName(localizedName)
          if (normalizedName && !genshinAvatarIconsByName.has(normalizedName)) {
            genshinAvatarIconsByName.set(normalizedName, iconUrl)
          }
        }
      }

      if (!genshinAvatarIconsById.size) throw new Error('角色头像索引为空')
      genshinAvatarCatalogLoaded.value = true
    } catch (error) {
      genshinAvatarCatalogError.value = '在线头像图鉴加载失败，可点击重试'
      console.warn('[原神角色养成] 头像图鉴加载失败', error)
    } finally {
      genshinAvatarCatalogLoading.value = false
      genshinAvatarCatalogPromise = null
    }
  })()
  return genshinAvatarCatalogPromise
}

function localize(hashOrText: any) {
  if (hashOrText === null || hashOrText === undefined) return ''
  if (typeof hashOrText === 'object') {
    const value = hashOrText['zh-cn'] ?? hashOrText['zh-CN'] ?? hashOrText.name ?? hashOrText.value ?? hashOrText.en
    if (value !== undefined && value !== hashOrText) return localize(value)
  }
  const text = String(hashOrText)
  return catalogs.loc?.[text] ? String(catalogs.loc[text]) : text
}

function numberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object') value = value.val ?? value.value ?? value.level ?? value.count
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function hsrName(id: string) {
  const detail = catalogs.characters?.[id]
  return detail?.name || detail?.Name || `角色 ${id}`
}

function hsrIcon(id: string) {
  const icon = catalogs.characters?.[id]?.icon
  return icon ? `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${icon}` : ''
}

function hsrPropertyName(value: any) {
  const property = String(value ?? '')
  const names: Record<string, string> = {
    HPDelta: '生命值', AttackDelta: '攻击力', DefenceDelta: '防御力',
    HPAddedRatio: '生命值百分比', AttackAddedRatio: '攻击力百分比', DefenceAddedRatio: '防御力百分比',
    SpeedDelta: '速度', CriticalChanceBase: '暴击率', CriticalDamageBase: '暴击伤害',
    StatusProbabilityBase: '效果命中', StatusResistanceBase: '效果抵抗', BreakDamageAddedRatioBase: '击破特攻',
    SPRatioBase: '能量恢复效率', HealRatioBase: '治疗量加成', PhysicalAddedRatio: '物理伤害加成',
    FireAddedRatio: '火属性伤害加成', IceAddedRatio: '冰属性伤害加成', ThunderAddedRatio: '雷属性伤害加成',
    WindAddedRatio: '风属性伤害加成', QuantumAddedRatio: '量子属性伤害加成', ImaginaryAddedRatio: '虚数属性伤害加成',
  }
  return names[property] || property
}

function normaliseStarRail(payload: any): AccountSnapshot {
  const detail = payload?.detailInfo || payload?.detail_info || {}
  const avatars = Array.isArray(detail?.avatarDetailList) ? detail.avatarDetailList : Array.isArray(payload?.avatarDetailList) ? payload.avatarDetailList : []
  const characters: CharacterSnapshot[] = avatars.map((avatar: any, index: number) => {
    const id = String(avatar?.avatarId ?? avatar?.avatarID ?? `unknown-${index}`)
    const skillTrees = Array.isArray(avatar?.skillTreeList) ? avatar.skillTreeList : []
    const unlockedTraces = skillTrees.filter((item: any) => Number(item?.level ?? item?.currentLevel ?? 0) > 0).length
    const equipment = avatar?.equipment || avatar?.lightCone || {}
    const equipmentFlat = equipment?._flat || equipment?.flat || {}
    const lightConeName = localize(equipmentFlat?.name || equipment?.name || '')
    const relics = Array.isArray(avatar?.relicList) ? avatar.relicList : []
    const gear = relics.map((relic: any) => {
      const relicFlat = relic?._flat || relic?.flat || {}
      const relicInfo = catalogs.relics?.[String(relic?.tid ?? relic?.id ?? '')]
      const setInfo = catalogs.relicSets?.[String(relicInfo?.set_id ?? relic?.setId ?? '')]
      const name = relicInfo?.name || localize(relicFlat?.name || relic?.name || '')
      const setName = setInfo?.name || localize(relicFlat?.setName || relic?.setName || '')
      const level = numberOrNull(relic?.level)
      const rarity = String(relicInfo?.rarity ?? '')
      const mainDefinition = catalogs.relicMainAffixes?.[String(relic?.mainAffixId ?? '')]?.affixes?.[rarity]
      const mainName = relic?.mainAffix?.name || relic?.mainAffix?.propertyName || relic?.mainAffix?.type || mainDefinition?.property || relic?.mainAffixId
      const mainValue = relic?.mainAffix?.display ?? relic?.mainAffix?.value
      const subAffixes = (Array.isArray(relic?.subAffixList) ? relic.subAffixList : []).slice(0, 3).map((affix: any) => {
        const subDefinition = catalogs.relicSubAffixes?.[rarity]?.affixes?.[String(affix?.affixId ?? '')]
        const affixName = affix?.name || affix?.propertyName || affix?.type || subDefinition?.property || affix?.affixId
        const value = affix?.display ?? affix?.value
        const count = numberOrNull(affix?.cnt)
        const valueText = value !== undefined ? ` ${value}` : count !== null ? ` ×${count}` : ''
        return affixName ? `${hsrPropertyName(localize(affixName))}${valueText}` : ''
      }).filter(Boolean)
      return [setName, name || '遗器', level !== null ? `+${level}` : '', mainName ? `${hsrPropertyName(localize(mainName))}${mainValue !== undefined ? ` ${mainValue}` : ''}` : '', ...subAffixes].filter(Boolean).join(' · ')
    })
    return {
      id,
      name: hsrName(id),
      icon: hsrIcon(id),
      metrics: {
        level: numberOrNull(avatar?.level),
        rank: numberOrNull(avatar?.rank),
        trace: unlockedTraces,
        weaponLevel: numberOrNull(equipment?.level),
      },
      weaponName: lightConeName && lightConeName !== '[object Object]' ? lightConeName : (equipment?.tid ? (catalogs.equipment?.[String(equipment.tid)]?.name || '') : ''),
      weaponRank: numberOrNull(equipment?.rank),
      gear,
    }
  })
  return {
    playerName: typeof detail.nickname === 'string' ? detail.nickname : undefined,
    playerLevel: numberOrNull(detail.level),
    worldLevel: numberOrNull(detail.worldLevel),
    characters,
  }
}

function mapApiError(status: number, rawMessage = '') {
  if (status === 400) return 'UID 格式无效，请检查是否为 9 位数字。'
  if (status === 404) return '没有找到这个 UID 对应的游戏账号。'
  if (status === 424) return '游戏服务正在维护或更新，请稍后再试。'
  if (status === 429) return '请求过于频繁，接口已限流。请等待冷却结束后再刷新。'
  if (status === 500 || status === 503) return 'Enka.Network 服务暂时不可用，请稍后重试。'
  if (status === 0) return `网络请求失败：${rawMessage || '请检查网络连接后重试。'}`
  return rawMessage || `展柜读取失败（HTTP ${status}）。`
}

async function fetchShowcase(account: SavedAccount) {
  if (game !== 'star-rail') return
  if (fetching.value) return
  if (!isUidValid(account.uid)) {
    setNotice('UID 格式无效，请输入 9 位数字。', true)
    return
  }
  const waitUntil = Math.max(account.cacheUntil || 0, account.retryAfter || 0)
  if (waitUntil > Date.now()) {
    cooldownNow.value = Date.now()
    setNotice(`接口缓存尚未过期，请在 ${formatDuration(Math.ceil((waitUntil - Date.now()) / 1000))} 后刷新。`, true)
    return
  }
  fetching.value = true
  requestMessage.value = ''
  try {
    const url = `https://enka.network/api/hsr/uid/${encodeURIComponent(account.uid)}`
    const response = await withTimeout(fetchText(url), 25000, () => ({ status: 0, text: '', error: '请求超过 25 秒未完成' }))
    if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(mapApiError(response.status, response.error)), { status: response.status })
    const payload = JSON.parse(response.text)
    if (payload?.retcode && Number(payload.retcode) !== 0) {
      const status = Number(payload.retcode) === -1 ? 404 : 500
      throw Object.assign(new Error(mapApiError(status, payload.message || payload.msg || '')), { status })
    }
    await loadCatalogs()
    const snapshot = normaliseStarRail(payload)
    if (!payload?.detailInfo) throw new Error('返回数据缺少 detailInfo，星铁接口响应结构可能已变化。')
    if (!snapshot.characters.length) throw new Error('展柜未公开或尚未设置展示角色。')
    account.playerName = snapshot.playerName || account.playerName
    account.playerLevel = snapshot.playerLevel
    account.worldLevel = snapshot.worldLevel
    account.snapshot = snapshot
    account.showcaseKnown = true
    account.fetchedAt = new Date().toISOString()
    account.lastError = ''
    account.retryAfter = 0
    const ttl = numberOrNull(payload?.ttl)
    account.cacheUntil = Date.now() + Math.max(0, ttl === null ? 300 : ttl) * 1000
    const stillPresent = snapshot.characters.some(character => character.id === selectedCharacterId.value)
    if (!stillPresent) selectedCharacterId.value = snapshot.characters[0]?.id || ''
    await persist()
    setNotice(`已更新 ${snapshot.characters.length} 名公开展柜角色。`)
  } catch (error: any) {
    const status = Number(error?.status || 0)
    const message = error instanceof SyntaxError
      ? '接口返回了无法识别的数据格式，可能正在维护或已调整响应结构。'
      : (error instanceof Error ? error.message : '展柜读取失败。')
    account.lastError = message || mapApiError(status)
    account.retryAfter = Date.now() + (status === 429 ? 60_000 : 30_000)
    await persist()
    setNotice(`${account.lastError}${account.snapshot ? ' 已保留上次成功读取的数据。' : ''}`, true)
  } finally {
    fetching.value = false
    cooldownNow.value = Date.now()
  }
}

async function refreshShowcase() {
  if (activeAccount.value) await fetchShowcase(activeAccount.value)
}

function startNewCharacter() {
  if (!activeAccount.value) return
  editingId.value = ''
  editName.value = ''
  editId.value = ''
  editWeaponName.value = ''
  editWeaponRank.value = null
  editGear.value = ''
  clearEditValues()
  for (const key of Object.keys(editCurrentBaseline) as MetricKey[]) delete editCurrentBaseline[key]
  editorVisible.value = true
}

function editCharacter(character: CharacterSnapshot) {
  editingId.value = character.id
  editName.value = character.name
  editId.value = character.id
  clearEditValues()
  editWeaponName.value = character.weaponName || ''
  editWeaponRank.value = character.weaponRank ?? null
  editGear.value = (character.gear || []).join('\n')
  for (const metric of metricDefinitions.value) {
    editCurrent[metric.key] = currentMetric(metric.key)
    editCurrentBaseline[metric.key] = currentMetric(metric.key)
    editGoals[metric.key] = goalMetric(metric.key)
  }
  editorVisible.value = true
}

function clearEditValues() {
  for (const metric of metricDefinitions.value) {
    editCurrent[metric.key] = null
    delete editCurrentBaseline[metric.key]
    editGoals[metric.key] = null
  }
  editWeaponName.value = ''
  editWeaponRank.value = null
  editGear.value = ''
}

async function saveCharacterEdit() {
  const account = activeAccount.value
  const name = editName.value.trim()
  if (!account || !name) return
  const isManual = !editingId.value
  const id = editingId.value || editId.value.trim() || `manual-${Date.now().toString(36)}`
  let custom = records.value.customs.find(item => item.uid === account.uid && item.id === id)
  if (!custom) {
    custom = { uid: account.uid, id, name, manual: isManual, current: {}, goals: {} }
    records.value.customs.push(custom)
  }
  custom.name = name
  custom.manual = isManual || custom.manual
  for (const metric of metricDefinitions.value) {
    const current = numberOrNull(editCurrent[metric.key])
    const goal = numberOrNull(editGoals[metric.key])
    const hadManualCurrent = Object.prototype.hasOwnProperty.call(custom.current, metric.key)
    const baseline = editCurrentBaseline[metric.key] ?? null
    if (current === null || (!isManual && !hadManualCurrent && current === baseline)) delete custom.current[metric.key]
    else custom.current[metric.key] = current
    if (goal === null) delete custom.goals[metric.key]
    else custom.goals[metric.key] = goal
  }
  if (game === 'genshin') {
    custom.weaponName = editWeaponName.value.trim() || undefined
    custom.weaponRank = numberOrNull(editWeaponRank.value)
    custom.gear = editGear.value.split(/\r?\n/).map(piece => piece.trim()).filter(Boolean)
  }
  selectedCharacterId.value = id
  editorVisible.value = false
  await persist()
}

onMounted(async () => {
  cooldownTimer = setInterval(() => { cooldownNow.value = Date.now() }, 1000)
  await loadRecords()
  if (game === 'genshin') void loadGenshinAvatarCatalog()
})

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
  if (messageTimer) clearTimeout(messageTimer)
})
</script>

<style scoped>
.growth-panel {
  --growth-accent: var(--chalk-primary, #8b7cff);
  --growth-text: var(--chalk-white, #eef0ff);
  --growth-muted: var(--chalk-white-60, #9ba0bd);
  --growth-line: rgba(157, 164, 210, .18);
  --growth-surface: rgba(255, 255, 255, .035);
  color: var(--growth-text);
  padding: 8px 4px 16px;
}
.account-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 12px; border: 1px solid var(--growth-line); border-radius: 12px; background: var(--growth-surface); }
.account-select { width: 260px; max-width: 100%; }
.uid-input { width: 150px; }
.alias-input { width: 165px; }
.delete-account { margin-left: auto; color: #ed9b9b; }
.notice { margin: 10px 0; padding: 9px 12px; border: 1px solid var(--growth-line); border-radius: 9px; font-size: 12px; }
.notice-info { color: #a9c7ff; background: rgba(102, 153, 255, .08); }
.notice-error { color: #ffb7b7; border-color: rgba(240, 112, 112, .3); background: rgba(220, 75, 75, .08); }
.notice-tail { margin-left: 4px; color: var(--growth-muted); }
.player-card { display: flex; align-items: center; gap: 12px; margin: 14px 0; padding: 14px; border: 1px solid var(--growth-line); border-radius: 13px; background: linear-gradient(110deg, color-mix(in srgb, var(--growth-accent) 12%, transparent), var(--growth-surface) 62%); }
.player-avatar { display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 42px; border: 1px solid color-mix(in srgb, var(--growth-accent) 48%, transparent); border-radius: 13px; color: #e5e1ff; font-size: 18px; font-weight: 700; background: color-mix(in srgb, var(--growth-accent) 20%, transparent); }
.avatar-genshin { border-radius: 50%; color: #ffe8bd; }
.player-copy { min-width: 0; flex: 1; }
.player-title { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
.player-title strong { font-size: 15px; }
.uid-chip { padding: 2px 7px; border: 1px solid var(--growth-line); border-radius: 999px; color: var(--growth-muted); font-size: 10px; }
.player-meta { display: flex; flex-wrap: wrap; gap: 6px 13px; margin-top: 5px; color: var(--growth-muted); font-size: 11px; }
.player-actions { display: flex; gap: 7px; }
.character-workspace { display: grid; grid-template-columns: minmax(190px, 250px) minmax(0, 1fr); gap: 14px; align-items: start; }
.character-workspace-genshin { grid-template-columns: minmax(0, 1fr); gap: 14px; }
.character-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; max-height: 660px; overflow: auto; padding: 2px; }
.character-list-genshin { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; max-height: none; overflow: visible; padding: 0; }
.roster-heading { display: flex; grid-column: 1 / -1; align-items: center; justify-content: space-between; gap: 12px; padding: 2px 2px 4px; }
.roster-heading h3 { margin: 0; color: var(--growth-text); font-size: 15px; }
.roster-heading span { display: block; margin-top: 4px; color: var(--growth-muted); font-size: 11px; }
.roster-heading small { flex: 0 0 auto; color: var(--growth-muted); font-size: 11px; }
.roster-heading-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
.character-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: 9px 6px 7px; border: 1px solid var(--growth-line); border-radius: 11px; color: var(--growth-text); background: var(--growth-surface); cursor: pointer; transition: border-color .15s ease, transform .15s ease, background .15s ease; }
.character-tile-genshin { gap: 8px; padding: 12px 8px 10px; border-radius: 14px; background: linear-gradient(155deg, color-mix(in srgb, var(--growth-accent) 10%, var(--growth-surface)), var(--growth-surface)); }
.character-tile:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--growth-accent) 65%, transparent); }
.character-tile.active { border-color: var(--growth-accent); background: color-mix(in srgb, var(--growth-accent) 16%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--growth-accent) 20%, transparent); }
.character-tile.manual::after { position: absolute; top: 5px; right: 6px; width: 6px; height: 6px; border-radius: 50%; content: ''; background: #d7bcff; }
.character-tile img, .character-initial { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: color-mix(in srgb, var(--growth-accent) 17%, #272544); }
.character-tile-genshin img, .character-tile-genshin .character-initial { width: 84px; height: 84px; border-radius: 18px; }
.character-initial[hidden] { display: none !important; }
.character-initial { color: var(--growth-accent); font-size: 19px; font-weight: 700; }
.character-tile-name { width: 100%; overflow: hidden; color: var(--growth-muted); font-size: 10px; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.character-tile-genshin .character-tile-name { color: var(--growth-text); font-size: 12px; font-weight: 600; }
.character-tile-level { position: absolute; top: 8px; left: 7px; padding: 1px 4px; border-radius: 5px; color: #fff; font-size: 9px; background: rgba(18, 18, 35, .72); }
.character-detail { min-width: 0; padding: 16px; border: 1px solid var(--growth-line); border-radius: 13px; background: var(--growth-surface); }
.detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.eyebrow { margin-bottom: 4px; color: var(--growth-accent); font-size: 10px; }
.detail-heading h3 { display: inline-block; margin: 0; font-size: 19px; }
.character-id { margin-left: 8px; color: var(--growth-muted); font-size: 10px; }
.progress-card { margin: 8px 0 12px; padding: 11px 12px; border: 1px solid var(--growth-line); border-radius: 10px; background: rgba(0, 0, 0, .08); }
.progress-header { display: flex; justify-content: space-between; gap: 10px; color: var(--growth-muted); font-size: 11px; }
.progress-header strong { color: var(--growth-text); font-size: 11px; }
.progress-track { height: 6px; margin-top: 9px; overflow: hidden; border-radius: 999px; background: rgba(160, 165, 195, .18); }
.progress-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--growth-accent), #9be4dd); transition: width .2s ease; }
.progress-hint { margin-top: 6px; color: var(--growth-muted); font-size: 10px; }
.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(116px, 1fr)); gap: 8px; }
.metric-card { display: flex; flex-direction: column; gap: 5px; min-width: 0; padding: 10px; border: 1px solid var(--growth-line); border-radius: 9px; background: rgba(255, 255, 255, .025); }
.metric-card > span:first-child { color: var(--growth-muted); font-size: 10px; }
.metric-card strong { overflow: hidden; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.metric-card strong small { color: var(--growth-muted); font-size: 11px; font-weight: 500; }
.metric-foot { font-size: 9px; }
.state-done { color: #8ad8aa; }.state-pending { color: #eecb82; }.state-missing, .state-none { color: var(--growth-muted); }
.equipment-section { margin-top: 16px; }
.equipment-section h4 { margin: 0 0 9px; color: var(--growth-muted); font-size: 12px; font-weight: 600; }
.weapon-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid var(--growth-line); border-radius: 9px; background: rgba(255, 255, 255, .025); }
.equipment-symbol { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; color: var(--growth-accent); background: color-mix(in srgb, var(--growth-accent) 13%, transparent); }
.weapon-row > div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.weapon-row strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.weapon-row span:not(.equipment-symbol) { color: var(--growth-muted); font-size: 10px; }
.gear-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.gear-chip { max-width: 100%; padding: 5px 8px; overflow: hidden; border: 1px solid var(--growth-line); border-radius: 7px; color: var(--growth-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.detail-footnote { margin-top: 11px; color: var(--growth-muted); font-size: 10px; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 210px; margin-top: 14px; padding: 22px; border: 1px dashed var(--growth-line); border-radius: 13px; color: var(--growth-muted); text-align: center; background: var(--growth-surface); }
.empty-state strong { margin-top: 6px; color: var(--growth-text); font-size: 14px; }
.empty-state p { max-width: 430px; margin: 7px 0 0; font-size: 11px; line-height: 1.6; }
.empty-symbol { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; color: var(--growth-accent); font-size: 20px; background: color-mix(in srgb, var(--growth-accent) 12%, transparent); }
.empty-actions { display: flex; gap: 8px; margin-top: 14px; }
.loading-state { flex-direction: row; gap: 8px; min-height: 130px; }
.editor-body { display: flex; flex-direction: column; gap: 12px; }
.form-field { display: grid; grid-template-columns: 140px minmax(0, 1fr); align-items: center; gap: 10px; color: var(--growth-muted); font-size: 12px; }
.form-field :deep(.el-input-number) { width: 100%; }
.form-field-top { align-items: start; }
.editor-table-head, .editor-metric-row { display: grid; grid-template-columns: minmax(145px, 1fr) minmax(130px, .8fr) minmax(130px, .8fr); align-items: center; gap: 10px; }
.editor-table-head { color: var(--growth-muted); font-size: 10px; }
.editor-metric-row { padding: 7px 0; border-top: 1px solid var(--growth-line); }
.editor-metric-row label { font-size: 11px; }
.editor-metric-row :deep(.el-input-number) { width: 100%; }
.editor-tip { margin: 0; color: var(--growth-muted); font-size: 10px; line-height: 1.6; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 720px) {
  .character-workspace { grid-template-columns: minmax(0, 1fr); }
  .character-list { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); max-height: 230px; }
  .character-list-genshin { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); max-height: none; }
  .account-select { flex: 1 1 100%; width: auto; }
  .player-card { align-items: flex-start; flex-wrap: wrap; }
  .player-actions { width: 100%; margin-left: 54px; }
}
@media (max-width: 520px) {
  .growth-panel { padding-inline: 0; }
  .uid-input, .alias-input { flex: 1 1 130px; width: auto; }
  .delete-account { margin-left: 0; }
  .character-detail { padding: 12px; }
  .editor-table-head, .editor-metric-row { grid-template-columns: minmax(94px, .8fr) minmax(95px, 1fr) minmax(95px, 1fr); gap: 6px; }
  .editor-metric-row label { font-size: 10px; }
  .form-field { grid-template-columns: 1fr; gap: 5px; }
}
</style>
