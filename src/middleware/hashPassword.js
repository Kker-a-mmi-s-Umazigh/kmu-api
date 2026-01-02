import config from "../config/db.js"
import { pbkdf2Sync, randomBytes } from "crypto"

const { pepper, keylen, iterations, digest } = config.security

export const hashPassword = (
  password,
  salt = randomBytes(128).toString("hex"),
) => {
  if (!password) {
    throw new Error("Le mot de passe est requis pour générer le hash.")
  }

  if (!pepper || !keylen || !iterations || !digest) {
    throw new Error(
      "Les paramètres de sécurité sont mal configurés dans config.security.",
    )
  }

  const hash = pbkdf2Sync(
    password,
    salt + pepper,
    iterations,
    keylen,
    digest,
  ).toString("hex")

  return [hash, salt]
}

export default hashPassword
