import { Annotation } from "../models/Annotation.js"
import { makeBaseController } from "./baseController.js"
import { normalizeAnnotationPayload } from "../utils/annotationPayload.js"

const allowedCreateFields = [
  "songId",
  "createdBy",
  "text",
  "bodyMd",
  "startCharIndex",
  "endCharIndex",
  "startChar",
  "endChar",
  "startLine",
  "endLine",
]
const allowedUpdateFields = [
  "text",
  "bodyMd",
  "startCharIndex",
  "endCharIndex",
  "startChar",
  "endChar",
  "startLine",
  "endLine",
]

export const AnnotationController = {
  ...makeBaseController(Annotation, {
    allowedCreateFields,
    allowedUpdateFields,
    transformCreateData: (data) =>
      normalizeAnnotationPayload(data, { applyDefaults: true }),
    transformUpdateData: (data) =>
      normalizeAnnotationPayload(data, { applyDefaults: false }),
  }),

  getFullAnnotation: async (req, res) => {
    try {
      const { id } = req.params
      const ann = await Annotation.query()
        .findById(id)
        .withGraphFetched(
          `
          [
            author(selectUsername),
            song.[language],
            comments.[author(selectUsername)]
          ]
        `,
        )
        .modifiers({
          selectUsername(builder) {
            builder.select("id", "username")
          },
        })

      if (!ann) return res.status(404).json({ error: "Not found" })

      res.json(ann)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: "Internal error" })
    }
  },
}
