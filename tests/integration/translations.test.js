import request from "supertest"
import app from "../../src/app.js"
import { getSeededSong, loginAsAdmin, getAdminUser } from "./helpers.js"

describe("TranslationController", () => {
  it("creates and fetches a translation", async () => {
    const token = await loginAsAdmin()
    const admin = await getAdminUser()
    const song = await getSeededSong()

    const createRes = await request(app)
      .post("/api/translations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        songId: song.id,
        languageCode: "fr",
        createdBy: admin.id,
        notes: "Test translation",
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.id).toBeTruthy()

    const getRes = await request(app).get(
      `/api/translations/${createRes.body.id}`,
    )

    expect(getRes.status).toBe(200)
    expect(getRes.body.id).toBe(createRes.body.id)
  })
})
