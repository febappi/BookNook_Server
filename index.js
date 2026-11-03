import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectToMongoDB } from './db.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json())

app.get('/', (req, res) => {
    res.send({ message: 'Server is Running Fine' })
})

try {
    await connectToMongoDB()
    app.listen(PORT, () => {
        console.log(`Server Is Running On PORT ${PORT}`)
    })
} catch (error) {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
}
