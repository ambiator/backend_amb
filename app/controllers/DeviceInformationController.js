const { connection, CustomError } = require('../config/dbSql2');
const utility = require('../utility/utilityFunction');
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');

exports.DeviceParameterInfo = async (req, res) => {
    try {
        const userRole = req.headers.userrole;
        const dType = req.body.type;
        const device = req.body.deviceId;


        let installedCount;
        let activeCount;
        let alertsCount;
        let inputEnergy;
        let avoEnergy;
        let ghgeEnergy

        let untillInputEnergy;
        let untillAvoEnergy
        let untillGhgeEnergy
        //   let alertCountRows

        if (userRole === 'ambiator') {

            //Device Count
            let query = `SELECT COUNT(*) AS deviceCount FROM devices`;
            let queryParams = [];

            if (dType) {
                query += ` WHERE device_type = ?`;
                queryParams.push(dType);
            }

            const [rows, fields] = await connection.execute(query, queryParams);
            installedCount = rows[0].deviceCount;


            // Active count logic
            let actQuery = `SELECT COUNT(*) AS activeCount FROM devices WHERE isActive = 1`;
            let actQueryParams = [];

            if (dType) {
                actQuery += ` AND device_type = ?`;
                actQueryParams.push(dType);
            }

            const [actRows, actFields] = await connection.execute(actQuery, actQueryParams);
            activeCount = actRows[0].activeCount;


            //Alert Count
            let alrtQuery = `SELECT deviceId FROM devices`;
            let alrtQueryParams = [];

            if (dType) {
                alrtQuery += ` WHERE device_type = ?`;
                alrtQueryParams.push(dType);
            }

            const [deviceRows, deviceFields] = await connection.execute(alrtQuery, alrtQueryParams);

            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly



            const [alertCountRows, alertCountFields] = await connection.execute(`
                SELECT 
                    SUM(dst.fan = 1) AS fan_count,
                    SUM(dst.pump = 1) AS pump_count,
                    SUM(dst.water = 1) AS water_count,
                    SUM(dst.filterPresent = 1) AS filterPresent_count,
                    SUM(dst.filterClean = 1) AS filterClean_count,
                    SUM(dst.waterSupply = 1) AS waterSupply_count,
                    SUM(dst.comm = 1) AS comm_count
              
                FROM 
                    devicestatus dst
                JOIN 
                    (
                        SELECT 
                            deviceId, 
                            MAX(id) AS maxId
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
                ORDER BY 
                    dst.id DESC ;
            `)

            // SUM(dst.PFF = 1) AS PFF_count,
            // SUM(dst.HUM = 1) AS HUM_count
            let alertCount;

            if (alertCountRows.length === 0) {
                alertsCount = 0;
            } else {
                // Use the returned row
                alertCount = alertCountRows[0];

                // Debugging: log the alertCount object
                // console.log('Alert Count:', alertCount);

                // Calculating total alerts count with explicit conversion to number
                alertsCount =
                    Number(alertCount.fan_count) + Number(alertCount.pump_count) + Number(alertCount.water_count) +
                    Number(alertCount.filterPresent_count) + Number(alertCount.filterClean_count) +
                    Number(alertCount.waterSupply_count) + Number(alertCount.comm_count);
                // + Number(alertCount.PFF_count) + Number(alertCount.HUM_count);
            }



            // Input Energy Today
            let TKWQuery = `
                SELECT ROUND(SUM(TKW) / COUNT(*), 2) as AverageTKW
                FROM device_data_summary
                INNER JOIN devices ON devices.deviceId = device_data_summary.deviceId
                WHERE DATE(device_data_summary.dateTime) = CURDATE()
            `;

            let TKWQueryParams = [];

            if (dType) {
                TKWQuery += ` 
                    AND devices.device_type = ?
                `;
                TKWQueryParams.push(dType);
            }



            if (dType && device) {
                TKWQuery += ` 
                    AND devices.device_type = ? AND devices.deviceId = ?
                `;
                TKWQueryParams.push(dType, device);
            }


            const [TKWrows, tkwFields] = await connection.execute(TKWQuery, TKWQueryParams);
            inputEnergy = TKWrows[0].AverageTKW;


            // Avoided Energy Today
            avoEnergy = inputEnergy - 7.5;
            avoEnergy = Math.max(avoEnergy, 0);



            // gghe Energy Today
            let ghgeQuery = `

                SELECT 
                    egc.GHGe,
                    egc.id AS gid
                FROM 
                    device_data_summary dds
                INNER JOIN 
                    devices d ON d.deviceId = dds.deviceId
                INNER JOIN 
                    energy_ghg_calculation egc ON egc.deviceType = d.device_type
                WHERE DATE(dds.dateTime) = CURDATE()
                `;


            let ghgeQueryParams = [];

            if (dType) {
                ghgeQuery += ` 
                    AND d.device_type = ?
                `;
                ghgeQueryParams.push(dType);
            }


            if (dType && device) {
                ghgeQuery += ` 
                    AND d.device_type = ? AND d.deviceId = ?
                `;
                ghgeQueryParams.push(dType, device);
            }


            // Add ORDER BY clause after any WHERE condition
            ghgeQuery += ` ORDER BY egc.id DESC`;

            const [ghgerows, ghgeFields] = await connection.execute(ghgeQuery, ghgeQueryParams);

            todayGhG = ghgerows[0]?.GHGe ?? 0;
            ghgeEnergy = avoEnergy * todayGhG;


            //Input Energy UntillNow
            let TKWallQuery = `SELECT ROUND(SUM(TKW) / COUNT(*), 2) as AverageTKW
                FROM device_data_summary `;

            let TKWallQueryParams = [];

            if (dType) {
                TKWallQuery += ` 
                  INNER JOIN devices ON devices.deviceId = device_data_summary.deviceId
                WHERE devices.device_type = ?`;

                TKWallQueryParams.push(dType);
            }


            if (dType && device) {
                TKWallQuery += ` 
                    AND devices.device_type = ? AND devices.deviceId = ?
                `;
                TKWallQueryParams.push(dType, device);
            }

            const [TKWallRows, tkwAllFields] = await connection.execute(TKWallQuery, TKWallQueryParams);
            untillInputEnergy = TKWallRows[0].AverageTKW;


            //Untill  Avoided Energy Today
            untillAvoEnergy = untillInputEnergy - 7.5;
            untillAvoEnergy = Math.max(untillAvoEnergy, 0);


            //Untill  GHGe Energy 
            let ghgeAllQuery = `
                SELECT 
                    egc.GHGe,
                    egc.id AS gid
                FROM 
                    device_data_summary dds
                INNER JOIN 
                    devices d ON d.deviceId = dds.deviceId
                INNER JOIN 
                    energy_ghg_calculation egc ON egc.deviceType = d.device_type
            `;

            let ghgeAllQueryParams = [];

            // Add WHERE clause only if dType is present
            if (dType) {
                ghgeAllQuery += ` 
                WHERE d.device_type = ?
                `;
                ghgeAllQueryParams.push(dType);
            }


            if (dType && device) {
                ghgeAllQuery += ` 
                    AND d.device_type = ? AND d.deviceId = ?
                `;
                ghgeAllQueryParams.push(dType, device);
            }

            // Add ORDER BY clause after any WHERE condition
            ghgeAllQuery += `
              ORDER BY egc.id DESC
            `;

            const [ghgeAllrows, ghgeAllFields] = await connection.execute(ghgeAllQuery, ghgeAllQueryParams);

            // untillGhG = ghgeAllrows[0].GHGe;
            untillGhG = ghgeAllrows[0]?.GHGe ?? 0;

            // gid = ghgeAllrows[0].gid;

            untillGhgeEnergy = untillAvoEnergy * untillGhG;

            // console.log("GHGE", untillGhG);


        } else if (userRole === 'customer' || userRole === 'affiliate') {

            const affiliateCode = req.headers.afiliatecode;

            //device Count
            let query = `SELECT COUNT(*) AS deviceCount FROM devices WHERE afiliateCode = ?`;
            let queryParams = [affiliateCode];

            if (dType) {
                query += ` AND device_type = ?`;
                queryParams.push(dType);
            }

            const [rows, fields] = await connection.execute(query, queryParams);
            installedCount = rows[0].deviceCount;

            // Active count logic
            let actQuery = `SELECT COUNT(*) AS activeCount FROM devices WHERE isActive = 1 AND afiliateCode = ?`;
            let actQueryParams = [affiliateCode];

            if (dType) {
                actQuery += ` AND device_type = ?`;
                actQueryParams.push(dType);
            }

            const [actRows, actFields] = await connection.execute(actQuery, actQueryParams);
            activeCount = actRows[0].activeCount;

            //Alert Count
            let alrtQuery = `SELECT deviceId FROM devices WHERE afiliateCode = ?`;
            let alrtQueryParams = [affiliateCode];

            if (dType) {
                alrtQuery += ` AND device_type = ?`;
                alrtQueryParams.push(dType);
            }

            const [deviceRows, deviceFields] = await connection.execute(alrtQuery, alrtQueryParams);

            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly


            const [alertCountRows, alertCountFields] = await connection.execute(`
                SELECT 
                    SUM(dst.fan = 1) AS fan_count,
                    SUM(dst.pump = 1) AS pump_count,
                    SUM(dst.water = 1) AS water_count,
                    SUM(dst.filterPresent = 1) AS filterPresent_count,
                    SUM(dst.filterClean = 1) AS filterClean_count,
                    SUM(dst.waterSupply = 1) AS waterSupply_count,
                    SUM(dst.comm = 1) AS comm_count

                FROM 
                    devicestatus dst
                JOIN 
                    (
                        SELECT 
                            deviceId, 
                            MAX(id) AS maxId
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
                ORDER BY 
                    dst.id DESC ;
            `)

            // SUM(dst.PFF = 1) AS PFF_count,
            // SUM(dst.HUM = 1) AS HUM_count

            let alertCount;

            if (alertCountRows.length === 0) {
                alertsCount = 0;

            } else {
                // Use the returned row
                alertCount = alertCountRows[0];

                // Debugging: log the alertCount object
                // console.log('Alert Count:', alertCount);

                // Calculating total alerts count with explicit conversion to number
                alertsCount =
                    Number(alertCount.fan_count) + Number(alertCount.pump_count) + Number(alertCount.water_count) +
                    Number(alertCount.filterPresent_count) + Number(alertCount.filterClean_count) +
                    Number(alertCount.waterSupply_count) + Number(alertCount.comm_count)
                // +Number(alertCount.PFF_count) + Number(alertCount.HUM_count);
            }


            // Input Energy Today
            let TKWQuery = `
                SELECT ROUND(SUM(TKW) / COUNT(*), 2) as AverageTKW
                 FROM device_data_summary

                INNER JOIN devices ON devices.deviceId = device_data_summary.deviceId
                  WHERE DATE(device_data_summary.dateTime) = CURDATE()
                AND devices.afiliateCode = ?
                `;

            let TKWQueryParams = [affiliateCode];

            if (dType) {
                TKWQuery += ` 
                    AND devices.device_type = ?
                `;
                TKWQueryParams.push(dType);
            }



            if (dType && device) {
                TKWQuery += ` 
                    AND devices.device_type = ? AND devices.deviceId = ?
                `;
                TKWQueryParams.push(dType, device);
            }

            const [TKWrows, tkwFields] = await connection.execute(TKWQuery, TKWQueryParams);
            inputEnergy = TKWrows[0].AverageTKW;



            // Avoided Energy Today
            avoEnergy = inputEnergy - 7.5;
            avoEnergy = Math.max(avoEnergy, 0);



            // gghe Energy Today
            let ghgeQuery = `

                SELECT 
                    egc.GHGe,
                    egc.id AS gid
                FROM 
                    device_data_summary dds
                INNER JOIN 
                    devices d ON d.deviceId = dds.deviceId
                INNER JOIN 
                    energy_ghg_calculation egc ON egc.deviceType = d.device_type
                WHERE DATE(dds.dateTime) = CURDATE() AND d.afiliateCode = ?
                `;


            let ghgeQueryParams = [affiliateCode];

            if (dType) {
                ghgeQuery += ` 
                    AND d.device_type = ?
                `;
                ghgeQueryParams.push(dType);
            }


            if (dType && device) {
                ghgeQuery += ` 
                    AND d.device_type = ? AND d.deviceId = ?
                `;
                ghgeQueryParams.push(dType, device);
            }


            // Add ORDER BY clause after any WHERE condition
            ghgeQuery += ` ORDER BY egc.id DESC `;

            const [ghgerows, ghgeFields] = await connection.execute(ghgeQuery, ghgeQueryParams);

            todayGhG = ghgerows[0]?.GHGe ?? 0;
            ghgeEnergy = avoEnergy * todayGhG;


            //Input Energy UntillNow
            let TKWallQuery = `
                SELECT ROUND(SUM(TKW) / COUNT(*), 2) as AverageTKW
                    FROM device_data_summary

                INNER JOIN devices ON devices.deviceId = device_data_summary.deviceId
                    WHERE devices.afiliateCode = ?
                `;

            let TKWallQueryParams = [affiliateCode];

            if (dType) {
                TKWallQuery += ` 
                 AND devices.device_type = ?`;

                TKWallQueryParams.push(dType);
            }



            if (dType && device) {
                TKWallQuery += ` 
                    AND devices.device_type = ? AND devices.deviceId = ?
                `;
                TKWallQueryParams.push(dType, device);
            }

            const [TKWallRows, tkwAllFields] = await connection.execute(TKWallQuery, TKWallQueryParams);
            untillInputEnergy = TKWallRows[0].AverageTKW;


            // Until Avoided Energy 
            untillAvoEnergy = (untillInputEnergy - 7.5) / 1000;
            untillAvoEnergy = Math.max(untillAvoEnergy, 0);



            // Until GHGe Energy 
            let ghgeAllQuery = `
                SELECT 
                    egc.GHGe,
                    egc.id AS gid
                FROM 
                    device_data_summary dds
                INNER JOIN 
                    devices d ON d.deviceId = dds.deviceId
                INNER JOIN 
                    energy_ghg_calculation egc ON egc.deviceType = d.device_type
                WHERE d.afiliateCode = ?    
            `;

            let ghgeAllQueryParams = [affiliateCode];

            // Add WHERE clause only if dType is present
            if (dType) {
                ghgeAllQuery += ` 
                AND d.device_type = ?
                `;
                ghgeAllQueryParams.push(dType);
            }



            if (dType && device) {
                ghgeAllQuery += ` 
                    AND d.device_type = ? AND d.deviceId = ?
                `;
                ghgeAllQueryParams.push(dType, device);
            }

            // Add ORDER BY clause after any WHERE condition
            ghgeAllQuery += ` ORDER BY egc.id DESC`;

            const [ghgeAllrows, ghgeAllFields] = await connection.execute(ghgeAllQuery, ghgeAllQueryParams);

            // untillGhG = ghgeAllrows[0].GHGe;
            untillGhG = ghgeAllrows[0]?.GHGe ?? 0;
            // gid = ghgeAllrows[0].gid;

            untillGhgeEnergy = untillAvoEnergy * untillGhG;


        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized user role' });
        }

        let locQuery = `SELECT location FROM devices WHERE afiliateCode = ?`;
        let locQueryParams = [req.headers.afiliatecode];

        if (dType) {
            locQuery += ` AND device_type = ?`;
            locQueryParams.push(dType);
        }

        const [locRows, locFields] = await connection.execute(locQuery, locQueryParams);


        // Parse location data from each row
        const locations = locRows.map(row => JSON.parse(row.location));
        const responseObject = {
            success: true,
            installedCount: installedCount,
            activeCount: activeCount,
            alertsCount: alertsCount,
            todayInputEnergy: inputEnergy,
            todayAvoidedEnergy: avoEnergy,
            TodayGhgAvoidedTonsCo2e: ghgeEnergy,
            untilInputEnergy: untillInputEnergy,
            untilAvoidedEnergy: untillAvoEnergy,
            untilGhgAvoidedTonsCo2e: untillGhgeEnergy,
            locations: locations // Include locations in the response
        };
        return res.status(200).json(responseObject);
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}












// Function to convert latitude and longitude to desired format
function convertCoordinates(latitude, longitude) {
    const latDirection = latitude >= 0 ? 'N' : 'S';
    const lonDirection = longitude >= 0 ? 'E' : 'W';
    const lat = Math.abs(latitude).toFixed(4);
    const lon = Math.abs(longitude).toFixed(4);
    return `${lat}*${latDirection}, ${lon}*${lonDirection}`;
}


exports.DeviceListInfo = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode;
        const userRole = req.headers.userrole;
        const dType = req.body.type;
        let query, queryParams;

        if (userRole === 'ambiator') {

            query = `
                SELECT 
                    customers.*, 
                    devices.*, 
                    device_types.deviceType
                FROM 
                    devices
                LEFT JOIN 
                    customers ON customers.afiliateCode = devices.afiliateCode
                LEFT JOIN 
                  device_types ON devices.device_type = device_types.id`

            // query = `
            //     SELECT customers.*, devices.*, device_types.deviceType
            //     FROM customers
            //     JOIN devices ON customers.afiliateCode = devices.afiliateCode
            //     JOIN device_types ON devices.device_type = device_types.id
            // `;


            queryParams = [];
            if (dType) {
                query += `  WHERE devices.device_type = ?`;
                queryParams.push(dType);
            }


        } else if (userRole === 'customer') {
            query = `SELECT
              d.id,
              d.location,
              d.afiliateCode,
              d.deviceId,
              d.deviceName,
              d.device_type,
              d.floorName,
              d.device_state,
              dt.deviceType,
              JSON_UNQUOTE(JSON_EXTRACT(d.location, '$.latitude')) AS latitude,
              JSON_UNQUOTE(JSON_EXTRACT(d.location, '$.longitude')) AS longitude
            FROM
              devices d
            JOIN
              device_types dt ON d.device_type = dt.id
            WHERE
             d.afiliateCode = ? AND
              d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'customer')`;

            queryParams = [afiliateCode];
            if (dType) {
                query += ` AND d.device_type = ?`;
                queryParams.push(dType);
            }


        } else if (userRole === 'affiliate') {
            query = `SELECT
              d.id,
              d.location,
              d.afiliateCode,
              d.deviceId,
              d.deviceName,
              d.device_type,
              d.floorName,
              d.device_state,
              dt.deviceType,
              JSON_UNQUOTE(JSON_EXTRACT(d.location, '$.latitude')) AS latitude,
              JSON_UNQUOTE(JSON_EXTRACT(d.location, '$.longitude')) AS longitude
            FROM
              devices d
            JOIN
              device_types dt ON d.device_type = dt.id
            WHERE
            d.afiliateCode = ? AND
              d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'affiliate')`;
            queryParams = [afiliateCode];
            if (dType) {
                query += ` AND d.device_type = ?`;
                queryParams.push(dType);
            }
        }
        else {
            return res.status(403).json({ success: false, message: 'Unauthorized user role' });
        }



        const [rows] = await connection.execute(query, queryParams);
        if (rows.length > 0) {
            // Convert latitude and longitude for each row
            rows.forEach(row => {
                row.location = convertCoordinates(row.latitude, row.longitude);
                delete row.latitude; // Remove latitude field
                delete row.longitude; // Remove longitude field
            });
            return res.status(200).json({
                success: true,
                message: "Device list",
                data: rows
            });
        } else {
            return res.status(200).json({ success: false, message: 'No devices found' });
        }


    } catch (err) {
        console.error(err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}



exports.activeInfo = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode;
        const userRole = req.headers.userrole;
        const dType = req.body.type;
        let query, queryParams;

        if (userRole === 'ambiator') {
            query = `
                SELECT  devices.*, 
                  customers.companyName, customers.userName, customers.phoneNo, customers.city,
                  device_types.deviceType
                FROM devices
                    JOIN device_types ON devices.device_type = device_types.id
                    JOIN customers ON customers.afiliateCode = devices.afiliateCode
                WHERE devices.isActive = 1    
                
            `;


            queryParams = [];
            if (dType) {
                query += ` AND devices.device_type = ?`;
                queryParams.push(dType);
            }

        } else if (userRole === 'customer') {
            query = `SELECT
              d.id,
              d.location,
              d.afiliateCode,
              d.deviceId,
              d.deviceName,
              d.device_type,
              d.floorName,
              d.device_state,
              dt.deviceType,
              customers.companyName, customers.userName, customers.phoneNo, customers.city,
              JSON_UNQUOTE(JSON_EXTRACT(d.location, '$.latitude')) AS latitude,
              JSON_UNQUOTE(JSON_EXTRACT(d.location, '$.longitude')) AS longitude
            FROM
              devices d
            JOIN
              device_types dt ON d.device_type = dt.id
            JOIN  
              customers ON customers.afiliateCode = d.afiliateCode

            WHERE
             d.isActive = 1 AND d.afiliateCode = ? AND
             d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'customer')`;

            queryParams = [afiliateCode];
            if (dType) {
                query += ` AND d.device_type = ?`;
                queryParams.push(dType);
            }


        } else if (userRole === 'affiliate') {
            query = `SELECT
              d.id,
            d.location,
              d.afiliateCode,
              d.deviceId,
              d.deviceName,
              d.device_type,
              d.floorName,
              d.device_state,
              dt.deviceType,
              customers.companyName, customers.userName, customers.phoneNo, customers.city,
              JSON_UNQUOTE(JSON_EXTRACT(d.location, '$.latitude')) AS latitude,
              JSON_UNQUOTE(JSON_EXTRACT(d.location, '$.longitude')) AS longitude
            FROM
              devices d
            JOIN
              device_types dt ON d.device_type = dt.id
            JOIN
              customers ON customers.afiliateCode = d.afiliateCode
            WHERE
               d.isActive = 1 AND d.afiliateCode = ? AND
              d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'affiliate')`;

            queryParams = [afiliateCode];
            if (dType) {
                query += ` AND d.device_type = ?`;
                queryParams.push(dType);
            }
        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized user role' });
        }

        const [rows] = await connection.execute(query, queryParams);

        // Convert latitude and longitude for each row, if any
        if (rows.length > 0) {
            rows.forEach(row => {
                row.location = convertCoordinates(row.latitude, row.longitude);
                delete row.latitude; // Remove latitude field
                delete row.longitude; // Remove longitude field
            });
        }

        return res.status(200).json({
            success: true,
            message: "Device List",
            data: rows
        });

    } catch (err) {
        console.error(err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}





// exports.alertInfo = async (req, res) => {
//     try {

//         let affiliateCode = req.headers.afiliatecode;
//         const userRole = req.headers.userrole;
//         const dType = req.body.type;
//         let query, queryParams, alertCountRows;

//         if (userRole === 'ambiator') {

//             //Alert Count
//             query = `SELECT deviceId FROM devices`;
//             queryParams = [];

//             if (dType) {
//                 query += ` WHERE device_type = ?`;
//                 queryParams.push(dType);
//             }

//             const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

//             const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

//             [alertCountRows, alertCountFields] = await connection.execute(`

//                 SELECT 
//                     dst.id, dst.deviceId, dt.deviceType, d.device_state, d.isActive,  d.location,
//                     c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode
//                 FROM 
//                     devicestatus dst

//                 JOIN
//                     devices d ON d.deviceId = dst.deviceId 
//                 JOIN
//                     customers c ON c.afiliateCode = d.afiliateCode 
//                 JOIN
//                    device_types dt ON d.device_type = dt.id    

//                 JOIN 
//                     (
//                         SELECT 
//                             deviceId, 
//                             MAX(id) as maxId
//                         FROM 
//                             devicestatus
//                         WHERE 
//                             deviceId IN ('${deviceIds}')
//                         GROUP BY 
//                             deviceId
//                     ) latest 
//                 ON 
//                     dst.deviceId = latest.deviceId 
//                     AND dst.id = latest.maxId
//                 ORDER BY 
//                     dst.id DESC;

//             `);


//         }else if (userRole === 'customer') {

//             query = `SELECT deviceId FROM devices WHERE afiliateCode = ?`;
//             queryParams = [affiliateCode];

//             if (dType) {
//                 query += ` AND device_type = ?`;
//                 queryParams.push(dType);
//             }

//             const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

//             const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

//             [alertCountRows, alertCountFields] = await connection.execute(`

//                 SELECT 
//                     dst.id, dst.deviceId, dt.deviceType, d.device_state, d.isActive, d.location,
//                     c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode
//                 FROM 
//                     devicestatus dst
//                 JOIN
//                     devices d ON d.deviceId = dst.deviceId 
//                 JOIN
//                     customers c ON c.afiliateCode = d.afiliateCode 
//                 JOIN
//                    device_types dt ON d.device_type = dt.id     

//                 JOIN 
//                     (
//                         SELECT 
//                             deviceId, 
//                             MAX(id) as maxId
//                         FROM 
//                             devicestatus
//                         WHERE 
//                             deviceId IN ('${deviceIds}')
//                         GROUP BY 
//                             deviceId
//                     ) latest 
//                 ON 
//                     dst.deviceId = latest.deviceId 
//                     AND dst.id = latest.maxId
//                 WHERE
//                     d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'customer')     
//                 ORDER BY 
//                     dst.id DESC;

//             `);


//         } else if (userRole === 'affiliate') {

//             query = `SELECT deviceId FROM devices WHERE afiliateCode = ?`;
//             queryParams = [affiliateCode];

//             if (dType) {
//                 query += ` AND device_type = ?`;
//                 queryParams.push(dType);
//             }

//             const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

//             const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

//             [alertCountRows, alertCountFields] = await connection.execute(`

//                 SELECT 
//                     dst.id, dst.deviceId, dt.deviceType, d.device_state, d.isActive, d.location,
//                     c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode
//                 FROM 
//                     devicestatus dst
//                 JOIN
//                     devices d ON d.deviceId = dst.deviceId 
//                 JOIN
//                     customers c ON c.afiliateCode = d.afiliateCode 
//                 JOIN
//                     device_types dt ON d.device_type = dt.id        
//                 JOIN 
//                     (
//                         SELECT 
//                             deviceId, 
//                             MAX(id) as maxId
//                         FROM 
//                             devicestatus
//                         WHERE 
//                             deviceId IN ('${deviceIds}')
//                         GROUP BY 
//                             deviceId
//                     ) latest 
//                 ON 
//                     dst.deviceId = latest.deviceId 
//                     AND dst.id = latest.maxId
//                 WHERE
//                     d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'affiliate')    
//                 ORDER BY 
//                 dst.id DESC;


//             `);

//         }
//         else {
//             return res.status(403).json({ success: false, message: 'Unauthorized user role' });
//         }


//         // const [rows] = await connection.execute(query, queryParams);
//         // if (rows.length > 0) {
//         //     // Convert latitude and longitude for each row
//         //     rows.forEach(row => {
//         //         row.location = convertCoordinates(row.latitude, row.longitude);
//         //         delete row.latitude; // Remove latitude field
//         //         delete row.longitude; // Remove longitude field
//         //     });

//             return res.status(200).json({
//                 success: true,
//                 message: "Device list",
//                 data: alertCountRows
//             });

//         // } else {
//         //     return res.status(200).json({ success: false, message: 'No devices found' });
//         // }

//     } catch (err) {
//         console.error(err);
//         return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
//     }
// }



exports.alertInfo = async (req, res) => {
    try {
        const userRole = req.headers.userrole;
        const dType = req.body.type;
        let affiliateCode = req.headers.afiliatecode;
        let query, queryParams, rows;


        if (userRole == 'ambiator') {


            query = `SELECT deviceId FROM devices`;
            queryParams = [];

            if (dType) {
                query += ` WHERE device_type = ?`;
                queryParams.push(dType);
            }

            const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

            [rows, alertCountFields] = await connection.execute(`
                
                SELECT 
                    dst.id, dst.deviceId, dt.deviceType, dt.id As device_type, d.location, d.isActive,
                    c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode,
                    dst.fan, dst.pump, dst.water, dst.waterSupply, dst.filterPresent, 
                    dst.filterClean, dst.comm, dst.PFF, dst.HUM
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
                ORDER BY 
                    dst.id DESC;

            `);

        } else if (userRole === 'customer') {

            query = `SELECT deviceId FROM devices WHERE afiliateCode = ?`;
            queryParams = [affiliateCode];

            if (dType) {
                query += ` AND device_type = ?`;
                queryParams.push(dType);
            }

            const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

            [rows, alertCountFields] = await connection.execute(`
                
                SELECT 
                    dst.id, dst.deviceId, dt.deviceType, dt.id As device_type, d.location, d.isActive,
                    c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode,
                    dst.fan, dst.pump, dst.water, dst.waterSupply, dst.filterPresent, 
                    dst.filterClean, dst.comm, dst.PFF, dst.HUM
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
                    d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'customer')     
                ORDER BY 
                    dst.id DESC;

            `);


        } else if (userRole === 'affiliate') {

            query = `SELECT deviceId FROM devices WHERE afiliateCode = ?`;
            queryParams = [affiliateCode];

            if (dType) {
                query += ` AND device_type = ?`;
                queryParams.push(dType);
            }

            const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

            [rows, alertCountFields] = await connection.execute(`
                
                SELECT 
                    dst.id, dst.deviceId, dt.deviceType, dt.id As device_type,  d.location, d.isActive,
                    c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode,
                    dst.fan, dst.pump, dst.water, dst.waterSupply, dst.filterPresent, 
                    dst.filterClean, dst.comm
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
                    d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'affiliate')    
                ORDER BY 
                dst.id DESC;


            `);

        }
        else {
            return res.status(403).json({ success: false, message: 'Unauthorized user role' });
        }



        // Define alert messages
        const alertMessages = {
            fan: 'Fan is Off',
            water: 'Pump problem',
            waterSupply: 'Check Tap',
            filterPresent: 'Filter is missing',
            filterClean: 'Alert in Filter Clean',
            comm: 'Communication Error'
            // PFF: 'Alert in PFF',
            // HUM: 'Alert in HUM'
        };

        // Process rows to create alert objects
        const alerts = rows.flatMap(row => {
            return Object.keys(alertMessages).flatMap(key => {
                if (row[key] == 1) {
                    return {
                        statusId: row.id,
                        deviceId: row.deviceId,
                        deviceType: row.deviceType,
                        device_type: row.device_type,
                        location: row.location,
                        isActive: row.isActive,
                        companyName: row.companyName,
                        userName: row.userName,
                        phoneNo: row.phoneNo,
                        city: row.city,
                        afiliateCode: row.afiliateCode,
                        alert: alertMessages[key]
                    };
                }
                return [];
            });
        });

        // Add serial numbers
        alerts.forEach((alert, index) => {
            alert.id = index + 1;
            alert.sNo = index + 1;
        });

        // Return the response
        return res.status(200).json({
            success: true,
            message: "Device Alert list",
            data: alerts
        });

    } catch (err) {
        console.error(err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};





exports.alertMapInfo = async (req, res) => {
    try {
        let affiliateCode = req.headers.afiliatecode;
        const userRole = req.headers.userrole;
        const dType = req.body.type;
        let query, queryParams, rows;

        if (userRole === 'ambiator') {
            // Alert Count
            query = `SELECT deviceId FROM devices`;
            queryParams = [];

            if (dType) {
                query += ` WHERE device_type = ?`;
                queryParams.push(dType);
            }

            const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

            [rows, rowsFields] = await connection.execute(`
                SELECT 
                    dst.id, dst.deviceId, dt.deviceType, d.location, d.isActive,
                    c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode,
                    dst.pump, dst.water, dst.waterSupply, dst.filterPresent, dst.filterClean
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
                ORDER BY 
                    dst.id DESC;
            `);

        } else if (userRole === 'customer') {

            query = `SELECT deviceId FROM devices WHERE afiliateCode = ?`;
            queryParams = [affiliateCode];

            if (dType) {
                query += ` AND device_type = ?`;
                queryParams.push(dType);
            }

            const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

            [rows, rowsFields] = await connection.execute(`
                
                SELECT 
                    dst.id, dst.deviceId, dt.deviceType, d.location, d.isActive,
                    c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode
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
                    d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'customer')     
                ORDER BY 
                    dst.id DESC;

            `);




        } else if (userRole === 'affiliate') {

            query = `SELECT deviceId FROM devices WHERE afiliateCode = ?`;
            queryParams = [affiliateCode];

            if (dType) {
                query += ` AND device_type = ?`;
                queryParams.push(dType);
            }

            const [deviceRows, deviceFields] = await connection.execute(query, queryParams);

            const deviceIds = deviceRows.map(row => row.deviceId).join("','"); // Join deviceIds properly

            [rows, rowsFields] = await connection.execute(`
                
                SELECT 
                    dst.id, dst.deviceId, dt.deviceType, d.location, d.isActive,
                    c.companyName, c.userName, c.phoneNo, c.city, c.afiliateCode
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
                    d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'affiliate')    
                ORDER BY 
                    dst.id DESC;


            `);



        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized user role' });
        }


        // Define possible alert types and their corresponding conditions
        const alertTypes = [
            { condition: row => Number(row.isActive) === 0, message: 'Unit is OFF' },
            { condition: row => Number(row.pump) === 1 || Number(row.water) === 1 || Number(row.waterSupply) === 1, message: 'No Source Water' },
            { condition: row => Number(row.filterPresent) === 1 || Number(row.filterClean) === 1, message: 'Filter Missing' },
            { condition: row => Number(row.comm) === 1, message: 'Communication Down' }

        ];

        // Iterate through the rows to check conditions and set the status message
        const alertCountRows = rows.map(row => {
            // console.log('Processing row:', row); // Debug: Log the row being processed
            let statusMessage = "All Ok"; // Default message

            for (const alertType of alertTypes) {
                if (alertType.condition(row)) {
                    statusMessage = alertType.message;
                    // console.log('Condition met for alertType:', 'Message:', statusMessage); // Debug: Log the condition met
                    break; // Exit the loop once a condition is met
                }
            }

            return {
                id: row.id,
                deviceId: row.deviceId,
                deviceType: row.deviceType,
                customer: row.userName,
                phoneNo: row.phoneNo,
                location: row.location,
                status: statusMessage
            };
        });

        return res.status(200).json({
            success: true,
            message: "Device Alert list",
            data: alertCountRows
        });

    } catch (err) {
        console.error(err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}





exports.getDeviceTemperature = async (req, res) => {
    try {
        const deviceId = req.body.deviceId;
        const affiliateCode = req.headers.afiliatecode;
        let modifiedTemperatureData

        // Implement the logic to check affiliate code if needed

        // Assuming you have a MySQL connection named 'connection'
        const [rows, fields] = await connection.execute(`
            SELECT *
                FROM temperature
            WHERE deviceId = ?
                ORDER BY id DESC
            LIMIT 1
            `, [deviceId]);

        // if (rows.length === 0) {
        //     return res.status(404).json({ success: false, message: 'No temperature data found for the specified device' });
        // }

        if (rows.length > 0) {
            const latestTemperatureData = rows[0] || 0;

            // Modify the temperature data as per the requirement
            modifiedTemperatureData = {
                ...latestTemperatureData,
                outTemp: parseFloat(latestTemperatureData.outTemp).toFixed(1),
                outHum: Math.round(latestTemperatureData.outHum),
                supply: parseFloat(latestTemperatureData.supply).toFixed(1),
                setPoint: parseInt(latestTemperatureData.setPoint, 10)
            };
        }
        return res.status(200).json({ success: true, data: modifiedTemperatureData, message: 'Temperature Data' });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}


exports.getDeviceStatus = async (req, res) => {
    try {
        const deviceId = req.body.deviceId;
        // Implement the logic to check affiliate code if needed

        // Assuming you have a MySQL connection named 'connection'
        const [rows, fields] = await connection.execute(`
            SELECT *
                FROM devicestatus
            WHERE deviceId = ?
                ORDER BY dateTime DESC
            LIMIT 1
                `, [deviceId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No device status data found for the specified device' });
        }

        const latestTemperatureData = rows[0];
        return res.status(200).json({ success: true, data: latestTemperatureData, message: 'Device status data' });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}

exports.getEnergyInfoData = async (req, res) => {
    try {
        const deviceId = req.body.deviceId;
        const affiliateCode = req.headers.afiliatecode;

        // Assuming you have a MySQL connection named 'connection'
        const [rows, fields] = await connection.execute(`
            SELECT deviceId, THR, TKW, TWU, GHG, C02
            FROM device_data_summary
            WHERE deviceId = ?
                AND THR IS NOT NULL
            AND TKW IS NOT NULL
            AND TWU IS NOT NULL
            AND GHG IS NOT NULL
            AND C02 IS NOT NULL
            ORDER BY dateTime DESC
            LIMIT 1
                `, [deviceId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No energy data found for the specified device' });
        }

        const latestEnergyData = rows[0];
        return res.status(200).json({ success: true, data: latestEnergyData });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}


exports.EnergyConsumption = async (req, res) => {
    try {
        const { type, sortDataType } = req.body;

        if (!sortDataType) {
            throw new CustomError('deviceId and sortDataType are required', 400);
        }

        let responseData = [];
        let totalConsumption = 0;
        let allDates = [];

        if (sortDataType === 'untilNow') {

            let tempData = [];
            const startDate = moment().subtract(1, 'year').startOf('month');
            const endDate = moment().endOf('month');

            for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'months')) {
                const monthDate = date.format('YYYY-MM');
                const monthYear = date.format('MM/YY');

                let query =
                    `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary ds
                    INNER JOIN
                          devices d ON d.deviceId = ds.deviceId 
                    WHERE DATE_FORMAT(ds.dateTime, '%Y-%m') = ?`;


                let params = [monthDate];

                if (type) {
                    query += ` AND d.device_type = ?`;
                    params.push(type);
                }

                const [rows] = await connection.execute(query, params);

                let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                totalConsumption += energyConsum;

                tempData.push({ date: monthYear, energyConsum });
            }

            allDates = [];
            for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'months')) {
                const monthYear = date.format('MM/YY');
                const found = tempData.find(item => item.date === monthYear);
                allDates.push(found || { date: monthYear, energyConsum: 0 });
            }

            responseData = allDates;

        } else if (sortDataType === 'year') {
            let tempData = [];
            const currentMonth = moment().month();

            for (let i = 0; i <= currentMonth; i++) {
                const monthDate = moment().startOf('year').add(i, 'months').format('YYYY-MM');
                const monthName = moment().startOf('year').add(i, 'months').format('MMM');

                let query =
                    `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary ds
                    INNER JOIN
                        devices d ON d.deviceId = ds.deviceId     
                    WHERE DATE_FORMAT(ds.dateTime, '%Y-%m') = ?`;

                let params = [monthDate];

                if (type) {
                    query += ` AND d.device_type = ?`;
                    params.push(type);
                }

                const [rows] = await connection.execute(query, params);

                let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                totalConsumption += energyConsum;

                tempData.push({ date: monthName, energyConsum });
            }

            responseData = tempData.map(item => ({ ...item }));

            allDates = Array.from({ length: currentMonth + 1 }, (_, index) => {
                const monthName = moment().startOf('year').add(index, 'months').format('MMM');
                const found = responseData.find(item => item.date === monthName);
                return found || { date: monthName, energyConsum: 0 };
            });

        } else if (sortDataType === 'month') {
            const startOfMonth = moment().startOf('month');
            const today = moment();

            for (let date = startOfMonth.clone(); date.isBefore(today) || date.isSame(today); date.add(1, 'days')) {
                const formattedDate = date.format('YYYY-MM-DD');
                const displayDate = date.format('DD');

                let query =
                    `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary ds
                    INNER JOIN
                        devices d ON d.deviceId = ds.deviceId      
                    WHERE DATE(ds.dateTime) = ?`;

                let params = [formattedDate];

                if (type) {
                    query += ` AND d.device_type = ?`;
                    params.push(type);
                }

                const [rows] = await connection.execute(query, params);

                let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                totalConsumption += energyConsum;

                responseData.push({ date: displayDate, energyConsum });
            }

            allDates = [];
            for (let date = startOfMonth.clone(); date.isBefore(today) || date.isSame(today); date.add(1, 'days')) {
                const displayDate = date.format('DD');
                const found = responseData.find(item => item.date === displayDate);
                allDates.push(found || { date: displayDate, energyConsum: 0 });
            }

            allDates.reverse();

        } else if (sortDataType === 'week') {
            const startOfWeek = moment().startOf('isoWeek');
            const endOfWeek = moment().endOf('isoWeek');

            for (let date = startOfWeek.clone(); date.isBefore(endOfWeek) || date.isSame(endOfWeek); date.add(1, 'days')) {
                const formattedDate = date.format('YYYY-MM-DD');
                const dayName = date.format('ddd');

                let query =
                    `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary ds
                    INNER JOIN
                        devices d ON d.deviceId = ds.deviceId  
                    WHERE DATE(ds.dateTime) = ?`;

                let params = [formattedDate];

                if (type) {
                    query += ` AND d.device_type = ?`;
                    params.push(type);
                }

                const [rows] = await connection.execute(query, params);

                let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                totalConsumption += energyConsum;

                responseData.push({ date: dayName, energyConsum });
            }

            allDates = Array.from({ length: 7 }, (_, index) => {
                const date = startOfWeek.clone().add(index, 'days');
                const formattedDate = date.format('YYYY-MM-DD');
                const dayName = date.format('ddd');
                const found = responseData.find(item => item.date === dayName);
                return found || { date: dayName, energyConsum: 0 };
            });

            allDates.reverse();

        } else if (sortDataType === 'today') {
            const startOfToday = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
            const currentHour = moment().hour();

            for (let i = 0; i <= currentHour; i++) {
                const hourAgo = moment().startOf('day').add(i, 'hours').format('hA');

                let query =
                    `SELECT SUM(TKW) as energyConsum, ds.HR
                        FROM device_data ds
                    INNER JOIN
                        devices d ON d.deviceId = ds.deviceId  
                    WHERE ds.HR = ? AND ds.dateTime >= ?
                    GROUP BY ds.HR`;

                let params = [hourAgo, startOfToday];

                if (type) {
                    query += ` AND d.device_type = ?`;
                    params.push(type);
                }

                const [rows] = await connection.execute(query, params);

                let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                totalConsumption += energyConsum;

                responseData.push({ date: hourAgo, energyConsum });
            }

        } else {
            throw new CustomError('Invalid sortDataType', 400);
        }

        return res.status(200).json({
            success: true,
            message: `Energy consumption trend for ${sortDataType}`,
            data: responseData,
        });

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}



exports.custDeviceInfo = async (req, res) => {
    try {
        // const email = req.headers.email;

        const email = req.params.id;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const customerQuery = `
            SELECT id, afiliateCode 
            FROM customers 
            WHERE email = ?
        `;
        const [customerRows] = await connection.execute(customerQuery, [email]);

        if (!customerRows.length) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const affiliateCode = customerRows[0].afiliateCode;

        // Parallel Execution for unrelated queries
        const [
            [deviceCountRows],
            [activeCountRows],
            [deviceIdsRows],
            [todayEnergyRows],
            [todayGhGRows],
            [untilEnergyRows],
            [untilGhGRows],

        ] = await Promise.all([

            connection.execute(`SELECT COUNT(*) AS deviceCount FROM devices WHERE afiliateCode = ?`, [affiliateCode]),
            connection.execute(`SELECT COUNT(*) AS activeCount FROM devices WHERE isActive = 1 AND afiliateCode = ?`, [affiliateCode]),
            connection.execute(`SELECT deviceId FROM devices WHERE afiliateCode = ?`, [affiliateCode]),
            connection.execute(`
                SELECT ROUND(SUM(TKW) / COUNT(*), 2) AS AverageTKW 
                FROM device_data_summary
                INNER JOIN devices ON devices.deviceId = device_data_summary.deviceId
                WHERE DATE(device_data_summary.dateTime) = CURDATE() 
                AND devices.afiliateCode = ?
            `, [affiliateCode]),

            connection.execute(`
                SELECT egc.GHGe 
                FROM device_data_summary dds
                INNER JOIN devices d ON d.deviceId = dds.deviceId
                INNER JOIN energy_ghg_calculation egc ON egc.deviceType = d.device_type
                WHERE DATE(dds.dateTime) = CURDATE() 
                AND d.afiliateCode = ?
                ORDER BY egc.id DESC
            `, [affiliateCode]),

            connection.execute(`
                SELECT ROUND(SUM(TKW) / COUNT(*), 2) AS AverageTKW 
                FROM device_data_summary
                INNER JOIN devices ON devices.deviceId = device_data_summary.deviceId
                WHERE devices.afiliateCode = ?
            `, [affiliateCode]),

            connection.execute(`
                SELECT egc.GHGe 
                FROM device_data_summary dds
                INNER JOIN devices d ON d.deviceId = dds.deviceId
                INNER JOIN energy_ghg_calculation egc ON egc.deviceType = d.device_type
                WHERE d.afiliateCode = ? 
                ORDER BY egc.id DESC
            `, [affiliateCode]),

            connection.execute(`SELECT location FROM devices WHERE afiliateCode = ?`, [affiliateCode])
        ]);

        // Processing alert counts
        const deviceIds = deviceIdsRows.map(row => row.deviceId).join("','");
        const [alertCountRows] = await connection.execute(`
            SELECT 
                SUM(dst.fan = 1) AS fan_count,
                SUM(dst.pump = 1) AS pump_count,
                SUM(dst.water = 1) AS water_count,
                SUM(dst.filterPresent = 1) AS filterPresent_count,
                SUM(dst.filterClean = 1) AS filterClean_count,
                SUM(dst.waterSupply = 1) AS waterSupply_count,
                SUM(dst.comm = 1) AS comm_count
            FROM devicestatus dst
            JOIN (
                SELECT deviceId, MAX(id) AS maxId 
                FROM devicestatus 
                WHERE deviceId IN ('${deviceIds}') 
                GROUP BY deviceId
            ) latest ON dst.deviceId = latest.deviceId AND dst.id = latest.maxId
        `);

        const alertsCount = Object.values(alertCountRows[0] || {}).reduce((sum, count) => sum + Number(count), 0);

        // Calculate energy and avoided emissions
        const inputEnergy = todayEnergyRows[0]?.AverageTKW || 0;
        const avoEnergy = Math.max(inputEnergy - 7.5, 0);
        const todayGhG = todayGhGRows[0]?.GHGe || 0;
        const ghgeEnergy = avoEnergy * todayGhG;

        const untillInputEnergy = untilEnergyRows[0]?.AverageTKW || 0;
        const untillAvoEnergy = Math.max(untillInputEnergy - 7.5, 0) / 1000;
        const untilGhG = untilGhGRows[0]?.GHGe || 0;
        const untillGhgeEnergy = untillAvoEnergy * untilGhG;




        return res.status(200).json({
            success: true,
            installedCount: deviceCountRows[0].deviceCount,
            activeCount: activeCountRows[0].activeCount,
            alertsCount: alertsCount,
            todayInputEnergy: inputEnergy,
            todayAvoidedEnergy: avoEnergy,
            TodayGhgAvoidedTonsCo2e: ghgeEnergy,
            untilInputEnergy: untillInputEnergy,
            untilAvoidedEnergy: untillAvoEnergy,
            untilGhgAvoidedTonsCo2e: untillGhgeEnergy

        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};
