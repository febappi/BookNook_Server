import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGODB_URI)
const db = client.db('booknook')

export const booksCollection = db.collection('books')
export const borrowsCollection = db.collection('borrows')

export const connectToMongoDB = async () => {
    await client.connect()
    console.log('You successfully connected to MongoDB!')
}

export default client
