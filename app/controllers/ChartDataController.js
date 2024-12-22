const { connection, CustomError } = require('../config/dbSql2');
const moment = require('moment-timezone');

exports.EnergyConsumptionTrend = async (req, res) => {
    try {
        const { deviceId, sortDataType, previous } = req.body;

        if (!deviceId || !sortDataType) {
            throw new CustomError('deviceId and sortDataType are required', 400);
        }

        let responseData = [];
        let totalConsumption = 0;
        let allDates = [];
        let data2 = [];


        if (sortDataType === 'untilNow') {
            // Temporary array to hold the results
           let tempData = [];

            // Fetch the earliest dateTime entry for the given deviceId
            const [firstRow] = await connection.execute(
                `SELECT dateTime as earliestDate
                FROM device_data_summary
                WHERE deviceId = ?
                ORDER BY dateTime ASC
                LIMIT 1`,
                [deviceId]
            );

            if (firstRow.length > 0 && firstRow[0].earliestDate) {
                const startDate = moment(firstRow[0].earliestDate);
                const endDate = moment().endOf('month');

                // Loop from the startDate to the current month and year
                for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'months')) {
                    const monthDate = date.format('YYYY-MM'); // Full date for the query
                    const monthYear = date.format('MM/YY'); // Month and year for display

                    const [rows] = await connection.execute(
                        `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary
                        WHERE deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                        [deviceId, monthDate]
                    );

                    let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                    totalConsumption += energyConsum;

                    tempData.push({ date: monthYear, energyConsum });
                }

                // Ensure allDates maps correctly, including months with no data
                allDates = [];
                for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'months')) {
                    const monthYear = date.format('MM/YY');
                    const found = tempData.find(item => item.date === monthYear);
                    allDates.push(found || { date: monthYear, energyConsum: 0 });
                }

                // Set responseData to allDates to include all months
                responseData = allDates;

                
            } else {
                // Handle case where there is no data for the device
                const startDate = moment().subtract(1, 'year').startOf('month'); // Default to the last year
                const endDate = moment().endOf('month');

                // Ensure allDates is populated with the past year if no data is found
                for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'months')) {
                    const monthYear = date.format('MM/YY');
                    allDates.push({ date: monthYear, energyConsum: 0 });
                }
                
                responseData = allDates;
            }

            // Call the EnergyConsumptionSub function and store its result in data2
            const data2Result = await EnergyConsumptionSub(deviceId, previous);
            data2 = data2Result.data;


        }else if (sortDataType === 'year') {

            let tempData = [];
            const currentMonth = moment().month(); // Get the current month (0-11, where 0 is January)

            for (let i = 0; i <= currentMonth; i++) {
                const monthDate = moment().startOf('year').add(i, 'months').format('YYYY-MM'); // Full date for the query
                const monthName = moment().startOf('year').add(i, 'months').format('MMM'); // Month name for display

                const [rows] = await connection.execute(
                    `SELECT AVG(TKW) as energyConsum
                    FROM device_data_summary
                    WHERE deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                    [deviceId, monthDate]
                );

                let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                totalConsumption += energyConsum;

                tempData.push({ date: monthName, energyConsum });
            }

            // Create the responseData with the collected data
            responseData = tempData.map(item => ({ ...item }));

            // Align allDates ensuring it maps correctly
            allDates = Array.from({ length: currentMonth + 1 }, (_, index) => {
                const monthName = moment().startOf('year').add(index, 'months').format('MMM');
                const found = responseData.find(item => item.month === monthName);
                return found || { month: monthName, energyConsum: 0 };
            });
        

            // Call the EnergyConsumptionSub function and store its result in data2
            const data2Result = await EnergyConsumptionSub(deviceId, previous);
            data2 = data2Result.data;

        }else if (sortDataType === 'month') {

          
            const startOfMonth = moment().startOf('month'); // Start of the current month
            const today = moment(); // Today's date

            for (let date = startOfMonth.clone(); date.isBefore(today) || date.isSame(today); date.add(1, 'days')) {
                const formattedDate = date.format('YYYY-MM-DD'); // Full date for the query
                const displayDate = date.format('DD'); // Day for display

                const [rows] = await connection.execute(
                    `SELECT AVG(TKW) as energyConsum
                    FROM device_data_summary
                    WHERE deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, formattedDate]
                );

                let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                totalConsumption += energyConsum;

                responseData.push({ date: displayDate, energyConsum });
            }

            // Ensure allDates includes every day from the start of the month to today, defaulting to 0 if no data is found
            allDates = [];
            for (let date = startOfMonth.clone(); date.isBefore(today) || date.isSame(today); date.add(1, 'days')) {
                const displayDate = date.format('DD'); // Day for display
                const found = responseData.find(item => item.date === displayDate);
                allDates.push(found || { date: displayDate, energyConsum: 0 });
            }

            // Reverse the order to show dates from the 1st to today
            allDates.reverse();


            // Call the EnergyConsumptionSub function and store its result in data2
            const data2Result = await EnergyConsumptionSub(deviceId, previous);
            data2 = data2Result.data;

        } else if (sortDataType === 'week') {


                // Get the start of the current week (Monday) and end of the week (Sunday)
                const startOfWeek = moment().startOf('isoWeek'); // Monday
                const endOfWeek = moment().endOf('isoWeek'); // Sunday
            
                // Loop from the start of the week to the end of the week
                for (let date = startOfWeek.clone(); date.isBefore(endOfWeek) || date.isSame(endOfWeek); date.add(1, 'days')) {
                    const formattedDate = date.format('YYYY-MM-DD'); // Full date for the query
                    const dayName = date.format('ddd'); // Day name for display (Mon, Tue, etc.)
            
                    const [rows] = await connection.execute(
                        `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary
                        WHERE deviceId = ? AND DATE(dateTime) = ?`,
                        [deviceId, formattedDate]
                    );
            
                    let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;
            
                    totalConsumption += energyConsum;
            
                    responseData.push({ date: dayName, energyConsum });
                }
            
                // Ensure allDates includes every day from Monday to Sunday, defaulting to 0 if no data is found
                allDates = Array.from({ length: 7 }, (_, index) => {
                    const date = startOfWeek.clone().add(index, 'days');
                    const formattedDate = date.format('YYYY-MM-DD');
                    const dayName = date.format('ddd');
                    const found = responseData.find(item => item.date === dayName);
                    return found || { date: dayName, energyConsum: 0 };
                });
            
                // Reverse the collected data to have Monday first
                allDates.reverse();

            // Call the EnergyConsumptionSub function and store its result in data2
            const data2Result = await EnergyConsumptionSub(deviceId, previous);
            data2 = data2Result.data;

        } else if (sortDataType === 'today') {
         

            const startOfToday = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss'); // Start of today (midnight)
            const currentHour = moment().hour(); // Current hour of the day (0-23)
            
            for (let i = 0; i <= currentHour; i++) {
                const hourAgo = moment().startOf('day').add(i, 'hours').format('hA'); // Current hour in 'hA' format (12AM, 1AM, etc.)
            
                const [rows] = await connection.execute(
                    `SELECT SUM(TKW) as energyConsum, HR
                        FROM device_data
                        WHERE deviceId = ? AND HR = ? AND dateTime >= ?
                        GROUP BY HR`,
                    [deviceId, hourAgo, startOfToday]
                );
            
                let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;
                totalConsumption += energyConsum;
                responseData.push({ date: hourAgo, energyConsum });
            }


            // Call the EnergyConsumptionSub function and store its result in data2
            const data2Result = await EnergyConsumptionSub(deviceId, previous);
            data2 = data2Result.data;
            
       
        } else {
            throw new CustomError('Invalid sortDataType', 400);
        }

        return res.status(200).json({
            success: true,
            message: `Energy consumption trend for ${sortDataType}`,
            data: responseData,
            previousData: data2
        });

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}




// exports.EnergyConsumptionSub = async (deviceId, previous ) => {
    async function EnergyConsumptionSub(deviceId, previous) {

        try {
          
            let responseData = [];
            let totalConsumption = 0;
            let allDates = [];
    
            if (previous === 'previousYear') {
    
                let tempData = [];
                const currentMonth = moment().month(); // Get the current month (0-11, where 0 is January)
                const lastYear = moment().subtract(1, 'year').year(); // Get the previous year
                
                for (let i = 0; i <= currentMonth; i++) {
                    const monthDate = moment().year(lastYear).startOf('year').add(i, 'months').format('YYYY-MM'); // Full date for the query
                    const monthName = moment().year(lastYear).startOf('year').add(i, 'months').format('MMM'); // Month name for display
                
                    const [rows] = await connection.execute(
                        `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary
                        WHERE deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                        [deviceId, monthDate]
                    );
                
                    let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;
                
                    totalConsumption += energyConsum;
                
                    tempData.push({ date: monthName, energyConsum });
                }
                
                // Create the responseData with the collected data
                responseData = tempData.map(item => ({ ...item }));
                
                // Align allDates ensuring it maps correctly
                allDates = Array.from({ length: currentMonth + 1 }, (_, index) => {
                    const monthName = moment().year(lastYear).startOf('year').add(index, 'months').format('MMM');
                    const found = responseData.find(item => item.date === monthName);
                    return found || { month: monthName, energyConsum: 0 };
                });
    
            }else if (previous === 'previousMonth') {
    
                const startOfPrevMonth = moment().subtract(1, 'month').startOf('month'); // Start of the previous month
                const endOfPrevMonth = moment().subtract(1, 'month').endOf('month'); // End of the previous month
    
                for (let date = startOfPrevMonth.clone(); date.isBefore(endOfPrevMonth) || date.isSame(endOfPrevMonth); date.add(1, 'days')) {
                    const formattedDate = date.format('YYYY-MM-DD'); // Full date for the query
                    const displayDate = date.format('DD'); // Day for display
    
                    const [rows] = await connection.execute(
                        `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary
                        WHERE deviceId = ? AND DATE(dateTime) = ?`,
                        [deviceId, formattedDate]
                    );
    
                    let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;
    
                    totalConsumption += energyConsum;
    
                    responseData.push({ date: displayDate, energyConsum });
                }
    
                // Ensure allDates includes every day from the start of the previous month to the end of the previous month, defaulting to 0 if no data is found
                let allDates = [];
                for (let date = startOfPrevMonth.clone(); date.isBefore(endOfPrevMonth) || date.isSame(endOfPrevMonth); date.add(1, 'days')) {
                    const displayDate = date.format('DD'); // Day for display
                    const found = responseData.find(item => item.date === displayDate);
                    allDates.push(found || { date: displayDate, energyConsum: 0 });
                }
    
                // Reverse the order to show dates from the 1st to the end of the previous month
                allDates.reverse();
    
    
            } else if (previous === 'previousWeek') {
    
          
               
                // Calculate the start and end of the previous week (Monday to Sunday)
                const startOfPrevWeek = moment().subtract(1, 'weeks').startOf('isoWeek'); // Start of the week (Monday)
                const endOfPrevWeek = moment().subtract(1, 'weeks').endOf('isoWeek'); // End of the week (Sunday)

                // Loop from the start of the previous week to the end of the previous week
                for (let date = startOfPrevWeek.clone(); date.isBefore(endOfPrevWeek) || date.isSame(endOfPrevWeek); date.add(1, 'days')) {
                    const formattedDate = date.format('YYYY-MM-DD'); // Full date for the query
                    const dayName = date.format('ddd'); // Day name for display (Mon, Tue, etc.)

                    const [rows] = await connection.execute(
                        `SELECT AVG(TKW) as energyConsum
                        FROM device_data_summary
                        WHERE deviceId = ? AND DATE(dateTime) = ?`,
                        [deviceId, formattedDate]
                    );

                    let energyConsum = rows.length > 0 && rows[0].energyConsum !== null ? parseFloat(rows[0].energyConsum) : 0;

                    totalConsumption += energyConsum;

                    responseData.push({ date: dayName, energyConsum });
                }

                // Ensure allDates includes every day from the start of the previous week to the end of the previous week, defaulting to 0 if no data is found
                allDates = Array.from({ length: 7 }, (_, index) => {
                    const date = startOfPrevWeek.clone().add(index, 'days');
                    const formattedDate = date.format('YYYY-MM-DD');
                    const dayName = date.format('ddd');
                    const found = responseData.find(item => item.date === dayName);
                    return found || { date: dayName, energyConsum: 0 };
                });

                // Reverse to show Monday first
                allDates.reverse();
            } 
    
            return ({
              
                data: responseData
            });
    
        } catch (err) {
            return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
        }
    }
    



exports.waterConsumptionTrend = async (req, res) => {
    try {
        const { deviceId, sortDataType, previous } = req.body;
        if (!deviceId || !sortDataType) {
            throw new CustomError('deviceId and sortDataType are required', 400);
        }
        let responseData = [];
        let totalConsumption = 0;
        let allDates = [];
        let data2 = [];



        if (sortDataType === 'untilNow') {
            // Temporary array to hold the results
            let tempData = [];
        
            // Declare startDate outside the if block so it's accessible later
            let startDate = null;

        
            // Fetch the earliest dateTime entry for the given deviceId
                const [firstRow] = await connection.execute(
                    `SELECT dateTime as earliestDate
                    FROM device_data_summary
                    WHERE deviceId = ?
                    ORDER BY dateTime ASC
                    LIMIT 1`,
                    [deviceId]
                );

                if (firstRow.length > 0 && firstRow[0].earliestDate) {
                    const startDate = moment(firstRow[0].earliestDate);
                    const endDate = moment().endOf('month');

                    // Loop from the startDate to the current month and year
                    for (let date = startDate.clone(); date.isBefore(endDate) || date.isSame(endDate); date.add(1, 'months')) {
                        const monthDate = date.format('YYYY-MM'); // Full date for the query
                        const monthYear = date.format('MM/YY'); // Month and year for display

                        const [rows] = await connection.execute(
                            `SELECT SUM(TWU) as waterConsum
                            FROM device_data_summary
                            WHERE deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                            [deviceId, monthDate]
                        );

                        let waterConsum = rows.length > 0 && rows[0].waterConsum !== null ? parseFloat(rows[0].waterConsum) : 0;
                        tempData.push({ date: monthYear, waterConsum });
                    }

                    // Ensure allDates maps correctly, including months with no data
                    allDates = [];
                    for (let date = startDate.clone(); date.isBefore(endDate) || date.isSame(endDate); date.add(1, 'months')) {
                        const monthYear = date.format('MM/YY');
                        const found = tempData.find(item => item.date === monthYear);
                        allDates.push(found || { date: monthYear, waterConsum: 0 });
                    }

                    // Set responseData to allDates to include all months
                    responseData = allDates;

                } else {
                    // Handle case where there is no data for the device
                    const startDate = moment().subtract(1, 'year').startOf('month'); // Default to the last year
                    const endDate = moment().endOf('month');

                    // Ensure allDates is populated with the past year if no data is found
                    for (let date = startDate.clone(); date.isBefore(endDate) || date.isSame(endDate); date.add(1, 'months')) {
                        const monthYear = date.format('MM/YY');
                        allDates.push({ date: monthYear, waterConsum: 0 });
                    }
                    
                    responseData = allDates;
                }


                
            // Call the preTWU function and store its result in data2
            const data2Result = await preTWU(deviceId, previous);
            data2 = data2Result.data;

                
            }else if (sortDataType === 'year') {

                let tempData = [];
                const currentMonth = moment().month(); // Get the current month (0-11, where 0 is January)
                
                for (let i = 0; i <= currentMonth; i++) {
                    const monthDate = moment().startOf('year').add(i, 'months').format('YYYY-MM'); // Full date for the query
                    const monthName = moment().startOf('year').add(i, 'months').format('MMM'); // Month name for display
                
                    const [rows] = await connection.execute(
                        `SELECT SUM(TWU) as waterConsum
                            FROM device_data_summary
                            WHERE deviceId = ? AND DATE(dateTime) = ?`,
                        [deviceId, monthDate]
                    );
                    let waterConsum = rows.length > 0 && rows[0].waterConsum !== null ? parseFloat(rows[0].waterConsum) : 0;
                    tempData.push({ date: monthName, waterConsum }); // Renaming 'month' to 'date'
                }
                
            // Create the responseData with the collected data
            responseData = tempData.map(item => ({ ...item }));
            
            // Align allDates ensuring it maps correctly
            allDates = Array.from({ length: currentMonth + 1 }, (_, index) => {
                const monthName = moment().startOf('year').add(index, 'months').format('MMM');
                const found = responseData.find(item => item.date === monthName); // Adjusting to 'date'
                return found || { date: monthName, waterConsum: 0};
            });


            // Call the preTWU function and store its result in data2
            const data2Result = await preTWU(deviceId, previous);
            data2 = data2Result.data;

        
        }else if (sortDataType === 'month') {
      

            const startOfMonth = moment().startOf('month'); // Start of the current month
            const today = moment(); // Today's date

            for (let date = startOfMonth.clone(); date.isBefore(today) || date.isSame(today); date.add(1, 'days')) {
                const formattedDate = date.format('YYYY-MM-DD'); // Full date for the query
                const displayDate = date.format('DD'); // Day for display

                const [rows] = await connection.execute(
                    `SELECT SUM(TWU) as waterConsum
                    FROM device_data_summary
                    WHERE deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, formattedDate]
                );

                let waterConsum = rows.length > 0 && rows[0].waterConsum !== null ? parseFloat(rows[0].waterConsum) : 0;

                totalConsumption += waterConsum;

                responseData.push({ date: displayDate, waterConsum });
            }

            // Ensure allDates includes every day from the start of the month to today, defaulting to 0 if no data is found
            allDates = [];
            for (let date = startOfMonth.clone(); date.isBefore(today) || date.isSame(today); date.add(1, 'days')) {
                const formattedDate = date.format('YYYY-MM-DD');
                const found = responseData.find(item => item.date === formattedDate);
                allDates.push(found || { date: formattedDate, waterConsum: 0 });
            }

            // Reverse the order to show dates from the earliest to today
            allDates.reverse();

            // Call the preTWU function and store its result in data2
            const data2Result = await preTWU(deviceId, previous);
            data2 = data2Result.data;

        } else if (sortDataType === 'week') {

            const today = moment(); // Today's date
            const startOfWeek = today.clone().startOf('week').add(1, 'days'); // Monday (if the week starts on Sunday, adjust accordingly)
            const endOfWeek = startOfWeek.clone().add(6, 'days'); // Sunday
        
            for (let date = startOfWeek.clone(); date.isBefore(endOfWeek) || date.isSame(endOfWeek); date.add(1, 'days')) {
                const formattedDate = date.format('YYYY-MM-DD'); // Full date for the query
                const dayName = date.format('ddd'); // Day name for display (Mon, Tue, etc.)
        
                const [rows] = await connection.execute(
                    `SELECT SUM(TWU) as waterConsum
                    FROM device_data_summary
                    WHERE deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, formattedDate]
                );
        
                let waterConsum = rows.length > 0 && rows[0].waterConsum !== null ? parseFloat(rows[0].waterConsum) : 0;
        
                totalConsumption += waterConsum;
        
                responseData.push({ date: dayName, waterConsum });
            }
        
            // Ensure allDates includes every day from Monday to Sunday, defaulting to 0 if no data is found
            allDates = [];
            for (let date = startOfWeek.clone(); date.isBefore(endOfWeek) || date.isSame(endOfWeek); date.add(1, 'days')) {
                const dayName = date.format('ddd'); // Day name for display (Mon, Tue, etc.)
                const found = responseData.find(item => item.date === dayName);
                allDates.push(found || { date: dayName, waterConsum: 0 });
            }


            // Call the preTWU function and store its result in data2
            const data2Result = await preTWU(deviceId, previous);
            data2 = data2Result.data;


        } else if (sortDataType === 'today') {

            const startOfToday = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss'); // Start of today (midnight)
            const currentHour = moment().hour(); // Current hour of the day (0-23)
           
            for (let i = 0; i <= currentHour; i++) {
                const hourString = moment().startOf('day').add(i, 'hours').format('hA'); // Current hour in 'hA' format (12AM, 1AM, etc.)

                const [rows] = await connection.execute(
                    `SELECT SUM(TWU) as waterConsum, HR
                        FROM device_data_summary
                        WHERE deviceId = ? AND HR = ? AND dateTime >= ?
                        GROUP BY HR`,
                    [deviceId, hourString, startOfToday]
                );

                let waterConsum = rows.length > 0 && rows[0].waterConsum !== null ? parseFloat(rows[0].waterConsum) : 0;
                totalConsumption += waterConsum;
                responseData.push({ date: hourString, waterConsum });
            }

            responseData = responseData.map(item => ({ ...item }));

            // Call the preTWU function and store its result in data2
            const data2Result = await preTWU(deviceId, previous);
            data2 = data2Result.data;

           // Now responseData contains the data from 12AM to the current hour of today

        } else {
            throw new CustomError('Invalid sortDataType', 400);
        }
        return res.status(200).json({
            success: true,
            message: `water consumption trend for ${sortDataType}`,
            data: responseData,
            previousData: data2

        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}



async function preTWU(deviceId, previous) {
    try {
        let responseData = [];
        let totalConsumption = 0;
        let allDates = [];


        if (previous === 'previousYear') {
            let tempData = [];
            const currentMonth = moment().month(); // Get the current month (0-11, where 0 is January)
            const lastYear = moment().subtract(1, 'year').year(); // Get the previous year

            for (let i = 0; i <= currentMonth; i++) {
                const monthDate = moment().year(lastYear).startOf('year').add(i, 'months').format('YYYY-MM'); // Full date for the query
                const monthName = moment().year(lastYear).startOf('year').add(i, 'months').format('MMM'); // Month name for display

                const [rows] = await connection.execute(
                    `SELECT SUM(TWU) as waterConsum
                    FROM device_data_summary
                    WHERE deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                    [deviceId, monthDate]
                );

                let waterConsum = rows.length > 0 && rows[0].waterConsum !== null ? parseFloat(rows[0].waterConsum) : 0;

                totalConsumption += waterConsum;

                tempData.push({ date: monthName, waterConsum });
            }

            responseData = tempData.map(item => ({ ...item }));

            allDates = Array.from({ length: currentMonth + 1 }, (_, index) => {
                const monthName = moment().year(lastYear).startOf('year').add(index, 'months').format('MMM');
                const found = responseData.find(item => item.date === monthName);
                return found || { month: monthName, waterConsum: 0 };
            });

        } else if (previous === 'previousMonth') {
            const startOfPrevMonth = moment().subtract(1, 'month').startOf('month'); // Start of the previous month
            const endOfPrevMonth = moment().subtract(1, 'month').endOf('month'); // End of the previous month

            for (let date = startOfPrevMonth.clone(); date.isBefore(endOfPrevMonth) || date.isSame(endOfPrevMonth); date.add(1, 'days')) {
                const formattedDate = date.format('YYYY-MM-DD'); // Full date for the query
                const displayDate = date.format('DD'); // Day for display

                const [rows] = await connection.execute(
                    `SELECT SUM(TWU) as waterConsum
                    FROM device_data_summary
                    WHERE deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, formattedDate]
                );

                let waterConsum = rows.length > 0 && rows[0].waterConsum !== null ? parseFloat(rows[0].waterConsum) : 0;

                totalConsumption += waterConsum;

                responseData.push({ date: displayDate, waterConsum });
            }

            allDates = [];
            for (let date = startOfPrevMonth.clone(); date.isBefore(endOfPrevMonth) || date.isSame(endOfPrevMonth); date.add(1, 'days')) {
                const displayDate = date.format('DD'); // Day for display
                const found = responseData.find(item => item.date === displayDate);
                allDates.push(found || { date: displayDate, waterConsum: 0 });
            }

            allDates.reverse();

        } else if (previous === 'previousWeek') {

        
            // Calculate the start and end of the previous week (Monday to Sunday)
            const startOfPrevWeek = moment().subtract(1, 'weeks').startOf('isoWeek'); // Start of the previous week (Monday)
            const endOfPrevWeek = moment().subtract(1, 'weeks').endOf('isoWeek'); // End of the previous week (Sunday)

            // Loop from the start of the previous week to the end of the previous week
            for (let date = startOfPrevWeek.clone(); date.isBefore(endOfPrevWeek) || date.isSame(endOfPrevWeek); date.add(1, 'days')) {
                const formattedDate = date.format('YYYY-MM-DD'); // Full date for the query
                const dayName = date.format('ddd'); // Day name for display (Mon, Tue, etc.)

                const [rows] = await connection.execute(
                    `SELECT SUM(TWU) as waterConsum
                    FROM device_data_summary
                    WHERE deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, formattedDate]
                );

                let waterConsum = rows.length > 0 && rows[0].waterConsum !== null ? parseFloat(rows[0].waterConsum) : 0;

                totalConsumption += waterConsum;

                responseData.push({ date: dayName, waterConsum });
            }

            // Ensure allDates includes every day from the start of the previous week to the end of the previous week, defaulting to 0 if no data is found
            allDates = Array.from({ length: 7 }, (_, index) => {
                const date = startOfPrevWeek.clone().add(index, 'days');
                const formattedDate = date.format('YYYY-MM-DD');
                const dayName = date.format('ddd');
                const found = responseData.find(item => item.date === dayName);
                return found || { date: dayName, waterConsum: 0 };
            });

            // Reverse to show Monday first
            allDates.reverse();


        } else {
            responseData = [] 
        }

        return {
            success: true,
            data: responseData
        };
    } catch (err) {
        return {
            success: false,
            message: err.message || 'An error occurred'
        };
    }
}


exports.machTempStatusTrend = async (req, res) => {
    try {

        const { deviceId, sortDataType } = req.body;
        if (!deviceId || !sortDataType) {
            throw new CustomError('deviceId and sortDataType are required', 400);
        }

        let responseData = [];
        let allDates = [];


        if (sortDataType === 'untilNow') {
            // Temporary array to hold the results
            let tempData = [];
        
            // Declare startDate outside the if block so it's accessible later
            let startDate = null;

            // Fetch the earliest dateTime entry for the given deviceId
            const [firstRow] = await connection.execute(
                `SELECT dateTime as earliestDate
                FROM device_data
                WHERE deviceId = ?
                ORDER BY dateTime ASC
                LIMIT 1`,
                [deviceId]
            );

            if (firstRow.length > 0 && firstRow[0].earliestDate) {
                startDate = moment(firstRow[0].earliestDate);
                const endDate = moment().endOf('month');

                // Loop from the startDate to the current month and year
                for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'months')) {
                    const monthDate = date.format('YYYY-MM'); // Full date for the query
                    const monthYear = date.format('MM/YY'); // Month and year for display

                    // Queries for each data type
                    const [rows] = await connection.execute(
                        `SELECT COUNT(*) AS dryCoolCnt
                        FROM devicestatus
                        WHERE fan = 1 AND  pump = 1 AND deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                        [deviceId, monthDate]
                    );
                    const [humRows] = await connection.execute(
                        `SELECT COUNT(*) AS humCnt
                        FROM devicestatus
                        WHERE HUM = 1  AND deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                        [deviceId, monthDate]
                    );
                    const [fCoolRows] = await connection.execute(
                        `SELECT COUNT(*) AS fcCnt
                        FROM devicestatus
                        WHERE fan = 1 AND  pump = 0  AND deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                        [deviceId, monthDate]
                    );

                    // Extracting counts from the result
                    let dryCoolCnt = rows.length > 0 && rows[0].dryCoolCnt !== null ? parseFloat(rows[0].dryCoolCnt) : 0;
                    let humCnt = humRows.length > 0 && humRows[0].humCnt !== null ? parseFloat(humRows[0].humCnt) : 0;
                    let fcCnt = fCoolRows.length > 0 && fCoolRows[0].fcCnt !== null ? parseFloat(fCoolRows[0].fcCnt) : 0;
                    
                    // Pushing data into tempData
                    tempData.push({ date: monthYear, dryCoolCnt, humCnt, fcCnt });
                }
            }

            // Setting responseData to the collected data
            responseData = tempData.map(item => ({ ...item }));

            // Align allDates ensuring it maps correctly
            if (startDate) {
                allDates = Array.from({ length: tempData.length }, (_, index) => {
                    const date = startDate.clone().add(index, 'months');
                    const monthYear = date.format('MM/YY');
                    const found = responseData.find(item => item.date === monthYear); // Adjusting to 'date'
                    return found || { date: monthYear, dryCoolCnt: 0, humCnt: 0, fcCnt: 0 };
                });
            }

        }else if (sortDataType === 'year') {
            
            let tempData = [];
            const currentMonth = moment().month(); // Get the current month (0-11, where 0 is January)
            
            for (let i = 0; i <= currentMonth; i++) {
                const monthDate = moment().startOf('year').add(i, 'months').format('YYYY-MM'); // Full date for the query
                const monthName = moment().startOf('year').add(i, 'months').format('MMM'); // Month name for display
            
                const [rows] = await connection.execute(
                    `SELECT COUNT(*) AS dryCoolCnt
                    FROM devicestatus
                    WHERE fan = 1 AND  pump = 1 AND deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                    [deviceId, monthDate]
                );
                //Humidity
                const [humRows] = await connection.execute(
                    `SELECT COUNT(*) AS humCnt
                    FROM devicestatus
                    WHERE HUM = 1  AND deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                    [deviceId, monthDate]
                );
                //FreeCool
                const [fCoolRows] = await connection.execute(
                    `SELECT COUNT(*) AS fcCnt
                    FROM devicestatus
                    WHERE fan = 1 AND  pump = 0  AND deviceId = ? AND DATE_FORMAT(dateTime, '%Y-%m') = ?`,
                    [deviceId, monthDate]
                );
                let dryCoolCnt = rows.length > 0 && rows[0].dryCoolCnt !== null ? parseFloat(rows[0].dryCoolCnt) : 0;
                let humCnt = humRows.length > 0 && humRows[0].humCnt !== null ? parseFloat(humRows[0].humCnt) : 0;
                let fcCnt = fCoolRows.length > 0 && fCoolRows[0].fcCnt !== null ? parseFloat(fCoolRows[0].fcCnt) : 0;
                tempData.push({ date: monthName, dryCoolCnt, humCnt, fcCnt }); // Renaming 'month' to 'date'
            }
            
            // Create the responseData with the collected data
            responseData = tempData.map(item => ({ ...item }));
            
            // Align allDates ensuring it maps correctly
            allDates = Array.from({ length: currentMonth + 1 }, (_, index) => {
                const monthName = moment().startOf('year').add(index, 'months').format('MMM');
                const found = responseData.find(item => item.date === monthName); // Adjusting to 'date'
                return found || { date: monthName, dryCoolCnt: 0, humCnt: 0, fcCnt: 0 };
            });
            


        }else if (sortDataType === 'month') {

            for (let i = 0; i < 31; i++) {

                //DryCool
                const date = moment().subtract(i, 'days').format('DD');
                const [rows] = await connection.execute(
                        `SELECT COUNT(*) AS dryCoolCnt
                        FROM devicestatus
                        WHERE fan = 1 AND  pump = 1 AND deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, date]
                );

                //Humidity
                const [humRows] = await connection.execute(
                    `SELECT COUNT(*) AS humCnt
                    FROM devicestatus
                    WHERE HUM = 1  AND deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, date]
                );

                //FreeCool
                const [fCoolRows] = await connection.execute(
                    `SELECT COUNT(*) AS fcCnt
                      FROM devicestatus
                      WHERE fan = 1 AND  pump = 0  AND deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, date]
                );

                let dryCoolCnt = rows.length > 0 && rows[0].dryCoolCnt !== null ? parseFloat(rows[0].dryCoolCnt) : 0;
                let humCnt = humRows.length > 0 && humRows[0].humCnt !== null ? parseFloat(humRows[0].humCnt) : 0;
                let fcCnt = fCoolRows.length > 0 && fCoolRows[0].fcCnt !== null ? parseFloat(fCoolRows[0].fcCnt) : 0;
                responseData.push({ date, dryCoolCnt, humCnt, fcCnt });
            }

            allDates = Array.from({ length: 30 }, (_, index) => {
                const date = moment().subtract(index, 'days').format('DD');
                const found = responseData.find(item => item.date === date);
                return found || { date, dryCoolCnt: 0, humCnt: 0, fcCnt: 0 };
            }).reverse();


        } else if (sortDataType === 'week') {

            for (let i = 0; i < 7; i++) {
                const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
                const formattedDate = moment(date).format('ddd'); // Format date to get day name like "Mon", "Tue", etc.
                
                //DryCool
                const [rows] = await connection.execute(
                    `SELECT COUNT(*) AS dryCoolCnt
                        FROM devicestatus
                        WHERE fan = 1 AND  pump = 1 AND deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, date]
                );
                
                //Humidity
                const [humRows] = await connection.execute(
                    `SELECT COUNT(*) AS humCnt
                        FROM devicestatus
                        WHERE HUM = 1  AND deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, date]
                );
                
                //FreeCool
                const [fCoolRows] = await connection.execute(
                    `SELECT COUNT(*) AS fcCnt
                        FROM devicestatus
                        WHERE fan = 1 AND  pump = 0  AND deviceId = ? AND DATE(dateTime) = ?`,
                    [deviceId, date]
                );
                
                let dryCoolCnt = rows.length > 0 && rows[0].dryCoolCnt !== null ? parseFloat(rows[0].dryCoolCnt) : 0;
                let humCnt = humRows.length > 0 && humRows[0].humCnt !== null ? parseFloat(humRows[0].humCnt) : 0;
                let fcCnt = fCoolRows.length > 0 && fCoolRows[0].fcCnt !== null ? parseFloat(fCoolRows[0].fcCnt) : 0;
                responseData.push({ date: formattedDate, dryCoolCnt, humCnt, fcCnt });
            }

            responseData = responseData.map(item => ({ ...item }));
            allDates = Array.from({ length: 7 }, (_, index) => {
                const date = moment().subtract(index, 'days').format('YYYY-MM-DD');
                const formattedDate = moment(date).format('ddd'); // Format date to get day name like "Mon", "Tue", etc.
                const found = responseData.find(item => item.date === formattedDate);
                return found || { date: formattedDate, dryCoolCnt: 0, humCnt: 0, fcCnt: 0 };
            }).reverse();
        

        } else if (sortDataType === 'today') {
            
            const currentHour = moment().startOf('hour').format('YYYY-MM-DD HH:mm:ss');
            for (let i = 0; i < 24; i++) {
                const hour = moment(currentHour).subtract(i, 'hours').format('hA');
                //DryCool
                const [rows] = await connection.execute(
                    `SELECT COUNT(*) AS dryCoolCnt
                        FROM devicestatus
                        WHERE fan = 1 AND pump = 1 AND deviceId = ? AND dateTime BETWEEN ? AND DATE_ADD(?, INTERVAL 1 HOUR)
                        GROUP BY DATE_FORMAT(dateTime, '%Y-%m-%d %H')`,
                    [deviceId, hour, hour]
                );
                //Humidity
                const [humRows] = await connection.execute(
                    `SELECT COUNT(*) AS humCnt
                        FROM devicestatus
                        WHERE HUM = 1   AND deviceId = ? AND dateTime BETWEEN ? AND DATE_ADD(?, INTERVAL 1 HOUR)
                        GROUP BY DATE_FORMAT(dateTime, '%Y-%m-%d %H')`,
                    [deviceId, hour, hour]
                );
                //FreeCool
                const [fCoolRows] = await connection.execute(
                    `SELECT COUNT(*) AS fcCnt
                        FROM devicestatus
                        WHERE fan = 1 AND  pump = 0    AND deviceId = ? AND dateTime BETWEEN ? AND DATE_ADD(?, INTERVAL 1 HOUR)
                        GROUP BY DATE_FORMAT(dateTime, '%Y-%m-%d %H')`,
                    [deviceId, hour, hour]
                );
                let dryCoolCnt = rows.length > 0 && rows[0].dryCoolCnt !== null ? parseFloat(rows[0].dryCoolCnt) : 0;
                let humCnt = humRows.length > 0 && humRows[0].humCnt !== null ? parseFloat(humRows[0].humCnt) : 0;
                let fcCnt = fCoolRows.length > 0 && fCoolRows[0].fcCnt !== null ? parseFloat(fCoolRows[0].fcCnt) : 0;
                responseData.push({ date: hour, dryCoolCnt, humCnt, fcCnt });
            }
            responseData = responseData.map(item => ({ ...item }));
        } else {
            throw new CustomError('Invalid sortDataType', 400);
        }
        return res.status(200).json({
            success: true,
            message: `Machine Temperature Status Trend for ${sortDataType}`,
            data: responseData
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}



exports.outSideVsSupTemp = async (req, res) => {
    try {
        const { deviceId, sortDataType, previous } = req.body;
        if (!deviceId || !sortDataType) {
            throw new CustomError('deviceId and sortDataType are required', 400);
        }
        let responseData = [];
        let data2 = [];
        const endDate = moment().format('YYYY-MM-DD');




        if (sortDataType === 'untilNow') {
            const startDate = '2020-01-01'; // Adjust to the start of your records
            const endDate = moment().format('YYYY-MM-DD'); // Current date
        
            const [rows] = await connection.execute(
                `SELECT 
                    DATE_FORMAT(dateTime, '%m/%y') AS monthYear,  -- Format as MM/YY
                    ROUND(AVG(outTemp), 2) AS avgOutTemp,  -- Round to 2 decimal places
                    ROUND(AVG(supply), 2) AS avgSupply,
                    ROUND(AVG(setPoint), 2) AS avgSetPoint
                    FROM temperature
                    WHERE deviceId = ? AND DATE(dateTime) BETWEEN ? AND ?
                    GROUP BY monthYear  -- Group by the formatted month/year
                    ORDER BY DATE_FORMAT(dateTime, '%Y-%m')`,  // Order by year and month
                [deviceId, startDate, endDate]
            );
        
            rows.forEach(row => {
                responseData.push({
                    dateTime: row.monthYear,  // This will be formatted as 08/23, 09/23, etc.
                    supply: row.avgSupply,     // Rounded supply
                    outTemp: row.avgOutTemp,   // Rounded outTemp
                    setPoint: row.avgSetPoint, // Rounded setPoint
                });
            });



            // Call the preOutSideVsSupTemp function and store its result in data2
            const data2Result = await preOutSideVsSupTemp(deviceId, previous);
            data2 = data2Result.data;
     
        
        } else if (sortDataType === 'year') {
            const startDate = moment().startOf('year').format('YYYY-MM-DD');
            const endDate = moment().endOf('year').format('YYYY-MM-DD');
        
            const [rows] = await connection.execute(
                `SELECT 
                    DATE_FORMAT(dateTime, '%b') AS month,  
                    ROUND(AVG(outTemp), 2) AS avgOutTemp,  
                    ROUND(AVG(supply), 2) AS avgSupply,
                    ROUND(AVG(setPoint), 2) AS avgSetPoint
                    FROM temperature
                    WHERE deviceId = ? AND DATE(dateTime) BETWEEN ? AND ?
                    GROUP BY month  -- Group by the formatted month
                    ORDER BY DATE_FORMAT(dateTime, '%Y-%m')`,  // Order by year and month
                [deviceId, startDate, endDate]
            );
        
            rows.forEach(row => {
                responseData.push({
                    dateTime: row.month,          // This will be formatted as Jan, Feb, etc.
                    supply: row.avgSupply,     // Rounded supply
                    outTemp: row.avgOutTemp,   // Rounded outTemp
                    setPoint: row.avgSetPoint, // Rounded setPoint
                });
            });


            // Call the preOutSideVsSupTemp function and store its result in data2
            const data2Result = await preOutSideVsSupTemp(deviceId, previous);
            data2 = data2Result.data;
     

        }else if (sortDataType === 'month') {
            const startDate = moment().subtract(1, 'months').format('YYYY-MM-DD');
            const [rows] = await connection.execute(
                `SELECT outTemp, supply, setPoint,
                    DATE_FORMAT(dateTime, '%Y-%m-%d %H:%i:%s') AS dateTime
                    FROM temperature
                    WHERE deviceId = ? AND DATE(dateTime) BETWEEN ? AND ?`,
                [deviceId, startDate, endDate]
            );
            // Iterate through the rows and push outTemp values into responseData
            rows.forEach(row => {
                responseData.push({
                    dateTime: row.dateTime,
                    supply: row.supply,
                    outTemp: row.outTemp,
                    setPoint: row.setPoint,
                });
            });


            // Call the preOutSideVsSupTemp function and store its result in data2
            const data2Result = await preOutSideVsSupTemp(deviceId, previous);
            data2 = data2Result.data;
     

        } else if (sortDataType === 'week') {
            const startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
            const [rows] = await connection.execute(
                `SELECT outTemp, supply, setPoint,
                    DATE_FORMAT(dateTime, '%Y-%m-%d %H:%i:%s') AS dateTime
                    FROM temperature
                    WHERE deviceId = ? AND DATE(dateTime) BETWEEN ? AND ?`,
                [deviceId, startDate, endDate]
            );
            // Iterate through the rows and push outTemp values into responseData
            rows.forEach(row => {
                responseData.push({
                    dateTime: row.dateTime,
                    supply: row.supply,
                    outTemp: row.outTemp,
                    setPoint: row.setPoint,
                });
            });


            // Call the preOutSideVsSupTemp function and store its result in data2
            const data2Result = await preOutSideVsSupTemp(deviceId, previous);
            data2 = data2Result.data;
     
        } else if (sortDataType === 'today') {
            const startDate = moment().subtract(24, 'hours').format('YYYY-MM-DD HH:00:00');
            //DryCool
            const [rows] = await connection.execute(
                `SELECT outTemp, supply, setPoint,
                    DATE_FORMAT(dateTime, '%Y-%m-%d %H:%i:%s') AS dateTime
                    FROM temperature
                    WHERE deviceId = ? AND DATE(dateTime) BETWEEN ? AND ?`,
                [deviceId, startDate, endDate]
            );
            // Iterate through the rows and push outTemp values into responseData
            rows.forEach(row => {
                responseData.push({
                    dateTime: row.dateTime,
                    supply: row.supply,
                    outTemp: row.outTemp,
                    setPoint: row.setPoint,
                });
            });


            // Call the preOutSideVsSupTemp function and store its result in data2
            const data2Result = await preOutSideVsSupTemp(deviceId, previous);
            data2 = data2Result.data;
     
        } else {
            throw new CustomError('Invalid sortDataType', 400);
        }
        return res.status(200).json({
            success: true,
            message: `OutSide,Supply Temp & Set Point  ${sortDataType}`,
            data: responseData,
            previousData: data2

        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}



async function preOutSideVsSupTemp(deviceId, previous) {
    try {
        let responseData = [];
        // let startDate, endDate;

        if (previous === 'previousYear') {
            const currentMonth = moment().month(); // Get the current month (0-11, where 0 is January)
            const lastYear = moment().subtract(1, 'year').year(); // Get the previous year

            for (let i = 0; i <= currentMonth; i++) {
                const startOfMonth = moment().year(lastYear).startOf('year').add(i, 'months').format('YYYY-MM-DD');
                const endOfMonth = moment().year(lastYear).startOf('year').add(i + 1, 'months').subtract(1, 'days').format('YYYY-MM-DD');

                const [rows] = await connection.execute(
                    `SELECT 
                        DATE_FORMAT(dateTime, '%b') AS month,  
                        ROUND(AVG(outTemp), 2) AS avgOutTemp,  
                        ROUND(AVG(supply), 2) AS avgSupply,
                        ROUND(AVG(setPoint), 2) AS avgSetPoint
                        FROM temperature
                        WHERE deviceId = ? AND DATE(dateTime) BETWEEN ? AND ?
                        GROUP BY month
                        ORDER BY DATE_FORMAT(dateTime, '%Y-%m')`,
                    [deviceId, startOfMonth, endOfMonth]
                );

                rows.forEach(row => {
                    responseData.push({
                        dateTime: row.month, // Formatted as Jan, Feb, etc.
                        supply: row.avgSupply, // Rounded supply
                        outTemp: row.avgOutTemp, // Rounded outTemp
                        setPoint: row.avgSetPoint, // Rounded setPoint
                    });
                });
            }

        } else if (previous === 'previousMonth') {
            const startOfPrevMonth = moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
            const endOfPrevMonth = moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

            const [rows] = await connection.execute(
                `SELECT 
                    DATE_FORMAT(dateTime, '%Y-%m-%d') AS dateTime,  
                    ROUND(AVG(outTemp), 2) AS avgOutTemp,  
                    ROUND(AVG(supply), 2) AS avgSupply,
                    ROUND(AVG(setPoint), 2) AS avgSetPoint
                    FROM temperature
                    WHERE deviceId = ? AND DATE(dateTime) BETWEEN ? AND ?
                    GROUP BY dateTime
                    ORDER BY DATE_FORMAT(dateTime, '%Y-%m-%d')`,
                [deviceId, startOfPrevMonth, endOfPrevMonth]
            );

            rows.forEach(row => {
                responseData.push({
                    dateTime: row.dateTime, // Date formatted as YYYY-MM-DD
                    supply: row.avgSupply, // Rounded supply
                    outTemp: row.avgOutTemp, // Rounded outTemp
                    setPoint: row.avgSetPoint, // Rounded setPoint
                });
            });

        } else if (previous === 'previousWeek') {
            const startOfPrevWeek = moment().subtract(1, 'weeks').startOf('week').format('YYYY-MM-DD');
            const endOfPrevWeek = moment().subtract(1, 'weeks').endOf('week').format('YYYY-MM-DD');

            const [rows] = await connection.execute(
                `SELECT 
                    DATE_FORMAT(dateTime, '%Y-%m-%d') AS dateTime,  
                    ROUND(AVG(outTemp), 2) AS avgOutTemp,  
                    ROUND(AVG(supply), 2) AS avgSupply,
                    ROUND(AVG(setPoint), 2) AS avgSetPoint
                    FROM temperature
                    WHERE deviceId = ? AND DATE(dateTime) BETWEEN ? AND ?
                    GROUP BY dateTime
                    ORDER BY DATE_FORMAT(dateTime, '%Y-%m-%d')`,
                [deviceId, startOfPrevWeek, endOfPrevWeek]
            );

            rows.forEach(row => {
                responseData.push({
                    dateTime: row.dateTime, // Date formatted as YYYY-MM-DD
                    supply: row.avgSupply, // Rounded supply
                    outTemp: row.avgOutTemp, // Rounded outTemp
                    setPoint: row.avgSetPoint, // Rounded setPoint
                });
            });
        } else {
            responseData = [];
        }

        return {
            success: true,
            data: responseData
        };

    } catch (err) {
        return {
            success: false,
            message: err.message || 'An error occurred'
        };
    }
}


exports.getStatistics = async (req, res) => {
    try {
     
        const device = req.body.deviceId;
        // const conversionFactor = 1;

        // Fetch total hours run
        const [totalHoursRunResult] = await connection.execute(`
            SELECT COUNT(*) as totalHoursRun
            FROM device_data_summary
            WHERE deviceId = ?`, [device]);

        // Fetch total kW used
        const [totalKWUsedResult] = await connection.execute(`
            SELECT ROUND(SUM(TKW), 2) as totalKWUsed
            FROM device_data_summary
            WHERE deviceId = ?`, [device]);


        // Fetch total waterConsum
        const [totalWaterUsedResult] = await connection.execute(`
           SELECT SUM(TWU) as waterConsum
           FROM device_data_summary
           WHERE deviceId = ?`, [device]);    



        // Fetch total kW used
        const [totalGhgResult] = await connection.execute(`
            SELECT 
              ROUND(((SUM(TKW) - 7.5) * energy_ghg_calculation.GHGe), 2) as AdjustedGHGe
                FROM device_data_summary
              INNER JOIN devices ON devices.deviceId = device_data_summary.deviceId
              INNER JOIN energy_ghg_calculation ON energy_ghg_calculation.deviceType = devices.device_type
            WHERE device_data_summary.deviceId = ? `, [device]);       
        
        // Extract values from results
        const totalHoursRun = totalHoursRunResult[0].totalHoursRun || 0;
        const totalKWUsed = totalKWUsedResult[0].totalKWUsed || 0;

        const totalWaterUsed = totalWaterUsedResult[0].waterConsum || 0;
        const ghgAvoided = totalGhgResult[0].AdjustedGHGe || 0;


        const statistics = [
            {
                name: 'Total Hours Run',
                value: `${totalHoursRun} Hrs`,
                message: ''
            },
            {
                name: 'Total kW Used',
                value: `${totalKWUsed} kWh`,
                message: ''
            },
            {
                name: 'Total Water Used',
                value: `${totalWaterUsed} Ltrs`,
                message: ''
            },
            {
                name: 'GHG Avoided',
                value: `${ghgAvoided} MT`,
                message: 'CO2 Equivalent'
            },
            
        ];
        
        return res.status(200).json({
            success: true,
            message: "Statistics List",
            data: statistics
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || 'An error occurred'
        });
    }
};

