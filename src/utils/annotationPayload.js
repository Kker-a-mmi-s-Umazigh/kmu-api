export const normalizeAnnotationPayload = (data, { applyDefaults = false } = {}) => {
  if (!data || typeof data !== "object") return data

  const out = {}

  if (data.id !== undefined) out.id = data.id
  if (data.songId !== undefined) out.songId = data.songId
  if (data.createdBy !== undefined) out.createdBy = data.createdBy

  if (data.bodyMd !== undefined) out.bodyMd = data.bodyMd
  if (data.text !== undefined) out.bodyMd = data.text

  if (data.startChar !== undefined) out.startChar = data.startChar
  if (data.startCharIndex !== undefined) out.startChar = data.startCharIndex
  if (data.endChar !== undefined) out.endChar = data.endChar
  if (data.endCharIndex !== undefined) out.endChar = data.endCharIndex

  if (data.startLine !== undefined) out.startLine = data.startLine
  if (data.endLine !== undefined) out.endLine = data.endLine

  if (applyDefaults) {
    if (out.startLine === undefined || out.startLine === null) {
      out.startLine = 0
    }
    if (out.endLine === undefined || out.endLine === null) {
      out.endLine = out.startLine ?? 0
    }
  }

  return out
}
