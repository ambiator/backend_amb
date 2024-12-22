const { connection, CustomError } = require('../config/dbSql2');
const utility = require('../utility/utilityFunction');
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');


exports.deviceTypeShow = async (req, res) => {
    try {
        const [rows] = await connection.execute(`SELECT id,deviceType FROM device_types`, []);

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Device Type list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}

exports.showData = async (req, res) => {
    try {
        const [rows] = await connection.execute(`SELECT * FROM device_types`, []);

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Device Type list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}

exports.store = async (req, res) => {
    try {
        const deviceTypeData = req.body;


        const [rows, fields] = await connection.execute(`SELECT * FROM device_types WHERE deviceType = ?`, [deviceTypeData.deviceType]);

        if (rows.length > 0) {
            return res.status(400).json({ success: false, message: "Device Type is already exists!" });
        }

        const storeDeviceQuery = 'INSERT INTO device_types (deviceType) VALUES (?)';
        const deviceValues = [deviceTypeData.deviceType];

        const [deviceRows] = await connection.execute(storeDeviceQuery, deviceValues);

        if (deviceRows.affectedRows > 0) {

            return res.status(200).json({ success: true, message: "Device Type added successfully" });

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

        const [fRows] = await connection.execute(`SELECT * FROM device_types WHERE id = ?`, [id]);

        if (fRows.length == 0) {
            throw new CustomError("Device Types not found!", 404);
        }

        const [DRows] = await connection.execute(`DELETE from device_types WHERE id = ?`, [id]);

        return res.status(200).json({ success: true, message: "Successfully deleted" });

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}

exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        const deviceType = req.body;


        const [fRows] = await connection.execute(`SELECT * FROM device_types WHERE id = ?`, [id]);

        if (fRows.length == 0) {
            throw new CustomError("Device not found!", 404);
        }

        let updateQuery = `UPDATE device_types SET deviceType = ? WHERE id = ?`;
        let values = [deviceType.deviceType, id];

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

