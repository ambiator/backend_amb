// authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const validateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(400).json({ message: 'Unauthorized' });

    // jwt.verify(token, process.env.APP_SECRET_KEY, (err, decoded) => {
    //     if (err) {
    //         return res.status(401).json({ message: 'Unauthorized' });
    //     }

    //     // Optionally, you can attach the decoded user information to the request object
    //     req.user = decoded;
        next();
    // });
};

module.exports = validateToken;