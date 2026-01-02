import { Translation } from "../models/Translation.js";
import { makeBaseController } from "./baseController.js";

const allowedCreateFields = [
  "songId",
  "languageCode",
  "createdBy",
  "isApproved",
  "notes",
];

const allowedUpdateFields = ["isApproved", "notes"];

export const TranslationController = {
  ...makeBaseController(Translation, {
    allowedCreateFields,
    allowedUpdateFields,
  }),

  getFullTranslation: async (req, res) => {
    try {
      const { id } = req.params;
      const tr = await Translation.query()
        .findById(id)
        .withGraphFetched(
          `
          [
            song.[language, artists],
            language,
            author(selectUsername),
            lines.[lyricLine]
          ]
        `,
        )
        .modifiers({
          selectUsername(builder) {
            builder.select("id", "username");
          },
        });

      if (!tr) return res.status(404).json({ error: "Not found" });

      res.json(tr);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },
};
