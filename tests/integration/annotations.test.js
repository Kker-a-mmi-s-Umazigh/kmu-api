import request from "supertest"
import app from "../../src/app.js"
import { getSeededSong, loginAsAdmin, getAdminUser } from "./helpers.js"

describe("AnnotationController", () => {
  it("creates and fetches an annotation", async () => {
    const token = await loginAsAdmin()
    const admin = await getAdminUser()
    const song = await getSeededSong()

    const createRes = await request(app)
      .post("/api/annotations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        songId: song.id,
        createdBy: admin.id,
        text: "Test annotation",
        startLine: 0,
        endLine: 0,
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.id).toBeTruthy()

    const getRes = await request(app).get(
      `/api/annotations/${createRes.body.id}`,
    )

    expect(getRes.status).toBe(200)
    expect(getRes.body.id).toBe(createRes.body.id)
  })
})
