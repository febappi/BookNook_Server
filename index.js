import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectToMongoDB, createIndexes } from './db.js'
import booksRouter from './routes/books.js'
import borrowsRouter from './routes/borrows.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json())

app.get('/', (req, res) => {
    res.send({ message: 'Server is Running Fine' })
})

app.use('/books', booksRouter)
app.use('/borrows', borrowsRouter)

app.use((req, res) => {
    res.status(404).send({ message: 'Route not found' })
})

app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).send({ message: 'Invalid JSON body' })
    }
    console.error(error)
    res.status(500).send({ message: 'Something went wrong on the server' })
})

try {
    await connectToMongoDB()
    await createIndexes()
    app.listen(PORT, () => {
        console.log(`Server Is Running On PORT ${PORT}`)
    })
} catch (error) {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
}
