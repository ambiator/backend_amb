const { connection, CustomError } = require('../config/dbSql2');
const mqtt = require('mqtt');
const moment = require('moment-timezone');

// Function to convert day name to number
function convertDayToNumber(dayName) {
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayNumber = daysOfWeek.indexOf(dayName);

    // If dayName is not found in the array, return -1 or handle it accordingly
    // Otherwise, return the dayNumber + 1 (adjusting for 1-based indexing)
    return (dayNumber !== -1) ? dayNumber + 1 : -1;
}

exports.ScheduleSelfHeal = async (req, res) => {
    try {
        const selfHealDetails = req.body;
        const deviceId = selfHealDetails.deviceId;
        const selfHealTime = selfHealDetails.selfHealTime;
        // const dayOfWeek = selfHealDetails.dayOfWeek;
        const dayOfWeek = convertDayToNumber(selfHealDetails.dayOfWeek); // Convert day name to number

        // Set the timezone to Kolkata
        const kolkataTimezone = 'Asia/Kolkata';
        const dateTime = moment().tz(kolkataTimezone).format('YYYY-MM-DD HH:mm:ss');


        const [fRows] = await connection.execute(`SELECT * FROM devices WHERE deviceId = ?`, [deviceId]);

        if (fRows.length == 0) {
            throw new CustomError("Device not found!", 404);
        }


        const updateQuery = `UPDATE self_heal_schedule SET  selfHealTime = ?, dayOfWeek = ? WHERE deviceId = ?`;
        const values = [selfHealTime, dayOfWeek, deviceId];

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




const convertDatabaseDataToCron = (selfHealTime, dayOfWeek) => {
    try {
        // Check if selfHealTime is undefined or null
        if (selfHealTime === undefined || selfHealTime === null) {
            // Handle the case where selfHealTime is not provided
            throw new Error('Invalid selfHealTime: undefined or null');
        }

        // Split time into hour, minute, and second
        const timeParts = selfHealTime.split(':');

        // Check if timeParts is a valid array with at least hour and minute
        if (timeParts.length < 2) {
            // Handle the case where time format is invalid
            throw new Error('Invalid time format: ' + selfHealTime);
        }

        const [hour, minute] = timeParts.slice(0, 2); // Take only the first two parts

        // Construct cron expression
        const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
        return cronExpression;
    } catch (error) {
        console.error(error.message);
        return null; // or handle it in a way that makes sense for your application
    }
};


/*
exports.ScheduleSelfHealTest = async (req, res) => {
    try {
        const query = 'SELECT selfHealTime, dayOfWeek, deviceId FROM self_heal_schedule';
        const result = await connection.query(query);

        console.log('selfHealTime:', row.selfHealTime);
        console.log('dayOfWeek:', row.dayOfWeek);

        // result.forEach((row) => {
        //     const cronExpression = convertDatabaseDataToCron(row.selfHealTime, row.dayOfWeek);
        //     console.log('Cron Expression:', cronExpression);
        // })
    } catch (err) {
        console.error('Error in ScheduleSelfHeal:', err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};*/

exports.ScheduleSelfHealTest = async (req, res) => {
    try {
        const query = 'SELECT * FROM self_heal_schedule';
        const [rows] = await connection.execute(query);

        rows.forEach((row) => {
            const selfHealTime = row.selfHealTime;  // Assuming selfHealTime is the first column
            const dayOfWeek = row.dayOfWeek;     // Assuming dayOfWeek is the second column

            console.log('selfHealTime:', selfHealTime);
            console.log('dayOfWeek:', dayOfWeek);

            // Uncomment the following lines if you want to log the cron expression
            const cronExpression = convertDatabaseDataToCron(selfHealTime, dayOfWeek);
            console.log('Cron Expression:', cronExpression);
        });
    } catch (err) {
        console.error('Error in ScheduleSelfHeal:', err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};

// exports.SelfHealDateTimeShow = async (req, res) => {
//     try {
//         const selfHealDevice = req.body;
//         const deviceId = selfHealDevice.deviceId;

//         const [rows] = await connection.execute(`SELECT * FROM self_heal_schedule`, []);

//         if (rows.length >= 0) {
//             return res.status(200).json({
//                 success: true,
//                 message: "Device list",
//                 data: rows
//             });
//         }
//     } catch (err) {
//         return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
//     }
// }

exports.SelfHealDateTimeShow = async (req, res) => {
    try {
        const selfHealDevice = req.body;
        const deviceId = selfHealDevice.deviceId;

        const [rows] = await connection.execute(
            `SELECT
                deviceId,
                CASE
                    WHEN dayOfWeek = 7 THEN 'Sunday'
                    WHEN dayOfWeek = 1 THEN 'Monday'
                    WHEN dayOfWeek = 2 THEN 'Tuesday'
                    WHEN dayOfWeek = 3 THEN 'Wednesday'
                    WHEN dayOfWeek = 4 THEN 'Thursday'
                    WHEN dayOfWeek = 5 THEN 'Friday'
                    WHEN dayOfWeek = 6 THEN 'Saturday'
                    ELSE 'Unknown Day'
                END AS dayOfWeek,
                TIME_FORMAT(selfHealTime, '%H:%i') AS selfHealTime
            FROM
                self_heal_schedule
            WHERE
                deviceId = ?;`,
            [deviceId]
        );

        if (rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Device Self Heal Schedule details",
                data: rows
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "Device details not found for the specified deviceId."
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};

