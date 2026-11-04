import express from 'express'
import { ObjectId } from 'mongodb'
import client, { booksCollection, borrowsCollection } from '../db.js'
import verifyToken from '../middleware/verifyToken.js'

const router = express.Router()

const LOAN_DAYS = 7

router.post('/', verifyToken, async (req, res) => {
    const { bookId } = req.body
    if (typeof bookId !== 'string' || !ObjectId.isValid(bookId)) {
        return res.status(400).send({ message: 'Invalid book id' })
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) })
    if (!book) {
        return res.status(404).send({ message: 'Book not found' })
    }

    const borrowDate = new Date()
    const returnDate = new Date(borrowDate)
    returnDate.setDate(returnDate.getDate() + LOAN_DAYS)

    const newBorrow = {
        bookId: book._id,
        bookTitle: book.title,
        bookImage: book.image,
        userEmail: req.user.email,
        userName: req.user.name,
        borrowDate,
        returnDate,
    }

    let isAvailable = false
    const session = client.startSession()
    try {
        await session.withTransaction(async () => {
            const updatedBook = await booksCollection.findOneAndUpdate(
                { _id: book._id, availableCopies: { $gt: 0 } },
                { $inc: { availableCopies: -1 } },
                { session }
            )
            isAvailable = Boolean(updatedBook)
            if (!isAvailable) {
                return
            }
            await borrowsCollection.insertOne(newBorrow, { session })
        })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).send({ message: 'You have already borrowed this book' })
        }
        throw error
    } finally {
        await session.endSession()
    }

    if (!isAvailable) {
        return res.status(400).send({ message: 'This book is not available right now' })
    }
    res.status(201).send({ message: 'Book borrowed successfully', borrow: newBorrow })
})

router.get('/', verifyToken, async (req, res) => {
    const borrows = await borrowsCollection
        .find({ userEmail: req.user.email })
        .sort({ borrowDate: -1 })
        .toArray()
    res.send(borrows)
})

router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid borrow id' })
    }

    let returnedBorrow = null
    const session = client.startSession()
    try {
        await session.withTransaction(async () => {
            returnedBorrow = await borrowsCollection.findOneAndDelete(
                { _id: new ObjectId(id), userEmail: req.user.email },
                { session }
            )
            if (!returnedBorrow) {
                return
            }
            await booksCollection.updateOne(
                { _id: returnedBorrow.bookId },
                { $inc: { availableCopies: 1 } },
                { session }
            )
        })
    } finally {
        await session.endSession()
    }

    if (!returnedBorrow) {
        return res.status(404).send({ message: 'Borrow record not found or already returned' })
    }
    res.send({ message: 'Book returned successfully' })
})

export default router
