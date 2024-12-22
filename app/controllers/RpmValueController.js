const { connection, CustomError } = require('../config/dbSql2');
const utility = require('../utility/utilityFunction');
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');


exports.RpmValueShow = async (req, res) => {
    try {
        const [rows] = await connection.execute(`SELECT * FROM rpmwatts_table`, []);

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "RPM SHOW DATA",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}


exports.store = async (req, res) => {
    try {
        const { rpm, watts } = req.body;


        const [rows, fields] = await connection.execute(`SELECT * FROM rpmwatts_table WHERE rpm = ? AND watts = ?`, [rpm, watts]);

        if (rows.length > 0) {
            return res.status(400).json({ success: false, message: "rpm watts value is already exists!" });
        }

        const storeDeviceQuery = 'INSERT INTO rpmwatts_table (rpm, watts) VALUES (?, ?)';
        const deviceValues = [rpm, watts];

        const [rpmRows] = await connection.execute(storeDeviceQuery, deviceValues);

        if (rpmRows.affectedRows > 0) {

            return res.status(200).json({ success: true, message: "RPM WATTS added successfully" });

        } else {
            throw new CustomError("Something went wrong!");
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};

exports.delete = async (req, res) => {
    try {
        const id = req.params.id;

        const [fRows] = await connection.execute(`SELECT * FROM rpmwatts_table WHERE id = ?`, [id]);

        if (fRows.length == 0) {
            throw new CustomError("Device Types not found!", 404);
        }

        const [DRows] = await connection.execute(`DELETE from rpmwatts_table WHERE id = ?`, [id]);

        return res.status(200).json({ success: true, message: "Successfully deleted" });

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}

exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        const { rpm, watts } = req.body;


        const [fRows] = await connection.execute(`SELECT * FROM rpmwatts_table WHERE id = ?`, [id]);

        if (fRows.length == 0) {
            throw new CustomError("Device not found!", 404);
        }

        let updateQuery = `UPDATE rpmwatts_table SET rpm = ?, watts = ? WHERE id = ?`;
        let values = [rpm, watts, id];

        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Successfully updated" });
        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};

