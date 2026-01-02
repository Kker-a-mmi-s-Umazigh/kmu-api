import request from "supertest"
import app from "../../src/app.js"
import { getSeededSong, loginAsAdmin, getAdminUser } from "./helpers.js"

describe("AnnotationCommentController", () => {
  it("creates and fetches an annotation comment", async () => {
    const token = await loginAsAdmin()
    const admin = await getAdminUser()
    const song = await getSeededSong()

    const annotationRes = await request(app)
      .post("/api/annotations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        songId: song.id,
        createdBy: admin.id,
        text: "Annotation for comment",
        startLine: 0,
        endLine: 0,
      })

    expect(annotationRes.status).toBe(201)

    const commentRes = await request(app)
      .post("/api/annotation-comments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        annotationId: annotationRes.body.id,
        userId: admin.id,
        body: "Comment body",
      })

    expect(commentRes.status).toBe(201)
    expect(commentRes.body.id).toBeTruthy()

    const getRes = await request(app).get(
      `/api/annotation-comments/${commentRes.body.id}`,
    )

    expect(getRes.status).toBe(200)
    expect(getRes.body.id).toBe(commentRes.body.id)
  })
})
