import jwt from 'jsonwebtoken'
import config from '../config/db.js'

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Token d'accès manquant" })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.security.jwtSecret)
    req.user = decoded // { userId, email }
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}
