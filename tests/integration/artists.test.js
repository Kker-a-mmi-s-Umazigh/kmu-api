import request from "supertest";
import app from "../../src/app.js";
import { getSeededArtist, loginAsAdmin } from "./helpers.js";

describe("ArtistController", () => {
  it("lists artists", async () => {
    const res = await request(app).get("/api/artists");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("fetches an artist by id", async () => {
    const artist = await getSeededArtist();
    const res = await request(app).get(`/api/artists/${artist.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(artist.id);
  });

  it("rejects invalid photoUrl on create", async () => {
    const adminToken = await loginAsAdmin();
    const res = await request(app)
      .post("/api/artists")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Bad Url Artist",
        photoUrl: "javascript:alert(1)",
      });

    expect(res.status).toBe(400);
  });
});
