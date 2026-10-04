// 一次性导入旧 MySQL 服务端数据到 ESD_DATA_DIR 下的 YAML 文件。
// 该脚本只用于迁移；服务端运行不连接或安装 MySQL。

const fs = require('node:fs')
const path = require('node:path')
const mysql = require(path.join(__dirname, '..', 'node_modules', 'mysql2', 'promise'))
const { createYamlStore, MODULE_TABLES } = require('../server/lib/yaml-store.cjs')

const projectRoot = path.resolve(__dirname, '..')
const dataDir = process.env.ESD_DATA_DIR && path.resolve(process.env.ESD_DATA_DIR)
const overwriteExisting = process.argv.includes('--overwrite')

function loadMysqlConfig() {
  const configPaths = [
    path.join(projectRoot, 'server', 'mysql.config.json'),
    path.join(projectRoot, 'electron', 'mysql.config.json')
  ]
  let file = {}
  const configPath = configPaths.find(candidate => fs.existsSync(candidate))
  if (configPath) {
    try {
      file = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    } catch (error) {
      throw new Error(`无法读取 ${configPath}: ${error.message}`)
    }
  }

  const env = process.env
  const config = {
    host: env.ESD_MYSQL_HOST || file.host,
    port: Number(env.ESD_MYSQL_PORT || file.port || 3306),
    user: env.ESD_MYSQL_USER || file.user,
    password: env.ESD_MYSQL_PASSWORD !== undefined ? env.ESD_MYSQL_PASSWORD : file.password,
    database: env.ESD_MYSQL_DATABASE || file.database
  }
  const missing = ['host', 'user', 'password', 'database'].filter(key => config[key] === undefined || config[key] === '')
  if (missing.length) {
    throw new Error(`旧 MySQL 导入配置缺失：${missing.join(', ')}。请设置 ESD_MYSQL_* 环境变量或使用旧版临时 MySQL 配置文件。`)
  }
  return config
}

function parseDoc(value, table, id) {
  try {
    return JSON.parse(String(value))
  } catch (error) {
    throw new Error(`无法解析 MySQL 表 ${table} 中记录 ${id}: ${error.message}`)
  }
}

async function readModuleRows(connection, table, shape) {
  const [rows] = await connection.query(`SELECT user_id, id, doc, seq FROM \`${table}\` ORDER BY user_id, seq, id`)
  const byUser = new Map()
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, shape === 'array' ? [] : null)
    const value = parseDoc(row.doc, table, row.id)
    if (shape === 'array') byUser.get(row.user_id).push(value)
    else if (byUser.get(row.user_id) === null) byUser.set(row.user_id, value)
  }
  return byUser
}

async function main() {
  if (!dataDir) throw new Error('请设置 ESD_DATA_DIR 为 YAML 数据目录，避免误写入其他位置。')
  const config = loadMysqlConfig()
  const store = await createYamlStore({
    dataDir,
    nodeModulesPath: path.join(projectRoot, 'node_modules')
  })
  const connection = await mysql.createConnection({ ...config, charset: 'utf8mb4', connectTimeout: 10000 })

  try {
    const [users] = await connection.query(
      'SELECT id, email, password_hash, nickname, created_at FROM users ORDER BY email'
    )
    const existingEmails = new Set(await store.getAllUserEmails())
    const collisions = users.map(user => user.email).filter(email => existingEmails.has(email))
    if (collisions.length && !overwriteExisting) {
      throw new Error(
        `目标 YAML 目录已包含 ${collisions.length} 个同邮箱账号。为避免覆盖，请先备份目标目录；确认后使用 --overwrite。`
      )
    }

    let moduleCount = 0
    let recordCount = 0
    for (const user of users) {
      await store.setUserIndex(user.email, {
        id: user.id,
        email: user.email,
        passwordHash: user.password_hash,
        nickname: user.nickname,
        createdAt: user.created_at
      })
    }

    for (const [moduleKey, module] of Object.entries(MODULE_TABLES)) {
      let byUser
      try {
        byUser = await readModuleRows(connection, module.table, module.shape)
      } catch (error) {
        if (error && error.code === 'ER_NO_SUCH_TABLE') {
          console.warn(`跳过缺失的旧 MySQL 表：${module.table}`)
          continue
        }
        throw error
      }

      const [type, key] = moduleKey.split(':')
      for (const [userId, value] of byUser) {
        await store.setUserKV(userId, type, key, value)
        moduleCount++
        recordCount += module.shape === 'array' ? value.length : (value === null ? 0 : 1)
      }
    }

    try {
      const [settings] = await connection.query('SELECT k, v FROM app_settings')
      for (const row of settings) {
        await store.setAppSetting(row.k, parseDoc(row.v, 'app_settings', row.k))
      }
      console.log(`全局设置：${settings.length} 条`)
    } catch (error) {
      if (error && error.code === 'ER_NO_SUCH_TABLE') console.warn('跳过缺失的旧 MySQL 表：app_settings')
      else throw error
    }

    console.log(`MySQL 到 YAML 导入完成：账号 ${users.length} 个，模块 ${moduleCount} 个，记录 ${recordCount} 条`)
    console.log(`YAML 数据目录：${dataDir}`)
  } finally {
    await connection.end()
    await store.close()
  }
}

main().catch(error => {
  console.error('MySQL 到 YAML 导入失败：', error && error.message ? error.message : error)
  process.exitCode = 1
})
