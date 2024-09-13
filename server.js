const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;  // Use PORT environment variable from Render
const secretKey = process.env.JWT_SECRET || 'your_secret_key';  // Use environment variable for JWT secret

// CORS options
const corsOptions = {
    origin: ['http://localhost:3000', 'https://cripankaj.netlify.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
};

app.use(cors(corsOptions));

// Middleware for body parsing
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Database configuration
const dbConfig = {
    user: process.env.DB_USER || 'Pankaj',
    password: process.env.DB_PASSWORD || 'Pandit@8013',
    server: process.env.DB_SERVER || 'criprod.database.windows.net',
    database: process.env.DB_NAME || 'MPS',
    options: {
        encrypt: true, 
        trustServerCertificate: false,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();

pool.on('error', err => {
    console.error('Database connection failed:', err);
});

async function keepAlive() {
    try {
        await poolConnect;
        console.log('Connected to the database');

        setInterval(async () => {
            try {
                const request = pool.request();
                await request.query('SELECT 1');
                console.log('Keeping connection alive');
            } catch (err) {
                console.error('Error executing keep-alive query:', err);
            }
        }, 60000);
    } catch (err) {
        console.error('Error connecting to the database:', err);
    }
}

keepAlive();

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}
// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login request received:', { username, password });

    try {
        const request = pool.request();
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, password);
        const result = await request.query('SELECT * FROM users WHERE username = @username AND password = @password');
        console.log('Query result:', result.recordset);

        const user = result.recordset[0];

        if (!user) {
            console.log('User not found');
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: user.id }, secretKey, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('Error querying database:', err);
        res.status(500).send('Server error');
    }
});

app.post('/api/plans', authenticateToken, async (req, res) => {
    const { Location, Unit, Start_date, Mc_no, Status, Customer_name, Code, Target_Qty,Order_Id } = req.body;

    try {
        const request = pool.request();
        request.input('Location', sql.NVarChar, Location);
        request.input('Unit', sql.NVarChar, Unit);
        request.input('Start_date', sql.Date, Start_date);
        request.input('Mc_no', sql.NVarChar, Mc_no);
        request.input('Status', sql.NVarChar, Status);
        request.input('Customer_name', sql.NVarChar, Customer_name);
        request.input('Code', sql.NVarChar, Code);
        request.input('Target_Qty', sql.Int, Target_Qty);
        request.input('Order_Id', sql.Int, Order_Id);

        const result = await request.query(`
            INSERT INTO [MPS].[dbo].[PlanTable] (
                [Location], [Unit], [Start_date], [Mc_no], [Status], 
                [Customer_name], [Code], [Target_Qty], [Order_Id]
            ) VALUES (
                @Location, @Unit, @Start_date, @Mc_no, @Status, 
                @Customer_name, @Code, @Target_Qty,@Order_Id
            )`);

        res.status(201).json({ message: 'Plan created successfully', result });
    } catch (err) {
        console.error('Error creating plan:', err);
        res.status(500).send('Server error');
    }
});

app.put('/api/plans/:Plan_id', authenticateToken, async (req, res) => {
    const { Plan_id } = req.params;
    const { Location, Unit, Start_date, Mc_no, Status, Customer_name, Code, Target_Qty, Order_Id } = req.body;

    try {
        const request = pool.request();
        request.input('Plan_id', sql.Int, Plan_id);
        request.input('Location', sql.NVarChar, Location);
        request.input('Unit', sql.NVarChar, Unit);
        request.input('Start_date', sql.Date, Start_date);
        request.input('Mc_no', sql.NVarChar, Mc_no);
        request.input('Status', sql.NVarChar, Status);
        request.input('Customer_name', sql.NVarChar, Customer_name);
        request.input('Code', sql.NVarChar, Code);
        request.input('Target_Qty', sql.Int, Target_Qty);
        request.input('Order_Id', sql.Int, Order_Id);

        const result = await request.query(`
            UPDATE [MPS].[dbo].[PlanTable]
            SET 
                [Location] = @Location, [Unit] = @Unit, [Start_date] = @Start_date,
                [Mc_no] = @Mc_no, [Status] = @Status, [Customer_name] = @Customer_name,
                [Code] = @Code, [Target_Qty] = @Target_Qty, [Order_Id] = @Order_Id
            WHERE [Plan_id] = @Plan_id
        `);

        res.status(200).json({ message: 'Plan updated successfully', result });
    } catch (err) {
        console.error('Error updating plan:', err.message);
        res.status(500).send('Server error');
    }
});


app.get('/api/plans', authenticateToken, async (req, res) => {
    try {
        const request = pool.request();
        const result = await request.query(`
            SELECT [Plan_id], [Location], [Unit], [Start_date], [Mc_no], [Status], 
                   [Customer_name], [Code], [Target_Qty], [Order_Id]
            FROM [MPS].[dbo].[PlanTable]
        `);

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching plans:', err.message);
        res.status(500).send('Server error');
    }
});


app.get('/api/plan-status', authenticateToken, async (req, res) => {
    try {
        const request = pool.request();
        const result = await request.query(`
            SELECT [Plan_id], [Location], [Unit], [Start_date], [Mc_no], 
                   [Status], [Customer_name], [Code], [Target_Qty], 
                   [Production], [Pending_Production]
            FROM [MPS].[dbo].[PlanStatus]`);
        
        console.log('Plan status data fetched:', result.recordset); // Log the fetched data
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching plan status data:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});



// Create a new product
app.post('/api/products', authenticateToken, async (req, res) => {
    const { Item_Code, Model, Material, Wire_Dia, Ball_Dia, Ball_Type, Tip_Length, Tip_Type, Ball_Roughness, Ink, ILD, Test_Parameter } = req.body;

    try {
        const request = pool.request();
        request.input('Item_Code', sql.NVarChar, Item_Code);
        request.input('Model', sql.VarChar, Model);
        request.input('Material', sql.VarChar, Material);
        request.input('Wire_Dia', sql.VarChar, Wire_Dia);
        request.input('Ball_Dia', sql.VarChar, Ball_Dia);
        request.input('Ball_Type', sql.VarChar, Ball_Type);
        request.input('Tip_Length', sql.VarChar, Tip_Length);
        request.input('Tip_Type', sql.VarChar, Tip_Type);
        request.input('Ball_Roughness', sql.VarChar, Ball_Roughness);
        request.input('Ink', sql.VarChar, Ink);
        request.input('ILD', sql.VarChar, ILD);
        request.input('Test_Parameter', sql.VarChar, Test_Parameter);

        const result = await request.query(`
            INSERT INTO [MPS].[dbo].[product] (
                [Item_Code], [Model], [Material], [Wire_Dia], [Ball_Dia], 
                [Ball_Type], [Tip_Length], [Tip_Type], [Ball_Roughness], [Ink], 
                [ILD], [Test_Parameter]
            ) VALUES (
                @Item_Code, @Model, @Material, @Wire_Dia, @Ball_Dia, 
                @Ball_Type, @Tip_Length, @Tip_Type, @Ball_Roughness, @Ink, 
                @ILD, @Test_Parameter
            )`);

        res.status(201).json({ message: 'Product created successfully', result });
    } catch (err) {
        console.error('Error creating product:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});


// Update an existing product
app.put('/api/products/:Product_Id', authenticateToken, async (req, res) => {
    const { Product_Id } = req.params;
    const { Item_Code, Model, Material, Wire_Dia, Ball_Dia, Ball_Type, Tip_Length, Tip_Type, Ball_Roughness, Ink, ILD, Test_Parameter } = req.body;

    try {
        console.log('Updating product with ID:', Product_Id); // Log the Product_Id being used

        const request = pool.request();
        
        // Add Product_Id as input parameter
        request.input('Product_Id', sql.Int, Product_Id);
        request.input('Item_Code', sql.NVarChar, Item_Code);
        request.input('Model', sql.VarChar, Model);
        request.input('Material', sql.VarChar, Material);
        request.input('Wire_Dia', sql.VarChar, Wire_Dia);
        request.input('Ball_Dia', sql.VarChar, Ball_Dia);
        request.input('Ball_Type', sql.VarChar, Ball_Type);
        request.input('Tip_Length', sql.VarChar, Tip_Length);
        request.input('Tip_Type', sql.VarChar, Tip_Type);
        request.input('Ball_Roughness', sql.VarChar, Ball_Roughness);
        request.input('Ink', sql.VarChar, Ink);
        request.input('ILD', sql.VarChar, ILD);
        request.input('Test_Parameter', sql.VarChar, Test_Parameter);

        // Include @Product_Id in the query
        const result = await request.query(`
            UPDATE [MPS].[dbo].[product]
            SET 
                [Item_Code] = @Item_Code, [Model] = @Model, [Material] = @Material, [Wire_Dia] = @Wire_Dia,
                [Ball_Dia] = @Ball_Dia, [Ball_Type] = @Ball_Type, [Tip_Length] = @Tip_Length,
                [Tip_Type] = @Tip_Type, [Ball_Roughness] = @Ball_Roughness, [Ink] = @Ink,
                [ILD] = @ILD, [Test_Parameter] = @Test_Parameter
            WHERE [Product_Id] = @Product_Id
        `);

        console.log('Rows affected:', result.rowsAffected); // Log rows affected

        if (result.rowsAffected[0] > 0) {
            res.status(200).json({ message: 'Product updated successfully', result });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (err) {
        console.error('Error updating product:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});



// Fetch all products
app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const request = pool.request();
        const result = await request.query(`
            SELECT [Item_Code], [Model], [Material], [Wire_Dia], [Ball_Dia], 
                   [Ball_Type], [Tip_Length], [Tip_Type], [Ball_Roughness], [Ink], 
                   [ILD], [Test_Parameter], [Product_Id]
            FROM [MPS].[dbo].[product]`);
        
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching products:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});
// Define the production entry API
app.post('/api/productions', authenticateToken, async (req, res) => {
    const { PlanID, ProductionDate, Shift, MachineNumber, Code, Quantity, SlipType, Remarks, OperatorName, InChargeName } = req.body;

    // Validate required fields
    if (!PlanID || !ProductionDate || !Quantity) {
        return res.status(400).send('PlanID, ProductionDate, and Quantity are required.');
    }

    try {
        const request = pool.request();

        // Add inputs for each parameter
        request.input('PlanID', sql.Int, PlanID);
        request.input('ProductionDate', sql.Date, ProductionDate);
        request.input('Shift', sql.VarChar, Shift); // Assuming Shift is a string
        request.input('MachineNumber', sql.VarChar, MachineNumber);
        request.input('Code', sql.VarChar, Code); // Correctly included Code
        request.input('Quantity', sql.Int, Quantity);
        request.input('SlipType', sql.VarChar, SlipType);
        request.input('Remarks', sql.VarChar, Remarks);
        request.input('OperatorName', sql.VarChar, OperatorName);
        request.input('InChargeName', sql.VarChar, InChargeName);

        // Perform the insert query
        const result = await request.query(`
            INSERT INTO [MPS].[dbo].[Production] (
                [PlanID], [ProductionDate], [Shift], [MachineNumber], [Code], [Quantity], [SlipType], [Remarks], [OperatorName], [InChargeName]
            ) VALUES (
                @PlanID, @ProductionDate, @Shift, @MachineNumber, @Code, @Quantity, @SlipType, @Remarks, @OperatorName, @InChargeName
            )
        `);

        // Respond with success message
        res.status(201).json({ message: 'Production entry created successfully', result });
    } catch (err) {
        console.error('Error creating production entry:', err);
        res.status(500).send('Server error');
    }
});

// Define the production bulk entry API
app.post('/api/productions/bulk', authenticateToken, async (req, res) => {
    const entries = req.body;

    // Validate entries
    if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).send('No production entries provided.');
    }

    // Validate each entry
    for (const entry of entries) {
        const { PlanID, ProductionDate, Quantity } = entry;
        if (!PlanID || !ProductionDate || !Quantity) {
            return res.status(400).send('Each entry must include PlanID, ProductionDate, and Quantity.');
        }
    }

    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        for (const entry of entries) {
            const { PlanID, ProductionDate, Shift, MachineNumber, Code, Quantity, SlipType, Remarks, OperatorName, InChargeName } = entry;

            const request = new sql.Request(transaction);
            request.input('PlanID', sql.Int, PlanID);
            request.input('ProductionDate', sql.Date, ProductionDate);
            request.input('Shift', sql.VarChar, Shift);
            request.input('MachineNumber', sql.VarChar, MachineNumber);
            request.input('Code', sql.VarChar, Code); // Correctly included Code
            request.input('Quantity', sql.Int, Quantity);
            request.input('SlipType', sql.VarChar, SlipType);
            request.input('Remarks', sql.VarChar, Remarks);
            request.input('OperatorName', sql.VarChar, OperatorName);
            request.input('InChargeName', sql.VarChar, InChargeName);

            await request.query(`
                INSERT INTO [MPS].[dbo].[Production] (
                    [PlanID], [ProductionDate], [Shift], [MachineNumber], [Code], [Quantity], [SlipType], [Remarks], [OperatorName], [InChargeName]
                ) VALUES (
                    @PlanID, @ProductionDate, @Shift, @MachineNumber, @Code, @Quantity, @SlipType, @Remarks, @OperatorName, @InChargeName
                )
            `);
        }

        await transaction.commit();
        res.status(201).json({ message: 'Bulk production entries created successfully' });
    } catch (err) {
        console.error('Error creating bulk production entries:', err);

        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error('Error rolling back transaction:', rollbackErr);
        }

        res.status(500).send('Server error');
    }
});


// Fetch PlanTable data for dropdown or pre-filling
app.get('/api/plan-data', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const result = await request.query(`
            SELECT * FROM [MPS].[dbo].[PlanTable]`);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching plan data:', err);
        res.status(500).send('Server error');
    }
});

// Fetch PlanTable units for dropdown
app.get('/api/plan-options', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const result = await request.query(`
            SELECT DISTINCT [Unit] FROM [MPS].[dbo].[PlanTable]`);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching plan options:', err);
        res.status(500).send('Server error');
    }
});

// Fetch Product data for dropdown
app.get('/api/product-options', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const result = await request.query(`
            SELECT DISTINCT [Item_Code] FROM [MPS].[dbo].[product]`);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching product options:', err);
        res.status(500).send('Server error');
    }
});

app.get('/api/production-data', authenticateToken, async (req, res) => {
    try {
        const { date, shift, unit } = req.query; // Get date, shift, and unit from query parameters
        
        const request = pool.request();
        let query = `
            SELECT ProductionId, ProductionDate, Shift, MachineNumber, Quantity, SlipType, Remarks,
                   OperatorName, InChargeName, Code, Location, Unit, Customer_name,
                   Model, Material, Wire_Dia, Ball_Dia, Ball_Type, Tip_Length, Tip_Type,
                   Ball_Roughness, Ink, ILD
            FROM [MPS].[dbo].[production_details]
            WHERE 1=1
        `;
        
        if (date) {
            query += ` AND ProductionDate = @date`;
            request.input('date', date);
        }
        if (shift) {
            query += ` AND Shift = @shift`;
            request.input('shift', shift);
        }
        if (unit) {
            query += ` AND Unit = @unit`;
            request.input('unit', unit);
        }

        const result = await request.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching production data:', err);
        res.status(500).send('Server error');
    }
});


app.get('/api/productions', authenticateToken, async (req, res) => {
    const { productionId } = req.query;

    try {
        const request = new sql.Request(pool);
        let query = 'SELECT * FROM [MPS].[dbo].[Production] WHERE 1=1';

        if (productionId) {
            console.log('Fetching production data with ProductionID:', productionId); // Logging
            query += ' AND [ProductionID] = @productionId';
            request.input('productionId', sql.Int, productionId);
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching production data:', err);
        res.status(500).send('Server error');
    }
});


app.post('/api/productions/update', authenticateToken, async (req, res) => {
    const { ProductionId, PlanID, ProductionDate, Shift, MachineNumber, Code, Quantity, SlipType, Remarks, OperatorName, InChargeName } = req.body;

    // Check for missing required fields
    if (!ProductionId || !PlanID || !ProductionDate || !Quantity) {
        console.error('Missing required fields:', { ProductionId, PlanID, ProductionDate, Quantity });
        return res.status(400).send('ProductionID, PlanID, ProductionDate, and Quantity are required.');
    }

    try {
        const request = new sql.Request(pool);

        // Logging for debugging
        console.log('Updating production with ProductionID:', ProductionId);

        // Set inputs for SQL query
        request.input('productionId', sql.Int, ProductionId);
        request.input('PlanID', sql.Int, PlanID);
        request.input('ProductionDate', sql.Date, new Date(ProductionDate)); // Ensure correct date format
        request.input('Shift', sql.VarChar, Shift);
        request.input('MachineNumber', sql.VarChar, MachineNumber);
        request.input('Code', sql.VarChar, Code);
        request.input('Quantity', sql.Int, Quantity);
        request.input('SlipType', sql.VarChar, SlipType);
        request.input('Remarks', sql.VarChar, Remarks);
        request.input('OperatorName', sql.VarChar, OperatorName);
        request.input('InChargeName', sql.VarChar, InChargeName);

        // Define the SQL query
        const query = `
            UPDATE [MPS].[dbo].[Production]
            SET 
                [PlanID] = @PlanID,
                [ProductionDate] = @ProductionDate,
                [Shift] = @Shift,
                [MachineNumber] = @MachineNumber,
                [Code] = @Code,
                [Quantity] = @Quantity,
                [SlipType] = @SlipType,
                [Remarks] = @Remarks,
                [OperatorName] = @OperatorName,
                [InChargeName] = @InChargeName
            WHERE [ProductionID] = @productionId
        `;

        // Execute the query
        await request.query(query);

        // Send success response
        res.status(200).json({ message: 'Production entry updated successfully' });
    } catch (err) {
        // Log the error and send server error response
        console.error('Error updating production entry:', err);
        res.status(500).send('Server error');
    }
});

app.post('/api/productions/updateAll', authenticateToken, async (req, res) => {
    const productions = req.body;

    // Check for empty request body
    if (!Array.isArray(productions) || productions.length === 0) {
        return res.status(400).send('Request body must be a non-empty array of productions.');
    }

    try {
        const request = new sql.Request(pool);

        // Loop through each production entry and apply updates
        for (const production of productions) {
            const {
                ProductionId,
                PlanID,
                ProductionDate,
                Shift,
                MachineNumber,
                Code,
                Quantity,
                SlipType,
                Remarks,
                OperatorName,
                InChargeName
            } = production;

            // Check for missing required fields in individual production entry
            if (!ProductionId || !PlanID || !ProductionDate || !Quantity) {
                console.error('Missing required fields for production:', { ProductionId, PlanID, ProductionDate, Quantity });
                continue; // Skip this production entry and continue with the next one
            }

            // Set inputs for SQL query
            request.input('productionId', sql.Int, ProductionId);
            request.input('PlanID', sql.Int, PlanID);
            request.input('ProductionDate', sql.Date, new Date(ProductionDate)); // Ensure correct date format
            request.input('Shift', sql.VarChar, Shift);
            request.input('MachineNumber', sql.VarChar, MachineNumber);
            request.input('Code', sql.VarChar, Code);
            request.input('Quantity', sql.Int, Quantity);
            request.input('SlipType', sql.VarChar, SlipType);
            request.input('Remarks', sql.VarChar, Remarks);
            request.input('OperatorName', sql.VarChar, OperatorName);
            request.input('InChargeName', sql.VarChar, InChargeName);

            // Define the SQL query
            const query = `
                UPDATE [MPS].[dbo].[Production]
                SET 
                    [PlanID] = @PlanID,
                    [ProductionDate] = @ProductionDate,
                    [Shift] = @Shift,
                    [MachineNumber] = @MachineNumber,
                    [Code] = @Code,
                    [Quantity] = @Quantity,
                    [SlipType] = @SlipType,
                    [Remarks] = @Remarks,
                    [OperatorName] = @OperatorName,
                    [InChargeName] = @InChargeName
                WHERE [ProductionID] = @productionId
            `;

            // Execute the query
            await request.query(query);
        }

        // Send success response
        res.status(200).json({ message: 'All production entries updated successfully' });
    } catch (err) {
        // Log the error and send server error response
        console.error('Error updating all production entries:', err);
        res.status(500).send('Server error');
    }
});



app.delete('/api/productions/:productionId', authenticateToken, async (req, res) => {
    const productionId = parseInt(req.params.productionId, 10);

    if (isNaN(productionId)) {
        console.error('Invalid ProductionID for deletion:', req.params.productionId); // Logging
        return res.status(400).send('Invalid ProductionID');
    }

    try {
        const request = new sql.Request(pool);
        console.log('Deleting production with ProductionID:', productionId); // Logging
        request.input('productionId', sql.Int, productionId);

        const query = 'DELETE FROM [MPS].[dbo].[Production] WHERE [ProductionID] = @productionId';
        await request.query(query);

        res.status(200).json({ message: 'Production entry deleted successfully' });
    } catch (err) {
        console.error('Error deleting production entry:', err);
        res.status(500).send('Server error');
    }
});


// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.header('Authorization').replace('Bearer ', '');

    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }

    // Implement your token verification logic here

    next();
}

// Orderbook create 
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { Order_Date, Customer_Name, Customer_ID, Product, Order_Qty, Order_Priority, Exp_Delivery_Date } = req.body;

    try {
        const request = pool.request();
        request.input('Order_Date', sql.Date, Order_Date);
        request.input('Customer_Name', sql.NVarChar, Customer_Name);
        request.input('Customer_ID', sql.Int, Customer_ID);
        request.input('Product', sql.NVarChar, Product);
        request.input('Order_Qty', sql.Int, Order_Qty);
        request.input('Order_Priority', sql.NVarChar, Order_Priority);
        request.input('Exp_Delivery_Date', sql.Date, Exp_Delivery_Date);

        const result = await request.query(`
            INSERT INTO [MPS].[dbo].[OrderBook] (
                [Order_Date], [Customer_Name], [Customer_ID], [Product], [Order_Qty], 
                [Order_Priority], [Exp_Delivery_Date]
            ) VALUES (
                @Order_Date, @Customer_Name, @Customer_ID, @Product, @Order_Qty, 
                @Order_Priority, @Exp_Delivery_Date
            )`);

        res.status(201).json({ message: 'Order created successfully', result });
    } catch (err) {
        console.error('Error creating order:', err);
        res.status(500).send('Server error');
    }
});

//Order book update
app.put('/api/orders/:Order_ID', authenticateToken, async (req, res) => {
    const { Order_ID } = req.params;
    const { Order_Date, Customer_Name, Customer_ID, Product, Order_Qty, Order_Priority, Exp_Delivery_Date } = req.body;

    try {
        const request = pool.request();
        request.input('Order_ID', sql.Int, Order_ID);
        request.input('Order_Date', sql.Date, Order_Date);
        request.input('Customer_Name', sql.NVarChar, Customer_Name);
        request.input('Customer_ID', sql.Int, Customer_ID);
        request.input('Product', sql.NVarChar, Product);
        request.input('Order_Qty', sql.Int, Order_Qty);
        request.input('Order_Priority', sql.NVarChar, Order_Priority);
        request.input('Exp_Delivery_Date', sql.Date, Exp_Delivery_Date);

        const result = await request.query(`
            UPDATE [MPS].[dbo].[OrderBook]
            SET 
                [Order_Date] = @Order_Date, [Customer_Name] = @Customer_Name, 
                [Customer_ID] = @Customer_ID, [Product] = @Product, [Order_Qty] = @Order_Qty, 
                [Order_Priority] = @Order_Priority, [Exp_Delivery_Date] = @Exp_Delivery_Date
            WHERE [Order_ID] = @Order_ID`);

        res.status(200).json({ message: 'Order updated successfully', result });
    } catch (err) {
        console.error('Error updating order:', err);
        res.status(500).send('Server error');
    }
});

// fetch oredrs

app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const request = pool.request();
        const result = await request.query(`
            SELECT [Order_ID], [Order_Date], [Customer_Name], [Customer_ID], [Product], 
                   [Order_Qty], [Order_Priority], [Exp_Delivery_Date]
            FROM [MPS].[dbo].[OrderBook]`);

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).send('Server error');
    }
});
// Order Statuss
app.get('/api/order-status', authenticateToken, async (req, res) => {
    try {
        const request = pool.request();
        const result = await request.query(`
            SELECT [Order_ID], [Order_Date], [Customer_Name], [Customer_ID], 
                   [Product], [Order_Qty], [Order_Priority], [Exp_Delivery_Date], 
                   [Production], [Active_Plans]
            FROM [MPS].[dbo].[OrderStatus]`);
        
        console.log('Order status data fetched:', result.recordset); // Log the fetched data
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching order status data:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
