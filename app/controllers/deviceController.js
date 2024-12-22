const { connection, CustomError } = require('../config/dbSql2');
const utility = require('../utility/utilityFunction');
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');




/*
exports.store = async (req, res) => {
    try {
        const device = req.body;
        const afiliateCode = req.headers.afiliatecode;
        //INITIAL DEVICE SETTINGS VALUE
        const autoModeState = 1;
        const autoFanSpeed = 100;
        const autoHum = 0;
        const manualFanSpeed = 30;
        const iosFanSpeed = 30;
        const setPointValue = 25;
        const iosHum = 0;
      


       
        // Set the timezone to Kolkata
        const kolkataTimezone = 'Asia/Kolkata';
        const dateTime = moment().tz(kolkataTimezone).format('YYYY-MM-DD HH:mm:ss');


        const [rows, fields] = await connection.execute(`SELECT * FROM devices WHERE deviceId = ? AND afiliateCode = ?`, [device.deviceId, afiliateCode]);

        if (rows.length > 0) {
            return res.status(400).json({ success: false, message: "Device is already exists!" });
        }

        const locationString = JSON.stringify(device.location);

        console.log("afiliateCode:", afiliateCode);
        console.log("device.deviceId:", device.deviceId);
        console.log("device.deviceName:", device.deviceName);
        console.log("device.ssId:", device.ssId);
        console.log("device.wifiPassword:", device.wifiPassword);
        console.log("device.device_type:", device.device_type);
        console.log("device.serialNumber:", device.serialNumber);
        console.log("locationString:", locationString);
        console.log("device.floorName:", device.floorName);
        console.log("dateTime:", dateTime);
        console.log("manualFanSpeed:", manualFanSpeed);
        console.log("iosFanSpeed:", iosFanSpeed);
        const storeDeviceQuery = 'INSERT INTO devices (afiliateCode, deviceId, deviceName, ssId, wifiPassword,device_type, serial_number, location,floorName, setPointValue, dateTime,autoModeState, manualFanSpeed,iosFanSpeed,autoFanSpeed,iosHum,autoHum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? , ? , ?)';
        const deviceValues = [afiliateCode, device.deviceId, device.deviceName, device.ssId, device.wifiPassword,
             device.device_type, device.serialNumber, locationString, device.floorName, setPointValue,
             dateTime,autoModeState, manualFanSpeed, iosFanSpeed,autoFanSpeed,
             iosHum,autoHum];

        const [deviceRows] = await connection.execute(storeDeviceQuery, deviceValues);

        if (deviceRows.affectedRows > 0) {
            // Device added successfully, now insert into deviceschedule table
            const storeScheduleQuery = `INSERT INTO deviceschedule (DeviceID,dId, afiliatecode, MonStartTime, MonEndTime, TueStartTime, TueEndTime, WedStartTime, WedEndTime, ThuStartTime, ThuEndTime, FriStartTime, FriEndTime, SatStartTime, SatEndTime, SunStartTime, SunEndTime) VALUES (?,?,?,'09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000')`;

            const scheduleValues = [device.deviceId, deviceRows.insertId, afiliateCode];
            const [scheduleRows] = await connection.execute(storeScheduleQuery, scheduleValues);

            // Initial self_heal_schedule add
            const storeSelfHealScheduleQuery = `INSERT INTO self_heal_schedule (deviceId, dId, selfHealTime, dayOfWeek, sh_status) VALUES (?, ?, '05:00:00.0000000', 1, '0')`;
            console.log("deviceRows.id", deviceRows.id);
            const selfHealValues = [device.deviceId, deviceRows.insertId];
            const [selfHealRows] = await connection.execute(storeSelfHealScheduleQuery, selfHealValues);

            if (scheduleRows.affectedRows > 0 && selfHealRows.affectedRows > 0) {
                return res.status(200).json({ success: true, message: "Device and schedule added successfully" });
            } else {
                throw new CustomError("Failed to add schedule or self-heal schedule");
            }
        } else {
            throw new CustomError("Something went wrong!");
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};
*/


exports.store = async (req, res) => {
    try {
        const device = req.body;
        const afiliateCode = req.headers.afiliatecode;
        //INITIAL DEVICE SETTINGS VALUE
        const autoModeState = 1;
        const autoFanSpeed = 100;
        const autoHum = 0;
        const manualFanSpeed = 30;
        const iosFanSpeed = 30;
        const setPointValue = 25;
        const iosHum = 0;




        // Set the timezone to Kolkata
        const kolkataTimezone = 'Asia/Kolkata';
        const dateTime = moment().tz(kolkataTimezone).format('YYYY-MM-DD HH:mm:ss');


        const [rows, fields] = await connection.execute(`SELECT * FROM devices WHERE deviceId = ? AND afiliateCode = ?`, [device.deviceId, afiliateCode]);

        if (rows.length > 0) {
            return res.status(400).json({ success: false, message: "Device is already exists!" });
        }

        const locationString = JSON.stringify(device.location);

        const storeDeviceQuery = 'INSERT INTO devices (afiliateCode, deviceId, deviceName, ssId, wifiPassword,device_type, serial_number, location,floorName, setPointValue, dateTime,autoModeState, manualFanSpeed,iosFanSpeed,autoFanSpeed,iosHum,autoHum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? , ? , ?)';
        const deviceValues = [afiliateCode, device.deviceId, device.deviceName, device.ssId, device.wifiPassword,
            device.device_type, device.serialNumber, locationString, device.floorName, setPointValue,
            dateTime, autoModeState, manualFanSpeed, iosFanSpeed, autoFanSpeed,
            iosHum, autoHum];

        const [deviceRows] = await connection.execute(storeDeviceQuery, deviceValues);

        const generateRandomTime = () => {
            const hours = String(Math.floor(Math.random() * 24)).padStart(2, '0');
            const minutes = String(Math.floor(Math.random() * 60)).padStart(2, '0');
            const seconds = String(Math.floor(Math.random() * 60)).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}.0000000`;
        };

        const generateRandomDayOfWeek = () => {
            return Math.floor(Math.random() * 7) + 1;
        };

        if (deviceRows.affectedRows > 0) {
            // Device added successfully, now insert into deviceschedule table
            const storeScheduleQuery = `INSERT INTO deviceschedule (DeviceID,dId, afiliatecode, MonStartTime, MonEndTime, TueStartTime, TueEndTime, WedStartTime, WedEndTime, ThuStartTime, ThuEndTime, FriStartTime, FriEndTime, SatStartTime, SatEndTime, SunStartTime, SunEndTime) VALUES (?,?,?,'09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000', '09:00:00.0000000', '18:00:00.0000000')`;

            const scheduleValues = [device.deviceId, deviceRows.insertId, afiliateCode];
            const [scheduleRows] = await connection.execute(storeScheduleQuery, scheduleValues);

            // Generate random selfHealTime and dayOfWeek
            const randomSelfHealTime = generateRandomTime();
            const randomDayOfWeek = generateRandomDayOfWeek();

            // Initial self_heal_schedule add
            const storeSelfHealScheduleQuery = `INSERT INTO self_heal_schedule (deviceId, dId, selfHealTime, dayOfWeek, sh_status) VALUES (?, ?, ?, ?, '0')`;
            const selfHealValues = [device.deviceId, deviceRows.insertId, randomSelfHealTime, randomDayOfWeek];
            const [selfHealRows] = await connection.execute(storeSelfHealScheduleQuery, selfHealValues);

            if (scheduleRows.affectedRows > 0 && selfHealRows.affectedRows > 0) {
                return res.status(200).json({ success: true, message: "Device and schedule added successfully" });
            } else {
                throw new CustomError("Failed to add schedule or self-heal schedule");
            }
        } else {
            throw new CustomError("Something went wrong!");
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};


exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        const device = req.body;

        const afiliateCode = req.headers.afiliatecode;
        const userRole = req.headers.userrole;

        // Set the timezone to Kolkata
        const kolkataTimezone = 'Asia/Kolkata';
        const dateTime = moment().tz(kolkataTimezone).format('YYYY-MM-DD HH:mm:ss');
        const locationString = JSON.stringify(device.location);

        const [fRows] = await connection.execute(`SELECT * FROM devices WHERE id = ?`, [id]);

        if (fRows.length == 0) {
            throw new CustomError("Device not found!", 404);
        }

        let updateQuery = `UPDATE devices SET deviceId = ?, deviceName = ?, ssId = ?, wifiPassword = ?, device_type = ?, serial_number = ?, location = ?, dateTime = ?`;
        let values = [device.deviceId, device.deviceName, device.ssId, device.wifiPassword, device.device_type, device.serialNumber, locationString, dateTime];


        if (userRole != 'ambiator') {
            updateQuery += `, afiliateCode = ?`;
            values.push(afiliateCode);
        }
        updateQuery += ` WHERE id = ?`;
        values.push(id);


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




exports.delete = async (req, res) => {
    try {
        const id = req.params.id;

        const [fRows] = await connection.execute(`SELECT * FROM devices WHERE id = ?`, [id]);

        if (fRows.length == 0) {
            throw new CustomError("Device not found!", 404);
        }

        const [DRows] = await connection.execute(`DELETE from devices WHERE id = ?`, [id]);

        return res.status(200).json({ success: true, message: "Successfully deleted" });

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}




exports.show = async (req, res) => {
    try {
        const [rows] = await connection.execute(`

            SELECT devices.*, device_types.deviceType, device_types.id as deviceTypeId
            FROM devices
            INNER JOIN device_types ON device_types.id = devices.device_type
        
        `, []);

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Device list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}


exports.renderDeviceListForApp = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode; // assuming the header is 'companycode'

        const [rows] = await connection.execute(
            `SELECT devices.*, device_types.deviceType 
            FROM devices 
            JOIN device_types ON devices.device_type = device_types.id 
            WHERE devices.afiliateCode = ?
            `,
            [afiliateCode]
        );

        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Device list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}


