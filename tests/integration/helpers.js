import crypto from "node:crypto"
import request from "supertest"
import app from "../../src/app.js"
import knex from "../../src/config/knexClient.js"

export const api = request(app)

export const loginAsAdmin = async () => {
  const res = await api.post("/api/auth/login").send({
    identifier: "admin",
    password: "admin123",
  })

  if (!res.body?.accessToken) {
    throw new Error("Failed to login as admin")
  }

  return res.body.accessToken
}

export const signupMember = async () => {
  const suffix = crypto.randomUUID().slice(0, 8)
  const payload = {
    email: `member.${suffix}@example.com`,
    username: `member_${suffix}`,
    password: "Member123!",
  }

  const res = await api.post("/api/auth/signup").send(payload)
  if (!res.body?.accessToken) {
    throw new Error("Failed to signup member")
  }

  return {
    token: res.body.accessToken,
    user: res.body.user,
  }
}

export const getAdminUser = async () => {
  const user = await knex("users").where({ username: "admin" }).first()
  if (!user) {
    throw new Error("Admin user not found")
  }
  return user
}

export const getSeededSong = async () => {
  const song = await knex("songs").select("id", "languageCode").first()
  if (!song) {
    throw new Error("Seeded song not found")
  }
  return song
}

export const getSeededArtist = async () => {
  const artist = await knex("artists").select("id").first()
  if (!artist) {
    throw new Error("Seeded artist not found")
  }
  return artist
}

export const getSeededAlbum = async () => {
  const album = await knex("albums").select("id").first()
  if (!album) {
    throw new Error("Seeded album not found")
  }
  return album
}
