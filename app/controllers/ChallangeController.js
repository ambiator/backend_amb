const { connection, CustomError } = require('../config/dbSql2');




exports.showData = async (req, res) => {
    try {
        const affiliateCode = req.headers.afiliatecode;
        const userRole = req.headers.userrole;
        const device = req.body.device;

        let query;
        let queryParams;

        if (userRole === 'ambiator') {
            
            // Query for ambiator role
            query = `SELECT * FROM alert_info_log WHERE deviceId = ?`;
            queryParams = [device];


        } else if (userRole === 'customer' ) {

            // Query for customer or affiliate role
            query = `
                SELECT alrt.* 
                    FROM alert_info_log alrt
                    JOIN devices d ON d.deviceId = alrt.deviceId 
                WHERE d.afiliateCode = ? AND alrt.deviceId = ? AND
                d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'customer')
            `;
            queryParams = [affiliateCode, device];


        } else if ( userRole === 'affiliate') {

            // Query for customer or affiliate role
            query = `
                SELECT alrt.* 
                  FROM alert_info_log alrt
                  JOIN devices d ON d.deviceId = alrt.deviceId 
                WHERE d.afiliateCode = ? AND alrt.deviceId = ? AND
                d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = 'affiliate')

            `;
            queryParams = [affiliateCode, device];        

        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized user role' });
        }

        // Execute query
        const [rows] = await connection.execute(query, queryParams);

        // Return response with data
        return res.status(200).json({
            success: true,
            message: "Device Alert list",
            data: rows
        });

    } catch (err) {
        console.error(err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}


exports.showData2 = async (req, res) => {
    try {
        const userRole = req.headers.userrole;
        const affiliateCode = req.headers.afiliatecode;
        const device = req.body.device;

        let query, queryParams, result;

        // Validate required parameters
        if (!device) {
            return res.status(400).json({ success: false, message: 'Device information is required' });
        }

        if (!userRole) {
            return res.status(403).json({ success: false, message: 'User role is required' });
        }

        if (!affiliateCode && userRole !== 'ambiator') {
            return res.status(400).json({ success: false, message: 'Affiliate code is required' });
        }

        // Construct base query
        const baseQuery = `
            SELECT 
                dst.id, dst.deviceId, dt.deviceType, d.location, d.isActive,
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
            JOIN (
                SELECT 
                    deviceId, 
                    MAX(id) as maxId
                FROM 
                    devicestatus
                WHERE 
                    deviceId IN (?)
                GROUP BY 
                    deviceId
            ) latest 
            ON 
                dst.deviceId = latest.deviceId 
                AND dst.id = latest.maxId
        `;

        // Customize the query based on user role
        if (userRole === 'ambiator') {
            query = baseQuery;
            queryParams = [device];
        } else if (userRole === 'customer' || userRole === 'affiliate') {
            const userFilter = userRole === 'customer' ? `'customer'` : `'affiliate'`;
            query = `
                ${baseQuery}
                WHERE d.afiliateCode IN (SELECT afiliateCode FROM users WHERE userRole = ${userFilter})
            `;
            queryParams = [device];
        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized user role' });
        }

        // Execute the query
        const [rows] = await connection.execute(query, queryParams);

        // Define alert messages
        const alertMessages = {
            fan: 'Alert in Fan',
            water: 'Alert in Water Flow',
            waterSupply: 'Alert in Water Supply',
            filterPresent: 'Alert in Filter Present',
            filterClean: 'Alert in Filter Clean',
            comm: 'Alert in Comm'
        };

        // Process rows to create alert objects
        const alerts = rows.flatMap(row => {
            return Object.keys(alertMessages).flatMap(key => {
                if (row[key] == 1) {
                    return {
                        statusId: row.id,
                        deviceId: row.deviceId,
                        deviceType: row.deviceType,
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
