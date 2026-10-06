const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const YAML = require('yaml')

const projectRoot = path.resolve(__dirname, '..')
const configPath = path.join(projectRoot, 'config.yaml')
const configTemplatePath = path.join(__dirname, 'config.example.yaml')

function parseYamlFile(filePath) {
  try {
    return YAML.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`无法读取服务端配置 ${filePath}：${error.message}`)
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, YAML.stringify(config), 'utf8')
}

function loadConfig() {
  const configExists = fs.existsSync(configPath)
  const config = configExists
    ? parseYamlFile(configPath)
    : (fs.existsSync(configTemplatePath)
        ? parseYamlFile(configTemplatePath)
        : {
            host: '127.0.0.1',
            port: 5000,
            dataDir: 'C:/Earth-Survival-Diary/data',
            updatesDir: 'C:/Earth-Survival-Diary/updates',
            jwtSecret: ''
          })

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`服务端配置必须是 YAML 对象：${configPath}`)
  }

  let updated = !configExists
  if (!configExists) {
    const legacyEnvironment = {
      HOST: 'host',
      PORT: 'port',
      ESD_DATA_DIR: 'dataDir',
      ESD_JWT_SECRET: 'jwtSecret'
    }
    for (const [environmentName, configName] of Object.entries(legacyEnvironment)) {
      if (process.env[environmentName]) config[configName] = process.env[environmentName]
    }
  }

  if (!config.jwtSecret) {
    config.jwtSecret = crypto.randomBytes(48).toString('base64url')
    updated = true
  }

  if (typeof config.host !== 'string' || !config.host.trim()) {
    throw new Error('config.yaml 中的 host 必须是非空字符串')
  }

  const port = Number(config.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('config.yaml 中的 port 必须是 1 到 65535 之间的整数')
  }

  if (typeof config.dataDir !== 'string' || !config.dataDir.trim()) {
    throw new Error('config.yaml 中的 dataDir 必须是非空路径')
  }

  if (typeof config.updatesDir !== 'string' || !config.updatesDir.trim()) {
    config.updatesDir = 'C:/Earth-Survival-Diary/updates'
    updated = true
  }

  if (typeof config.jwtSecret !== 'string' || config.jwtSecret.length < 32) {
    throw new Error('config.yaml 中的 jwtSecret 至少需要 32 个字符')
  }

  if (updated) {
    saveConfig(config)
    console.log(`服务端配置已写入：${configPath}`)
  }

  return {
    host: config.host.trim(),
    port,
    dataDir: path.resolve(projectRoot, config.dataDir),
    updatesDir: path.resolve(projectRoot, config.updatesDir),
    jwtSecret: config.jwtSecret
  }
}

process.env.NODE_ENV = 'production'

async function start() {
  const config = loadConfig()
  const rootNodeModules = path.join(projectRoot, 'node_modules')
  const sourceNodeModules = path.join(__dirname, 'node_modules')
  const nodeModulesPath = fs.existsSync(path.join(rootNodeModules, 'express'))
    ? rootNodeModules
    : sourceNodeModules

  const { createProdServer } = require(path.join(__dirname, 'prod-server.cjs'))
  const { server, storage } = await createProdServer({
    port: config.port,
    dataDir: config.dataDir,
    updatesDir: config.updatesDir,
    jwtSecret: config.jwtSecret,
    resourcesPath: projectRoot,
    nodeModulesPath,
    cloudMode: true,
    requireSecureAuth: true,
    trustProxy: true
  })

  server.listen(config.port, config.host, () => {
    console.log(`云端 API 已启动：http://${config.host}:${config.port}`)
  })

  let closing = false
  async function shutdown(signal) {
    if (closing) return
    closing = true
    console.log(`收到 ${signal}，正在关闭云端 API…`)
    const forceClose = setTimeout(() => {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
      process.exit(1)
    }, 10000)
    forceClose.unref()
    server.close(async () => {
      clearTimeout(forceClose)
      try { await storage.close() } catch (error) { console.error('关闭 YAML 文件存储失败：', error) }
      process.exit(0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch(error => {
  console.error('云端 API 启动失败：', error)
  process.exitCode = 1
})
