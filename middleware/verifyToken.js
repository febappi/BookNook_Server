import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`))

export const getUserFromToken = async (req) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.split(' ')[1]
    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: process.env.CLIENT_URL,
            audience: process.env.CLIENT_URL,
        })
        if (!payload.email) {
            return null
        }
        return { email: payload.email, name: payload.name }
    } catch (error) {
        return null
    }
}

const verifyToken = async (req, res, next) => {
    const user = await getUserFromToken(req)
    if (!user) {
        return res.status(401).send({ message: 'Unauthorized access. Please login again.' })
    }
    req.user = user
    next()
}

export default verifyToken
