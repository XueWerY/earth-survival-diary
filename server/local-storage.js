import fs from 'fs'
import path from 'path'

/**
 * Local JSON file storage.
 *
 * Data directory structure:
 *   data/
 *     users/                  User index (one .json file per registered email)
 *       <email>.json
 *     <userId>/
 *       <type>/               Data type subdirectory
 *         <key>.json
 *
 * Types: profile, session, settings, footprint, list, course, focus, countdown, system
 *
 * All functions are async to match the server interface.
 * Error format across API: {error: "message"}
 */

const DATA_DIR = path.join(process.cwd(), 'data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function getDataPath(type, userId, key) {
  let dir, filename
  if (type === 'index') {
    dir = path.join(DATA_DIR, 'users')
    filename = `${key}.json`
  } else {
    dir = path.join(DATA_DIR, userId, type)
    filename = `${(key || type).replace(/:/g, '__')}.json`
  }
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, filename)
}

function readJson(filePath, defaultVal = null) {
  if (!fs.existsSync(filePath)) return defaultVal
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) }
  catch { return defaultVal }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function getUserIndexByEmail(email) {
  return readJson(getDataPath('index', null, email))
}

export async function setUserIndex(email, entry) {
  writeJson(getDataPath('index', null, email), entry)
}

export async function deleteUserIndex(email) {
  const p = getDataPath('index', null, email)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

export function getAllUserEmails() {
  const dir = path.join(DATA_DIR, 'users')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
}

export function emailExists(email) {
  return fs.existsSync(getDataPath('index', null, email))
}

export async function getUserProfile(userId) {
  return readJson(getDataPath('profile', userId))
}

export async function setUserProfile(userId, profile) {
  writeJson(getDataPath('profile', userId), profile)
}

export async function getUserTasks(userId) {
  return readJson(getDataPath('footprint', userId), [])
}

export async function setUserTasks(userId, tasks) {
  writeJson(getDataPath('footprint', userId), tasks)
}

export async function getUserMissionLists(userId) {
  return readJson(getDataPath('list', userId, 'lists'), [])
}

export async function setUserMissionLists(userId, lists) {
  writeJson(getDataPath('list', userId, 'lists'), lists)
}

export async function getUserMissions(userId) {
  return readJson(getDataPath('list', userId, 'tasks'), [])
}

export async function setUserMissions(userId, missions) {
  writeJson(getDataPath('list', userId, 'tasks'), missions)
}

export async function getUserSettings(userId) {
  return readJson(getDataPath('settings', userId), {})
}

export async function setUserSettings(userId, settings) {
  writeJson(getDataPath('settings', userId), settings)
}

export async function getUserKV(userId, type, key) {
  return readJson(getDataPath(type, userId, key))
}

export async function setUserKV(userId, type, key, data) {
  writeJson(getDataPath(type, userId, key), data)
}

export async function deleteUserKV(userId, type, key) {
  const p = getDataPath(type, userId, key)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

export async function getUserSession(userId) {
  return readJson(getDataPath('session', userId))
}

export async function setUserSession(userId, token) {
  writeJson(getDataPath('session', userId), { token, createdAt: new Date().toISOString() })
}

export async function deleteUserSession(userId) {
  const p = path.join(DATA_DIR, userId, 'session', 'session.json')
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
