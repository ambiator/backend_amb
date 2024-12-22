const { connection, CustomError } = require('../config/dbSql2');
const utility = require('../utility/utilityFunction');
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');


exports.EnergyGhgCalculationShow = async (req, res) => {
    try {
        const [rows] = await connection.execute(
            `SELECT energy_ghg_calculation.*, device_types.deviceType, device_types.id as deviceTypeId
                FROM energy_ghg_calculation
                INNER JOIN device_types ON device_types.id = energy_ghg_calculation.deviceType`,
            []
        );

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Energy Ghg Calculation list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}


//not complete logic
exports.store = async (req, res) => {
    try {
        const ghgData = req.body;


        // const [rows, fields] = await connection.execute(`SELECT * FROM energy_ghg_calculation WHERE deviceType = ?`, [ghgData.deviceType]);

        // if (rows.length > 0) {
        //     return res.status(400).json({ success: false, message: "Device Type is already exists!" });
        // }

        const storeDeviceQuery = `INSERT INTO energy_ghg_calculation (startDate, countryCode, deviceType, motorType, 
            GHGe, defaultEnergyUse) VALUES (?, ?, ?, ?, ?, ?)`;

        const deviceValues = [ghgData.startDate, ghgData.countryCode, ghgData.deviceType, ghgData.motorType, ghgData.GHGe, ghgData.defaultEnergyUse];

        const [deviceRows] = await connection.execute(storeDeviceQuery, deviceValues);

        if (deviceRows.affectedRows > 0) {

            return res.status(200).json({ success: true, message: "Device GHG Factor Added Successfully" });

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

        const [fRows] = await connection.execute(`SELECT * FROM energy_ghg_calculation WHERE id = ?`, [id]);

        if (fRows.length == 0) {
            throw new CustomError("Device Types not found!", 404);
        }

        const [DRows] = await connection.execute(`DELETE from energy_ghg_calculation WHERE id = ?`, [id]);

        return res.status(200).json({ success: true, message: "Successfully deleted" });

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}

exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        const ghgData = req.body;


        const [fRows] = await connection.execute(`SELECT * FROM energy_ghg_calculation WHERE id = ?`, [id]);

        if (fRows.length == 0) {
            throw new CustomError("Device not found!", 404);
        }

        let updateQuery = `UPDATE energy_ghg_calculation SET startDate = ?, countryCode = ?, deviceType = ?, 
        motorType = ?, GHGe = ?, defaultEnergyUse = ? WHERE id = ?`;

        let values = [ghgData.startDate, ghgData.countryCode, ghgData.deviceType, ghgData.motorType, ghgData.GHGe, ghgData.defaultEnergyUse, id];

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


