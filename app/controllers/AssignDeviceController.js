const { connection, CustomError } = require('../config/dbSql2');
const utility = require('../utility/utilityFunction');
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');


exports.NotAssignedDeviceList = async (req, res) => {
    try {
        const [rows] = await connection.execute(`SELECT deviceId, id FROM devices WHERE afiliateCode = 'AMBIAFCODE'`, []);

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Not INSTALLED DeviceList list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}

exports.costumerDropDownList = async (req, res) => {
    try {
        const [rows] = await connection.execute(`SELECT companyName, id,email,userName,companyName FROM users`, []);

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "customer list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}


exports.AssignDevice = async (req, res) => {
    try {
        const { customerId, deviceId, invNo, invDate, simProvider, simCardNo } = req.body;

        // console.log("customerId, deviceId", customerId, deviceId)
        // Validate inputs
        if (!customerId || !deviceId) {
            throw new CustomError("customerId and deviceId are required", 400);
        }


        // Fetch customer details
        const [customerRows] = await connection.execute(`SELECT * FROM users WHERE id = ?`, [customerId]);

        if (customerRows.length === 0) {
            throw new CustomError("Customer not found!", 404);
        }

        const affiliateCode = customerRows[0].afiliateCode;

        // Update device with affiliate code
        const updateQuery = `UPDATE devices SET afiliateCode = ?, invNo = ?, invDate = ?, 4gProvider = ?, simCardNo = ?  WHERE id = ?`;

        // 
        const updateValues = [affiliateCode, invNo, invDate, simProvider, simCardNo, deviceId];

        const [updateResult] = await connection.execute(updateQuery, updateValues);

        if (updateResult.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Device assigned successfully" });
        } else {
            throw new CustomError("Failed to assign device");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};
