import { GlossaryTerm } from "../models/GlossaryTerm.js"
import { makeBaseController } from "./baseController.js"

const allowedCreateFields = ["term", "languageCode", "notes", "createdAt"]
const allowedUpdateFields = ["term", "notes"]

export const GlossaryController = {
  ...makeBaseController(GlossaryTerm, {
    allowedCreateFields,
    allowedUpdateFields,
  }),

  getFullTerm: async (req, res) => {
    try {
      const { id } = req.params
      const term = await GlossaryTerm.query().findById(id).withGraphFetched(`
          [
            language,
            meanings,
            occurrences.[
              lyricLine.[song],
              meaning
            ]
          ]
        `)

      if (!term) return res.status(404).json({ error: "Not found" })

      res.json(term)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: "Internal error" })
    }
  },
}
