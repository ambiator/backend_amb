const { connection, CustomError } = require('../../config/dbSql2');
const cron = require('node-cron');
const moment = require('moment-timezone');

exports.alertLog = async (req, res) => {
    cron.schedule('0 * * * * *', async () => {
        try {

            const currentDate = moment().format('DD-MM-YYYY');
            const currentTime = moment().format('HH:mm:ss');
            let query, queryParams, rows;

            query = `SELECT deviceId FROM devices`;
            queryParams = [];
            const [deviceRows] = await connection.execute(query, queryParams);
            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

            [rows] = await connection.execute(`
                    SELECT 
                        dst.id, dst.deviceId,  dt.id AS deviceTypeId, dt.deviceType, d.isActive,
                        dst.pump, dst.water, dst.waterSupply, dst.filterPresent, dst.filterClean, dst.flag
                    FROM 
                        devicestatus dst
                    JOIN
                        devices d ON d.deviceId = dst.deviceId 
                    JOIN
                        customers c ON c.afiliateCode = d.afiliateCode 
                    JOIN
                    device_types dt ON d.device_type = dt.id    
                    JOIN 
                        (
                            SELECT 
                                deviceId, 
                                MAX(id) as maxId
                            FROM 
                                devicestatus
                            WHERE 
                                deviceId IN ('${deviceIds}')
                            GROUP BY 
                                deviceId
                        ) latest 
                    ON 
                        dst.deviceId = latest.deviceId 
                        AND dst.id = latest.maxId
                    WHERE
                        dst.flag = 0  
                    ORDER BY 
                        dst.id DESC;
                `);


            // Define possible alert types and their corresponding conditions
            const alertTypes = [
                { condition: row => Number(row.isActive) === 0, message: 'Unit is OFF' },
                { condition: row => Number(row.pump) === 1 || Number(row.water) === 1 || Number(row.waterSupply) === 1, message: 'No Source Water' },
                { condition: row => Number(row.filterPresent) === 1 || Number(row.filterClean) === 1, message: 'Filter Missing' },
                { condition: row => Number(row.comm) === 1, message: 'Communication Down' }
            ];

            // Iterate through the rows to check conditions and set the status message
            for (const row of rows) {
                // console.log('Processing row:', row); // Debug: Log the row being processed
                let statusMessage = "All Ok"; // Default message
                for (const alertType of alertTypes) {
                    if (alertType.condition(row)) {
                        statusMessage = alertType.message;
                        // console.log('Condition met for alertType:', 'Message:', statusMessage); // Debug: Log the condition met
                        break; // Exit the loop once a condition is met
                    }
                }

                const insertQuery = `
                    INSERT INTO alert_info_log (deviceId, devicestatusId, deviceTypeId, status, date, time)
                     VALUES (?, ?, ?, ?, ?, ?)
                `;

                const [result] = await connection.execute(insertQuery,
                    [row.deviceId, row.id, row.deviceTypeId, statusMessage, currentDate, currentTime]);

                if (result.affectedRows > 0) {
                    // console.log('Successfully Added'); // Debug: Log successful insertion
                }
                await connection.execute(
                    `UPDATE devicestatus SET flag = 1 WHERE id = ?`,
                    [row.id]
                );
            }
            // return res.status(200).json({ success: true, message: "Successfully processed all rows" });
        } catch (err) {
            console.error(err);
            return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
        }
    });
};