const { connection, CustomError } = require('../config/dbSql2');
const utility = require('../utility/utilityFunction');
const bcrypt = require('bcrypt');

/*
exports.register = async (req, res) => {
    try {
        const user = req.body;
        // NOTE :  afiliateCode = companyCode

        // Check if required properties are present in the user object
        if (!user.fullName || !user.email || !user.password || !user.mobile || !user.afiliateCode) {
            return res.status(400).json({ success: false, message: "Missing required user information." });
        }
        const [rows, fields] = await connection.execute(`SELECT * FROM users WHERE email = ? AND afiliateCode = ?`, [user.email, user.afiliateCode]);
        if (rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email is already exists!" });
        }
        const hashedPassword = await bcrypt.hash(user.password, 10);
        const storeQuery = 'INSERT INTO users (companyName, userName, email, phoneNo,address,city, afiliateCode, password, userRole) VALUES (?, ?, ?, ?,?, ?, ?,?,?)';
        const values = [user.companyName, user.fullName, user.email, user.mobile, user.address, user.city, user.afiliateCode, hashedPassword, user.userRole];
        const [sRows] = await connection.execute(storeQuery, values);
        if (sRows.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "User Registration successfully" });
        } else {
            throw new CustomError("Something went wrong!");
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
};
*/

exports.register = async (req, res) => {
    try {
        const user = req.body;
        // NOTE :  afiliateCode = companyCode

        // Check if required properties are present in the user object
        if (!user.fullName || !user.email || !user.password || !user.mobile || !user.afiliateCode) {
            return res.status(400).json({ success: false, message: "Missing required user information." });
        }

        const [rows, fields] = await connection.execute(
            `SELECT * FROM users WHERE email = ? AND afiliateCode = ? AND userRole = ?`,
            [user.email, user.afiliateCode, user.userRole]
        );

        if (user.userRole === 'customer') {
            const [sameAffiliateCode, sameAffiliateCodeFields] = await connection.execute(
                `SELECT * FROM users WHERE afiliateCode = ? AND userRole = ?`,
                [user.afiliateCode, 'customer']
            );
            if (sameAffiliateCode.length > 0) {
                return res.status(400).json({ success: false, message: "Email or Affiliate code already exists!" });
            }
        }

        if (rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email or Affiliate code already exists!" });
        }

        const hashedPassword = await bcrypt.hash(user.password, 10);
        const storeQuery = 'INSERT INTO users (companyName, userName, email, phoneNo, address, city, afiliateCode, password, userRole) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const values = [user.companyName, user.fullName, user.email, user.mobile, user.address, user.city, user.afiliateCode, hashedPassword, user.userRole];
        const [sRows] = await connection.execute(storeQuery, values);

        if (sRows.affectedRows > 0) {
            const userId = sRows.insertId;

            // Insert into corresponding table based on user role
            if (user.userRole === 'affiliate') {
                const affiliateQuery = 'INSERT INTO affiliate (companyName, userName, userId, email, phoneNo, address, city, afiliateCode, userRole) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
                await connection.execute(affiliateQuery, [user.companyName, user.fullName, userId, user.email, user.mobile, user.address, user.city, user.afiliateCode, user.userRole]);
            } else if (user.userRole === 'customer') {
                const customerQuery = 'INSERT INTO customers (companyName, userName, userId, email, phoneNo, address, city, afiliateCode, userRole) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
                await connection.execute(customerQuery, [user.companyName, user.fullName, userId, user.email, user.mobile, user.address, user.city, user.afiliateCode, user.userRole]);
            }
            return res.status(200).json({ success: true, message: "User Registration successful" });
        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};

exports.store = async (req, res) => {
    try {
        const user = req.body;
        const afiliateCode = req.headers.afiliatecode;
        const userRole = req.headers.userrole;
        let role;
        if (!afiliateCode) {
            return res.status(400).json({ success: false, message: "Missing Afiliate Code in request headers." });
        }

        const [rows, fields] = await connection.execute(`SELECT * FROM users WHERE email = ?`, [user.email]);
        if (rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email is already exists!" });
        }
        if (userRole === 'ambiator') {
            role = 'ambiator'
        } else {
            role = user.userRole
        }

        const hashedPassword = await bcrypt.hash(user.password, 10);
        const storeQuery = 'INSERT INTO users (companyName, userName, email, phoneNo, afiliateCode, password, userRole, address, city) VALUES (?, ?, ?, ?,?, ?, ?, ?, ?)';
        const values = [user.companyName, user.fullName, user.email, user.mobile, user.afiliateCode, hashedPassword, role, user.address, user.city];
        const [sRows] = await connection.execute(storeQuery, values);

        if (sRows.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "User added successfully" });
        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
};

exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        const user = req.body;

        // Check if required properties are present in the user object
        if (!user.userName || !user.email || !user.phoneNo || !user.password) {
            return res.status(400).json({ success: false, message: "Missing required user information." });
        }

        // Fetch the user to be updated
        const [existingUser] = await connection.execute(`SELECT * FROM users WHERE id = ?`, [id]);

        if (existingUser.length === 0) {
            return res.status(404).json({ success: false, message: "User not found!" });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(user.password, 10);


        // Prepare the update query and values
        const updateQuery = `UPDATE users SET userName = ?, email = ?, phoneNo = ?, password = ? WHERE id = ?`;
        const values = [user.userName, user.email, user.phoneNo, hashedPassword, id];

        // Execute the update query
        const [updateResult] = await connection.execute(updateQuery, values);

        if (updateResult.affectedRows > 0) {
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
        const [fRows] = await connection.execute(`SELECT * FROM users WHERE id = ?`, [id]);
        if (fRows.length == 0) {
            throw new CustomError("User not found!", 404);
        }
        const [DRows] = await connection.execute(`DELETE from users WHERE id = ?`, [id]);
        return res.status(200).json({ success: true, message: "Successfully deleted" });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}

/*
exports.show = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode;
        const userRole = req.headers.userrole;


        const [rows] = await connection.execute(`SELECT * FROM users WHERE afiliateCode = ?`, [afiliateCode]);

        if (userRole != 'ambiator') {
            query += `, afiliateCode = ?`;
            values.push(afiliateCode);
        }
     
      
        if (rows.length >= 0) {
            return res.status(200).json({
                success: true,
                message: "Users list",
                data: rows
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
}*/

exports.show = async (req, res) => {
    try {
        const afiliateCode = req.headers.afiliatecode;
        const userRole = req.headers.userrole;
        let query = `SELECT * FROM users`;
        const values = [];

        // Check if the user role is 'ambiator'
        if (userRole !== 'ambiator') {
            // If not 'ambiator', add the affiliate code condition to the query
            query += ` WHERE afiliateCode = ?`;
            values.push(afiliateCode);
        }

        // Execute the SQL query with dynamic conditions
        const [rows] = await connection.execute(query, values);

        // Check if users are found
        if (rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Users list",
                data: rows
            });
        } else {
            return res.status(404).json({ success: false, message: "No users found" });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}

exports.resetPassword = async (req, res) => {
    try {
        const afiliate = req.headers.afiliatecode;
        const email = req.headers.email;
        const { oldPassword, newPassword } = req.body;

        const [userRows] = await connection.execute(`SELECT * FROM users WHERE email = ?`, [email]);

        if (userRows.length === 0) {
            throw new CustomError("User not found!", 404);
        }

        const user = userRows[0];

        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

        if (!isPasswordValid) {
            throw new CustomError("Old password is not valid!");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await connection.execute(`UPDATE users SET password = ? WHERE email = ?`, [hashedPassword, email]);

        return res.status(200).json({ success: true, message: "Password reset successful" });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};

exports.showAll = async (req, res) => {
    try {

        const [rows] = await connection.execute(`SELECT * FROM users`, []);

        // Check if users are found
        if (rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Users list",
                data: rows
            });
        } else {
            return res.status(404).json({ success: false, message: "No users found" });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
}
