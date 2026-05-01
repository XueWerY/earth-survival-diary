import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readUserIndex() {
  const filePath = path.join(DATA_DIR, 'user-index.json')
  if (!fs.existsSync(filePath)) {
    return {}
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return {}
  }
}

function writeUserIndex(index) {
  const filePath = path.join(DATA_DIR, 'user-index.json')
  fs.writeFileSync(filePath, JSON.stringify(index, null, 2))
}

function getUserFilePath(userId) {
  return path.join(DATA_DIR, `${userId}.json`)
}

function readUserData(userId) {
  const filePath = getUserFilePath(userId)
  if (!fs.existsSync(filePath)) {
    return { profile: {}, tasks: [], missionLists: [], missions: [], settings: {}, kv: {}, systemState: {} }
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return { profile: {}, tasks: [], missionLists: [], missions: [], settings: {}, kv: {}, systemState: {} }
  }
}

function writeUserData(userId, data) {
  const filePath = getUserFilePath(userId)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

export function getUserIndexByEmail(email) {
  const index = readUserIndex()
  return index[email] || null
}

export function setUserIndex(email, user) {
  const index = readUserIndex()
  index[email] = user
  writeUserIndex(index)
}

export function deleteUserIndex(email) {
  const index = readUserIndex()
  delete index[email]
  writeUserIndex(index)
}

export function getAllUserEmails() {
  const index = readUserIndex()
  return Object.keys(index)
}

export function emailExists(email) {
  const index = readUserIndex()
  return !!index[email]
}

export function getUserProfile(userId) {
  return readUserData(userId).profile || {}
}

export function setUserProfile(userId, profile) {
  const data = readUserData(userId)
  data.profile = profile
  writeUserData(userId, data)
}

export function getUserTasks(userId) {
  return readUserData(userId).tasks || []
}

export function setUserTasks(userId, tasks) {
  const data = readUserData(userId)
  data.tasks = tasks
  writeUserData(userId, data)
}

export function getUserMissionLists(userId) {
  return readUserData(userId).missionLists || []
}

export function setUserMissionLists(userId, lists) {
  const data = readUserData(userId)
  data.missionLists = lists
  writeUserData(userId, data)
}

export function getUserMissions(userId) {
  return readUserData(userId).missions || []
}

export function setUserMissions(userId, missions) {
  const data = readUserData(userId)
  data.missions = missions
  writeUserData(userId, data)
}

export function getUserSettings(userId) {
  return readUserData(userId).settings || {}
}

export function setUserSettings(userId, settings) {
  const data = readUserData(userId)
  data.settings = settings
  writeUserData(userId, data)
}

export function getUserKV(userId, key) {
  return readUserData(userId).kv[key] || null
}

export function setUserKV(userId, key, value) {
  const data = readUserData(userId)
  data.kv[key] = value
  writeUserData(userId, data)
}

export function deleteUserKV(userId, key) {
  const data = readUserData(userId)
  delete data.kv[key]
  writeUserData(userId, data)
}

export function getUserSession(userId) {
  const state = readUserData(userId).systemState || {}
  return state.session || null
}

export function setUserSession(userId, token) {
  const data = readUserData(userId)
  data.systemState.session = { token }
  writeUserData(userId, data)
}

export function deleteUserSession(userId) {
  const data = readUserData(userId)
  delete data.systemState.session
  writeUserData(userId, data)
}