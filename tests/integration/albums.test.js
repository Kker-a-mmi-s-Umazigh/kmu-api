import request from "supertest";
import app from "../../src/app.js";
import { getSeededAlbum, getSeededArtist, loginAsAdmin } from "./helpers.js";

describe("AlbumController", () => {
  it("lists albums", async () => {
    const res = await request(app).get("/api/albums");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("fetches album tracks", async () => {
    const album = await getSeededAlbum();
    const res = await request(app).get(`/api/albums/${album.id}/tracks`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(album.id);
  });

  it("rejects invalid coverUrl on create", async () => {
    const adminToken = await loginAsAdmin();
    const artist = await getSeededArtist();

    const res = await request(app)
      .post("/api/albums")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Bad Url Album",
        primaryArtistId: artist.id,
        coverUrl: "javascript:alert(1)",
      });

    expect(res.status).toBe(400);
  });

  it("creates an album with tracks and new songs", async () => {
    const adminToken = await loginAsAdmin();
    const artist = await getSeededArtist();

    const res = await request(app)
      .post("/api/albums")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Album With Tracks",
        primaryArtistId: artist.id,
        tracks: [
          {
            trackNumber: 1,
            song: {
              title: "New Song From Album",
              languageCode: "kab",
            },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.tracks)).toBe(true);
    expect(res.body.tracks.length).toBe(1);
    expect(res.body.tracks[0].song?.title).toBe("New Song From Album");
  });
});
