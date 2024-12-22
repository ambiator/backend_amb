const { connection, CustomError } = require('../../config/dbSql2');
const cron = require('node-cron');
const moment = require('moment-timezone');

exports.dataPush = async (req, res) => {
    cron.schedule('0 * * * * ', async () => {
        try {
            // const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');
            //Previous Hour
            const dateTime = moment().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
            const currentDate = moment().format('YYYY-MM-DD');
            const previousHour = moment().subtract(1, 'hours').format('hA');

            const [rows] = await connection.execute(
                `SELECT * FROM device_data WHERE DATE(dateTime) = ? AND HR = ?`,
                [currentDate, previousHour]
            );

            if (rows.length > 0) {

                const deviceId = rows[0].deviceId;
                const hour = rows[0].HR;
                const lstOutTemp = rows[rows.length - 1].outTemp;
                const lstOutHum = rows[rows.length - 1].outHum;
                const lstSupply = rows[rows.length - 1].supply;
                const lstSetPoint = rows[rows.length - 1].setPoint;

                let totalTKW = 0;
                let totalTWU = 0;

                rows.forEach(row => {
                    const TKW = parseFloat(row.TKW);
                    const TWU = parseFloat(row.TWU);
                    totalTKW += TKW;
                    totalTWU += TWU;
                });

                const rowCount = rows.length;
                const averageTKW = totalTKW / rowCount;
                const averageTWU = totalTWU / rowCount;

                const insertQuery = `
                    INSERT INTO device_data_summary (deviceId, HR, outTemp, outHum, supply, setPoint, TKW, TWU, dateTime)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const result = await connection.execute(insertQuery,
                    [deviceId, hour, lstOutTemp, lstOutHum, lstSupply, lstSetPoint, averageTKW, averageTWU, dateTime]);

                // if (result.affectedRows > 0) {
                return res.status(200).json({ success: true, message: "Successfully Added" });
                // }

            } else {
                return res.status(404).json({ success: false, message: "No data found for the previous hour" });
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message || "Internal server error" });
        }
    });
};






