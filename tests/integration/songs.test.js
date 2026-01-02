import request from "supertest"
import app from "../../src/app.js"
import { getSeededSong } from "./helpers.js"

describe("SongController", () => {
  it("lists songs", async () => {
    const res = await request(app).get("/api/songs")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it("fetches a song by id", async () => {
    const song = await getSeededSong()
    const res = await request(app).get(`/api/songs/${song.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(song.id)
  })
})
