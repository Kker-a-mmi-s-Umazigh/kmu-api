import request from "supertest"
import app from "../../src/app.js"
import { getSeededArtist } from "./helpers.js"

describe("ArtistController", () => {
  it("lists artists", async () => {
    const res = await request(app).get("/api/artists")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it("fetches an artist by id", async () => {
    const artist = await getSeededArtist()
    const res = await request(app).get(`/api/artists/${artist.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(artist.id)
  })
})
