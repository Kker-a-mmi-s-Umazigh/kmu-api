import dotenv from "dotenv"
import app from "./app.js" // importe l'app Express sans listen

dotenv.config()

const PORT = process.env.APP_PORT || 3000

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ API running on http://localhost:${PORT}`)
})

export default server
