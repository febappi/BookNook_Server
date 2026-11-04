import express from 'express'
import { ObjectId } from 'mongodb'
import { booksCollection, borrowsCollection } from '../db.js'
import verifyToken, { getUserFromToken } from '../middleware/verifyToken.js'

const router = express.Router()

const categories = ['Fiction', 'Science', 'History', 'Kids', 'Others']

const isEmptyText = (value) => typeof value !== 'string' || value.trim() === ''

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const validateBook = (book) => {
    if (isEmptyText(book.title)) {
        return 'Book title is required'
    }
    if (isEmptyText(book.author)) {
        return 'Author name is required'
    }
    if (!categories.includes(book.category)) {
        return 'Please select a valid category'
    }
    if (isEmptyText(book.image) || !book.image.startsWith('https://')) {
        return 'A valid book image URL is required'
    }
    if (isEmptyText(book.description)) {
        return 'Short description is required'
    }
    if (!Number.isInteger(book.totalCopies) || book.totalCopies < 1) {
        return 'Total copies must be a positive whole number'
    }
    return null
}

const getBookFields = (book) => {
    return {
        title: book.title.trim(),
        author: book.author.trim(),
        category: book.category,
        image: book.image.trim(),
        description: book.description.trim(),
    }
}

router.get('/', async (req, res) => {
    const { search, category, available, sort, mine } = req.query
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 9, 1), 50)
    const query = {}

    if (typeof search === 'string' && search.trim()) {
        const pattern = new RegExp(escapeRegex(search.trim()), 'i')
        query.$or = [{ title: pattern }, { author: pattern }]
    }
    if (categories.includes(category)) {
        query.category = category
    }
    if (available === 'true') {
        query.availableCopies = { $gt: 0 }
    }
    if (mine === 'true') {
        const user = await getUserFromToken(req)
        if (!user) {
            return res.status(401).send({ message: 'Unauthorized access. Please login again.' })
        }
        query.addedByEmail = user.email
    }

    let sortBy = { createdAt: -1 }
    if (sort === 'oldest') {
        sortBy = { createdAt: 1 }
    }
    if (sort === 'title') {
        sortBy = { title: 1 }
    }

    const total = await booksCollection.countDocuments(query)
    const books = await booksCollection
        .find(query)
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray()

    res.send({ books, total, page, totalPages: Math.ceil(total / limit) })
})

router.get('/:id', verifyToken, async (req, res) => {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid book id' })
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(id) })
    if (!book) {
        return res.status(404).send({ message: 'Book not found' })
    }

    const myBorrow = await borrowsCollection.findOne({ bookId: book._id, userEmail: req.user.email })
    res.send({ ...book, isBorrowedByMe: Boolean(myBorrow) })
})

router.post('/', verifyToken, async (req, res) => {
    const errorMessage = validateBook(req.body)
    if (errorMessage) {
        return res.status(400).send({ message: errorMessage })
    }

    const newBook = {
        ...getBookFields(req.body),
        addedByName: req.user.name,
        addedByEmail: req.user.email,
        totalCopies: req.body.totalCopies,
        availableCopies: req.body.totalCopies,
        createdAt: new Date(),
    }

    await booksCollection.insertOne(newBook)
    res.status(201).send({ message: 'Book added successfully', book: newBook })
})

router.patch('/:id', verifyToken, async (req, res) => {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid book id' })
    }

    const errorMessage = validateBook(req.body)
    if (errorMessage) {
        return res.status(400).send({ message: errorMessage })
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(id) })
    if (!book) {
        return res.status(404).send({ message: 'Book not found' })
    }
    if (book.addedByEmail !== req.user.email) {
        return res.status(403).send({ message: 'You can only edit your own books' })
    }

    const newTotalCopies = req.body.totalCopies
    const borrowedCopies = book.totalCopies - book.availableCopies
    if (newTotalCopies < borrowedCopies) {
        return res.status(400).send({
            message: `${borrowedCopies} copies are borrowed right now, so total copies cannot be less than ${borrowedCopies}`,
        })
    }

    const copiesDifference = newTotalCopies - book.totalCopies
    const result = await booksCollection.updateOne(
        {
            _id: book._id,
            addedByEmail: req.user.email,
            totalCopies: book.totalCopies,
            availableCopies: { $gte: -copiesDifference },
        },
        {
            $set: { ...getBookFields(req.body), totalCopies: newTotalCopies },
            $inc: { availableCopies: copiesDifference },
        }
    )

    if (result.matchedCount === 0) {
        return res.status(409).send({ message: 'This book was just borrowed or changed. Please try again.' })
    }
    res.send({ message: 'Book updated successfully' })
})

router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid book id' })
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(id) })
    if (!book) {
        return res.status(404).send({ message: 'Book not found' })
    }
    if (book.addedByEmail !== req.user.email) {
        return res.status(403).send({ message: 'You can only delete your own books' })
    }

    const result = await booksCollection.deleteOne({
        _id: book._id,
        addedByEmail: req.user.email,
        $expr: { $eq: ['$availableCopies', '$totalCopies'] },
    })

    if (result.deletedCount === 0) {
        return res.status(409).send({ message: 'This book is borrowed right now. You can delete it after all copies are returned.' })
    }
    res.send({ message: 'Book deleted successfully' })
})

export default router
