const { connection, CustomError } = require('../config/dbSql2');



exports.showData = async (req, res) => {
    try {
        const [rows] = await connection.execute(`SELECT * FROM customers`, []);

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Customer list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}