import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()
import connectDB from "./config/connectDB.js";
import categoryRouter from './routes/category.route.js';
import productRouter from './routes/product.route.js';
import headerRouter from './routes/header.route.js';
import clientHeaderRouter from './routes/clientHeader.route.js';
import clientProductRouter from './routes/clientProduct.route.js';
import clientCartRouter from './routes/clientCart.route.js';
import clientOrderRouter from './routes/clientOrder.route.js';
import orderRouter from './routes/order.route.js';
import contactMessageRouter from './routes/contactMessage.route.js';
import reviewRouter from './routes/review.route.js';
import clientReviewRouter from './routes/clientReview.route.js';
import clientCategoryRouter from './routes/clientCategory.route.js';
import authRouter from './routes/auth.route.js';
import adminMgmtRouter from './routes/adminMgmt.route.js';
import authMiddleware from './middlewares/auth.middleware.js';

const app = express();

const corsOptions = {
    origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, process.env.FRONTEND_URL.replace(/\/$/, '')] : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'guest-id', 'Authorization'],
    credentials: true
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = process.env.PORT || 8080

app.get("/", (request, response) => {
    ///server to client
    response.json({
        message: "Gram2ghor.com is under development " + PORT
    })
})

app.use("/api/admin/category", authMiddleware, categoryRouter);
app.use("/api/admin/product", authMiddleware, productRouter);
app.use("/api/admin/header", authMiddleware, headerRouter);
app.use("/api/client/header", clientHeaderRouter);
app.use("/api/client/product", clientProductRouter);
app.use("/api/client/cart", clientCartRouter);
app.use("/api/client/order", clientOrderRouter);
app.use("/api/admin/order", authMiddleware, orderRouter);
app.use("/api/client/contact", contactMessageRouter);
app.use("/api/admin/review", authMiddleware, reviewRouter);
app.use("/api/client/review", clientReviewRouter);
app.use("/api/client/category", clientCategoryRouter);
app.use("/api/admin/auth", authRouter);
app.use("/api/admin/admins", authMiddleware, adminMgmtRouter);

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is running", PORT)
    })
});