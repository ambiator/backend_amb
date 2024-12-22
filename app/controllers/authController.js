const sql = require('../config/dbSql');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const bcrypt = require('bcrypt');


exports.login = (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        // user Role based bellow commented
        // const userRole = req.body.userRole;

        // const query = 'SELECT * FROM users WHERE email = ? AND userRole = ?';

        const query = 'SELECT * FROM users WHERE email = ?';
        sql.query(query, [email], function (err, result) {
            if (err) return res.status(400).json({ success: false, message: err.message });

            if (result.length > 0) {
                // Compare the entered password with the stored hash
                bcrypt.compare(password, result[0].password, function (bcryptErr, bcryptResult) {
                    if (bcryptErr) {
                        return res.status(400).json({ success: false, message: bcryptErr.message });
                    }

                    if (bcryptResult) {
                        const accessToken = jwt.sign({ username: email }, process.env.APP_SECRET_KEY, { expiresIn: process.env.SECRET_KEY_EXP });
                        const refreshToken = jwt.sign({ username: email }, process.env.APP_REFRESH_KEY, { expiresIn: process.env.REFRESH_KEY_EXP });

                        return res.status(200).json({
                            success: true,
                            message: "Login Successfully",
                            userDetails: result[0],
                            accessToken: accessToken,
                            refreshToken: refreshToken
                        });
                    } else {
                        return res.status(400).json({ success: false, message: "Invalid password!" });
                    }
                });
            } else {
                return res.status(400).json({ success: false, message: "Email is not valid!" });
            }
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'An error occurred' });
    }
};

exports.loginWeb = (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        // user Role based bellow commented
        const userRole = req.body.userRole;

        const query = 'SELECT * FROM users WHERE email = ? AND userRole = ?';

        // const query = 'SELECT * FROM users WHERE email = ?';
        sql.query(query, [email, userRole], function (err, result) {
            if (err) return res.status(400).json({ success: false, message: err.message });

            if (result.length > 0) {
                // Compare the entered password with the stored hash
                bcrypt.compare(password, result[0].password, function (bcryptErr, bcryptResult) {
                    if (bcryptErr) {
                        return res.status(400).json({ success: false, message: bcryptErr.message });
                    }

                    if (bcryptResult) {
                        const accessToken = jwt.sign({ username: email }, process.env.APP_SECRET_KEY, { expiresIn: process.env.SECRET_KEY_EXP });
                        const refreshToken = jwt.sign({ username: email }, process.env.APP_REFRESH_KEY, { expiresIn: process.env.REFRESH_KEY_EXP });

                        return res.status(200).json({
                            success: true,
                            message: "Login Successfully",
                            userDetails: result[0],
                            accessToken: accessToken,
                            refreshToken: refreshToken
                        });
                    } else {
                        return res.status(400).json({ success: false, message: "Invalid password!" });
                    }
                });
            } else {
                return res.status(400).json({ success: false, message: "Email is not valid!" });
            }
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'An error occurred' });
    }
};



exports.refreshToken = (req, res) => {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) return res.status(400).json({ message: "Please send refresh token!" });

    // Validate the refresh token (verify signature, expiration, etc.)
    jwt.verify(refreshToken, process.env.APP_REFRESH_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: 'Invalid refresh token' });

        const accessToken = jwt.sign({ username: decoded.username }, 'secret-key', { expiresIn: '1h' });

        return res.status(200).json({
            success: true,
            userEmail: decoded.username,
            accessToken: accessToken
        });
    });
};



exports.index = (req, res) => {
    const token = (req.headers['authorization'] || req.headers['Authorization'])?.split(' ')[1];
    res.send(token);
}