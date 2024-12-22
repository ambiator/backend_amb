const { connection, CustomError } = require('../../config/dbSql2');
const cron = require('node-cron');
const moment = require('moment-timezone');

exports.DeviceActiveCron = async () => {
    cron.schedule('0 * * * * *', async () => {
        try {
            // Get the current time and the time 30 minutes ago
            const currentTime = new Date();
            const thirtyMinutesAgo = new Date(currentTime.getTime() - 30 * 60000); // 30 minutes in milliseconds

            // Get devices that are currently inactive
            const [inactiveRows] = await connection.execute(
                `SELECT * FROM devices`
            );

            // Iterate over inactive devices
            for (const row of inactiveRows) {
                const deviceId = row.deviceId;
                // Check if the device has data in the last 30 minutes
                const [dataRows] = await connection.execute(
                    `SELECT * FROM device_data WHERE deviceId = ? AND updated_at >= ?`,
                    [deviceId, thirtyMinutesAgo]
                );

                if (dataRows.length === 0) {
                    // If no data is found for the last 30 minutes, update isActive to 0
                    await connection.execute(
                        `UPDATE devices SET isActive = 0, device_state = 0  WHERE deviceId = ?`,
                        [deviceId]
                    );
                } else {
                    await connection.execute(
                        `UPDATE devices SET isActive = 1 WHERE deviceId = ?`,
                        [deviceId]
                    );
                }
            }
        } catch (error) {
            console.error('Error in DeviceActiveCron:', error);
        }
    });
}