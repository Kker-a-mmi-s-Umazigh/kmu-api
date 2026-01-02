import { AnnotationComment } from "../models/AnnotationComment.js";
import { makeBaseController } from "./baseController.js";

const allowedCreateFields = [
  "annotationId",
  "userId",
  "parentCommentId",
  "body",
];
const allowedUpdateFields = ["body"];

export const AnnotationCommentController = {
  ...makeBaseController(AnnotationComment, {
    allowedCreateFields,
    allowedUpdateFields,
    skipModeration: true,
  }),
};
