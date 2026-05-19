import jwt from 'jsonwebtoken'

const authMiddleware = (request, response, next) => {
    try {
        const authHeader = request.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return response.status(401).json({
                message: "Access denied. No token provided.",
                error: true,
                success: false
            })
        }

        const token = authHeader.split(' ')[1]

        if (!token) {
            return response.status(401).json({
                message: "Access denied. No token provided.",
                error: true,
                success: false
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        request.admin = decoded
        next()
    } catch (error) {
        return response.status(401).json({
            message: "Invalid or expired token.",
            error: true,
            success: false
        })
    }
}

export default authMiddleware
