import crypto from "node:crypto"
import util from "node:util"

const formatValue = (value) => {
  if (value === undefined) return "undefined"
  if (value === null) return "null"
  if (Buffer.isBuffer(value)) return value.toString("utf8")
  if (typeof value === "string") return value
  return util.inspect(value, {
    depth: null,
    maxArrayLength: null,
    colors: false,
    compact: false,
  })
}

const REDACTED = "[REDACTED]"
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwordhash",
  "passwordsalt",
  "token",
  "refreshtoken",
  "accesstoken",
  "jwt",
  "secret",
  "pepper",
])

const shouldRedactKey = (key) => {
  if (!key) return false
  const normalized = String(key).toLowerCase()
  if (SENSITIVE_KEYS.has(normalized)) return true
  return (
    normalized.includes("token") ||
    normalized.includes("password") ||
    normalized.includes("secret")
  )
}

const redactValue = (value) => {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((item) => redactValue(item))
  if (typeof value !== "object") return value
  const output = {}
  for (const [key, val] of Object.entries(value)) {
    output[key] = shouldRedactKey(key) ? REDACTED : redactValue(val)
  }
  return output
}

export const requestLogger = (req, res, next) => {
  const requestId = crypto.randomUUID()
  const startedAt = process.hrtime.bigint()
  const now = new Date().toISOString()
  const forwardedFor = req.headers["x-forwarded-for"]
  const clientIp = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : req.ip

  const reqLines = [
    `[REQ] ${now} id=${requestId} ${req.method} ${req.originalUrl}`,
    `ip: ${clientIp}`,
    `headers: ${formatValue(redactValue(req.headers))}`,
    `query: ${formatValue(redactValue(req.query))}`,
    `params: ${formatValue(req.params)}`,
    `body: ${formatValue(redactValue(req.body))}`,
    "----",
  ]

  console.log(reqLines.join("\n"))

  let responseBody
  const originalJson = res.json.bind(res)
  const originalSend = res.send.bind(res)

  res.json = (body) => {
    responseBody = body
    return originalJson(body)
  }

  res.send = (body) => {
    if (responseBody === undefined) {
      responseBody = body
    }
    return originalSend(body)
  }

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    const responseInfo = {
      time: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
      headers: redactValue(res.getHeaders()),
      body: redactValue(responseBody),
    }

    const resLines = [
      `[RES] ${responseInfo.time} id=${requestId} ${req.method} ${req.originalUrl}`,
      `status: ${responseInfo.status} (${responseInfo.durationMs}ms)`,
      `headers: ${formatValue(responseInfo.headers)}`,
      `body: ${formatValue(responseInfo.body)}`,
      "====",
    ]

    console.log(resLines.join("\n"))
  })

  next()
}
