import request from "supertest"
import app from "../../src/app.js"
import { getSeededAlbum } from "./helpers.js"

describe("AlbumController", () => {
  it("lists albums", async () => {
    const res = await request(app).get("/api/albums")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it("fetches album tracks", async () => {
    const album = await getSeededAlbum()
    const res = await request(app).get(`/api/albums/${album.id}/tracks`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(album.id)
  })
})
