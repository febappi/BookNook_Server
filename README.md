<div align="center">

# BookNook Server

### The REST API for BookNook, a small online library.

This server stores books and borrow records in MongoDB, checks the JWT sent by the BookNook frontend on protected routes, and keeps the available copies of every book correct when books are borrowed and returned.

<br>

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

</div>

---

## Technologies I Used

- Node.js + Express.js
- MongoDB (official driver)
- jose for JWT verification
- cors and dotenv

## How Authentication Works

Users log in on the Next.js app with Better Auth. The frontend gets a signed JWT from Better Auth and sends it in the `Authorization: Bearer <token>` header. This server verifies the token with Better Auth's public keys from `CLIENT_URL/api/auth/jwks` and reads the user's email from the verified token. It never trusts an email sent in the request body.

## API Endpoints

| Method | Endpoint | Login | Description |
| --- | --- | --- | --- |
| GET | `/books` | No | Get all books. Supports `search`, `category`, `available=true`, `sort` (`newest`, `oldest`, `title`), `page` and `limit`. With `mine=true` and a token it returns only your books. |
| GET | `/books/:id` | Yes | Get one book, including whether you have borrowed it |
| POST | `/books` | Yes | Add a book. Available copies start equal to total copies. |
| PATCH | `/books/:id` | Yes | Update your own book |
| DELETE | `/books/:id` | Yes | Delete your own book when no copy is borrowed |
| POST | `/borrows` | Yes | Borrow a book for 7 days |
| GET | `/borrows` | Yes | Get your borrowed books |
| DELETE | `/borrows/:id` | Yes | Return a borrowed book |

## Borrowing Rules

- Borrowing lowers `availableCopies` by 1 with `$inc`, and returning raises it by 1.
- A book with 0 available copies cannot be borrowed, and the count never goes below 0.
- A user cannot borrow the same book twice at the same time. A unique index on `bookId` + `userEmail` blocks it.
- Borrow and return run inside MongoDB transactions so the book and the borrow record always change together.
- Only the owner of a book can edit or delete it.

## How to Run

```bash
npm install
npm run dev
```

Use `npm start` to run without auto reload.

Create a `.env` file in the project root before running:

```env
MONGODB_URI=your_mongodb_connection_string
PORT=5000
CLIENT_URL=http://localhost:3000
```

`CLIENT_URL` must be the exact frontend URL without a trailing slash. It is used for CORS and for checking the JWT.
