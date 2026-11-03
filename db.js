import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGODB_URI)
const db = client.db('booknook')

export const booksCollection = db.collection('books')
export const borrowsCollection = db.collection('borrows')

export const connectToMongoDB = async () => {
    await client.connect()
    console.log('You successfully connected to MongoDB!')
}

export const createIndexes = async () => {
    await booksCollection.createIndex({ createdAt: -1 })
    await booksCollection.createIndex({ addedByEmail: 1 })
    await borrowsCollection.createIndex({ userEmail: 1 })
    await borrowsCollection.createIndex({ bookId: 1, userEmail: 1 }, { unique: true })
}

export default client
