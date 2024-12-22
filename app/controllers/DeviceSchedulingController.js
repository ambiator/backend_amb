const { connection, CustomError } = require('../config/dbSql2');
const utility = require('../utility/utilityFunction');
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');
/*
exports.DeviceScheduleList = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode; // assuming the header is 'companycode'

        const deviceId = req.body.deviceId;



        const [rows] = await connection.execute(
            `SELECT * FROM deviceschedule WHERE  deviceId = ?`,
            [deviceId]
        );

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Device Schedule list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}
*/
/*
// last worked curret frajwal keerthing change api
exports.DeviceScheduleList = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode; // assuming the header is 'companycode'
        const deviceId = req.body.deviceId;

        const [rows] = await connection.execute(
            `SELECT * FROM deviceschedule WHERE  deviceId = ?`,
            [deviceId]
        );

        if (rows.length >= 0) {
            const { id, deviceID, afiliatecode, useSchedulerState, ...data } = rows[0];

            const responseObject = {
                success: true,
                message: "Device Schedule list",
                id,
                deviceID,
                afiliatecode,
                useSchedulerState,
                data,
            };

            return res.status(200).json(responseObject);
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}*/


//app side schedule response
exports.DeviceScheduleList = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode;
        const deviceId = req.body.deviceId;

        const [rows] = await connection.execute(
            `SELECT * FROM deviceschedule WHERE deviceId = ?`,
            [deviceId]
        );

        if (rows.length > 0) {
            const { id, deviceID, afiliatecode, useSchedulerState, ...data } = rows[0];

            // Convert boolean values to true or false
            const transformedData = {
                ...data,

                MonSchedule: data.MonSchedule === 1,
                TueSchedule: data.TueSchedule === 1,
                WedSchedule: data.WedSchedule === 1,
                ThuSchedule: data.ThuSchedule === 1,
                FriSchedule: data.FriSchedule === 1,
                SatSchedule: data.SatSchedule === 1,
                SunSchedule: data.SunSchedule === 1,
            };

            const responseObject = {
                success: true,
                message: "Device Schedule list",
                id,
                deviceID,
                afiliatecode,
                useSchedulerState: useSchedulerState === 1,
                data: transformedData,
            };

            return res.status(200).json(responseObject);
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};

//web side response

exports.WebDeviceScheduleList = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode;
        const deviceId = req.body.deviceId;

        const [rows] = await connection.execute(
            `SELECT * FROM deviceschedule WHERE deviceId = ?`,
            [deviceId]
        );

        if (rows.length > 0) {
            const { id, deviceID, afiliatecode, useSchedulerState, ...data } = rows[0];

            // Convert boolean values to true or false
            const transformedData = {
                Mon: { schedule: data.MonSchedule === 1, startTime: data.MonStartTime, endTime: data.MonEndTime },
                Tue: { schedule: data.TueSchedule === 1, startTime: data.TueStartTime, endTime: data.TueEndTime },
                Wed: { schedule: data.WedSchedule === 1, startTime: data.WedStartTime, endTime: data.WedEndTime },
                Thu: { schedule: data.ThuSchedule === 1, startTime: data.ThuStartTime, endTime: data.ThuEndTime },
                Fri: { schedule: data.FriSchedule === 1, startTime: data.FriStartTime, endTime: data.FriEndTime },
                Sat: { schedule: data.SatSchedule === 1, startTime: data.SatStartTime, endTime: data.SatEndTime },
                Sun: { schedule: data.SunSchedule === 1, startTime: data.SunStartTime, endTime: data.SunEndTime }
            };

            const responseObject = {
                success: true,
                message: "Device Schedule list",
                id,
                deviceID,
                afiliatecode,
                useSchedulerState: useSchedulerState === 1,
                data: transformedData,
            };

            return res.status(200).json(responseObject);
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};





/* 
exports.DeviceScheduleList = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode; // assuming the header is 'companycode'

        const deviceId = req.body.deviceId;

        const [rows] = await connection.execute(
            `SELECT * FROM deviceschedule WHERE  deviceId = ?`,
            [deviceId]
        );

        if (rows.length > 0) {
            const scheduleData = {
                success: true,
                message: "Device Schedule list",
                DeviceID: rows[0].DeviceID,
                useSchedulerState: rows[0].useSchedulerState,
                data: []
            };

            // Extract schedule data for each day
            const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            daysOfWeek.forEach(day => {
                const dayData = {
                    [`${day}Schedule`]: rows[0][`${day}Schedule`],
                    [`${day}StartTime`]: rows[0][`${day}StartTime`],
                    [`${day}EndTime`]: rows[0][`${day}EndTime`]
                };
                scheduleData.data.push(dayData);
            });

            return res.status(200).json(scheduleData);
        } else {
            return res.status(404).json({
                success: false,
                message: "Device not found"
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}


*/
exports.controlUseSchedular = async (req, res) => {
    try {
        const deviceId = req.body.deviceId;
        // const afiliateCode = req.headers.afiliatecode;
        const useSchedulerState = req.body.useSchedulerState;

        // Set the timezone to Kolkata

        const [fRows] = await connection.execute(`SELECT * FROM deviceschedule WHERE deviceID = ?`, [deviceId]);

        if (fRows.length == 0) {
            throw new CustomError("Device schedule not found!", 404);
        }

        const updateQuery = `UPDATE deviceschedule SET useSchedulerState = ? WHERE deviceID = ?`;
        const values = [useSchedulerState, deviceId];


        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Scheduler state updated successfully" });
        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};


exports.controlWeekDaySchedular = async (req, res) => {
    try {
        const deviceId = req.body.deviceId;
        // const afiliateCode = req.headers.afiliatecode;
        const useSchedulerState = req.body.useSchedulerState;

        // Extract the schedule data from the request body
        const {
            MonSchedule,
            MonStartTime,
            MonEndTime,
            TueSchedule,
            TueStartTime,
            TueEndTime,
            WedSchedule,
            WedStartTime,
            WedEndTime,
            ThuSchedule,
            ThuStartTime,
            ThuEndTime,
            FriSchedule,
            FriStartTime,
            FriEndTime,
            SatSchedule,
            SatStartTime,
            SatEndTime,
            SunSchedule,
            SunStartTime,
            SunEndTime
        } = req.body;

        /*
                // if (
                //     MonSchedule == null ||
                //     TueSchedule == null ||
                //     WedSchedule == null ||
                //     ThuSchedule == null ||
                //     FriSchedule == null ||
                //     SunSchedule == null ||
                //     SatSchedule == null ||
                //     MonStartTime === "00:00:00" ||
                //     MonEndTime === "00:00:00" ||
                //     TueStartTime === "00:00:00" ||
                //     TueEndTime === "00:00:00" ||
                //     WedStartTime === "00:00:00" ||
                //     WedEndTime === "00:00:00" ||
                //     ThuStartTime === "00:00:00" ||
                //     ThuEndTime === "00:00:00" ||
                //     FriStartTime === "00:00:00" ||
                //     FriEndTime === "00:00:00" ||
                //     SatStartTime === "00:00:00" ||
                //     SatEndTime === "00:00:00" ||
                //     SunStartTime === "00:00:00" ||
                //     SunEndTime === "00:00:00"
                // ) {
                //     // If any condition is true, return without proceeding with the update
                //     return res.status(400).json({ success: false, message: "Invalid schedule data" });
                // }
        */

        // Set the timezone to Kolkata
        const [fRows] = await connection.execute(`SELECT * FROM deviceschedule WHERE deviceID = ?`, [deviceId]);
        // const [fRows] = await connection.execute(`SELECT * FROM deviceschedule WHERE deviceID = ? AND afiliateCode = ?`, [deviceId, afiliateCode]);

        if (fRows.length === 0) {
            throw new CustomError("Device schedule not found!", 404);
        }

        const updateQuery = `
            UPDATE deviceschedule
            SET
                MonSchedule = ?,
                MonStartTime = ?,
                MonEndTime = ?,
                TueSchedule = ?,
                TueStartTime = ?,
                TueEndTime = ?,
                WedSchedule = ?,
                WedStartTime = ?,
                WedEndTime = ?,
                ThuSchedule = ?,
                ThuStartTime = ?,
                ThuEndTime = ?,
                FriSchedule = ?,
                FriStartTime = ?,
                FriEndTime = ?,
                SatSchedule = ?,
                SatStartTime = ?,
                SatEndTime = ?,
                SunSchedule = ?,
                SunStartTime = ?,
                SunEndTime = ?
            WHERE deviceID = ?`;
        // WHERE deviceID = ? AND afiliateCode = ?`;
        const values = [
            MonSchedule, MonStartTime, MonEndTime,
            TueSchedule, TueStartTime, TueEndTime,
            WedSchedule, WedStartTime, WedEndTime,
            ThuSchedule, ThuStartTime, ThuEndTime,
            FriSchedule, FriStartTime, FriEndTime,
            SatSchedule, SatStartTime, SatEndTime,
            SunSchedule, SunStartTime, SunEndTime,
            deviceId,
            // afiliateCode
        ];

        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Scheduler state updated successfully" });
        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};


exports.updateDayScheduleState = async (req, res) => {
    try {
        const deviceId = req.body.deviceId;
        // const afiliateCode = req.headers.afiliatecode;

        // Extract the schedule data from the request body
        const {
            MonSchedule,
            TueSchedule,
            WedSchedule,
            ThuSchedule,
            FriSchedule,
            SatSchedule,
            SunSchedule
        } = req.body;

        // Update the schedule in the database
        const updateQuery = `
            UPDATE deviceschedule
            SET
                MonSchedule = ?,
                TueSchedule = ?,
                WedSchedule = ?,
                ThuSchedule = ?,
                FriSchedule = ?,
                SatSchedule = ?,
                SunSchedule = ?
            WHERE deviceID = ?`;

        const values = [
            MonSchedule,
            TueSchedule,
            WedSchedule,
            ThuSchedule,
            FriSchedule,
            SatSchedule,
            SunSchedule,
            deviceId,
            // afiliateCode
        ];

        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Scheduler state updated successfully" });
        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};



