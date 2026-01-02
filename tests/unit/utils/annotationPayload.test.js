import { normalizeAnnotationPayload } from "../../../src/utils/annotationPayload.js"

describe("normalizeAnnotationPayload", () => {
  it("maps text and index fields to normalized shape", () => {
    const payload = normalizeAnnotationPayload({
      id: "anno-1",
      songId: "song-1",
      createdBy: "user-1",
      text: "hello",
      startCharIndex: 2,
      endCharIndex: 9,
      startLine: 3,
      endLine: 4,
    })

    expect(payload).toEqual({
      id: "anno-1",
      songId: "song-1",
      createdBy: "user-1",
      bodyMd: "hello",
      startChar: 2,
      endChar: 9,
      startLine: 3,
      endLine: 4,
    })
  })

  it("prefers explicit text fields over bodyMd and indexes", () => {
    const payload = normalizeAnnotationPayload({
      bodyMd: "original",
      text: "override",
      startChar: 1,
      startCharIndex: 8,
      endChar: 4,
      endCharIndex: 9,
    })

    expect(payload).toEqual({
      bodyMd: "override",
      startChar: 8,
      endChar: 9,
    })
  })

  it("applies defaults for lines when requested", () => {
    const payload = normalizeAnnotationPayload(
      {
        bodyMd: "line defaults",
        startLine: null,
      },
      { applyDefaults: true },
    )

    expect(payload).toEqual({
      bodyMd: "line defaults",
      startLine: 0,
      endLine: 0,
    })
  })
})
