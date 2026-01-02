import { BaseModel } from "./BaseModel.js";
import { Role } from "./Role.js";
import { RefreshToken } from "./RefreshToken.js";
import { Annotation } from "./Annotation.js";
import { AnnotationComment } from "./AnnotationComment.js";
import { Notification } from "./Notification.js";
import { Report } from "./Report.js";
import { Song } from "./Song.js";
import { Translation } from "./Translation.js";

export class User extends BaseModel {
  static tableName = "users";
  static idColumn = "id";

  static jsonSchema = {
    type: "object",
    required: ["username", "email", "passwordHash", "passwordSalt", "roleId"],
    properties: {
      id: { type: "string", format: "uuid" },
      username: { type: "string" },
      email: { type: "string", format: "email" },
      displayName: { type: ["string", "null"] },
      avatarUrl: { type: ["string", "null"] },
      bio: { type: ["string", "null"] },
      badges: {
        type: ["array", "null"],
        items: {
          type: "object",
          required: ["text", "color"],
          properties: {
            text: { type: "string" },
            color: { type: "string" },
          },
        },
      },
      passwordHash: { type: "string" },
      passwordSalt: { type: "string" },
      reputation: { type: "integer" },
      isBanned: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      roleId: { type: "string", format: "uuid" },
    },
  };

  static relationMappings = () => ({
    role: {
      relation: BaseModel.BelongsToOneRelation,
      modelClass: Role,
      join: { from: "users.roleId", to: "roles.id" },
    },
    refreshTokens: {
      relation: BaseModel.HasManyRelation,
      modelClass: RefreshToken,
      join: { from: "users.id", to: "refreshTokens.userId" },
    },
    annotations: {
      relation: BaseModel.HasManyRelation,
      modelClass: Annotation,
      join: { from: "users.id", to: "annotations.createdBy" },
    },
    annotationComments: {
      relation: BaseModel.HasManyRelation,
      modelClass: AnnotationComment,
      join: { from: "users.id", to: "annotationComments.userId" },
    },
    notifications: {
      relation: BaseModel.HasManyRelation,
      modelClass: Notification,
      join: { from: "users.id", to: "notifications.userId" },
    },
    reportsMade: {
      relation: BaseModel.HasManyRelation,
      modelClass: Report,
      join: { from: "users.id", to: "reports.reporterId" },
    },
    reportsResolved: {
      relation: BaseModel.HasManyRelation,
      modelClass: Report,
      join: { from: "users.id", to: "reports.resolvedBy" },
    },
    favoriteSongs: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: Song,
      join: {
        from: "users.id",
        through: {
          from: "favoriteSongs.userId",
          to: "favoriteSongs.songId",
        },
        to: "songs.id",
      },
    },
    votedAnnotations: {
      relation: BaseModel.ManyToManyRelation,
      modelClass: Annotation,
      join: {
        from: "users.id",
        through: {
          from: "annotationVotes.userId",
          to: "annotationVotes.annotationId",
        },
        to: "annotations.id",
      },
    },
    translations: {
      relation: BaseModel.HasManyRelation,
      modelClass: Translation,
      join: { from: "users.id", to: "translations.createdBy" },
    },
    songsCreated: {
      relation: BaseModel.HasManyRelation,
      modelClass: Song,
      join: { from: "users.id", to: "songs.createdBy" },
    },
  });
}
