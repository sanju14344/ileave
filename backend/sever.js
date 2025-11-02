const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'your_jwt_secret_key';

// Middleware
app.use(cors());
app.use(express.json());

// Database initialization
const db = new sqlite3.Database('./eduleave.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student', 'advisor', 'hod', 'admin')),
            department_id INTEGER,
            class_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Departments table
        db.run(`CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            code TEXT NOT NULL UNIQUE
        )`);

        // Classes table
        db.run(`CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            department_id INTEGER,
            advisor_id INTEGER,
            FOREIGN KEY (department_id) REFERENCES departments(id),
            FOREIGN KEY (advisor_id) REFERENCES users(id)
        )`);

        // Leave applications table
        db.run(`CREATE TABLE IF NOT EXISTS leave_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            leave_type TEXT NOT NULL CHECK(leave_type IN ('sick', 'casual', 'emergency', 'personal')),
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            reason TEXT NOT NULL,
            document_path TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved_advisor', 'rejected_advisor', 'approved_hod', 'rejected_hod')),
            advisor_remark TEXT,
            hod_remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id)
        )`);

        // Insert sample data
        insertSampleData();
    });
}

function insertSampleData() {
    // Check if data already exists
    db.get("SELECT COUNT(*) as count FROM departments", (err, row) => {
        if (row.count === 0) {
            // Insert departments
            const departments = [
                { name: 'Computer Science', code: 'CS' },
                { name: 'Electronics', code: 'EC' },
                { name: 'Mechanical', code: 'ME' },
                { name: 'Civil', code: 'CE' }
            ];

            const insertDept = db.prepare("INSERT INTO departments (name, code) VALUES (?, ?)");
            departments.forEach(dept => {
                insertDept.run([dept.name, dept.code]);
            });
            insertDept.finalize();

            // Hash default password
            const hashedPassword = bcrypt.hashSync('password123', 10);

            // Insert admin user
            db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
                ['admin@college.edu', hashedPassword, 'System Admin', 'admin']);

            console.log('Sample data inserted successfully');
        }
    });
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, role, department_id, class_id } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(`INSERT INTO users (email, password, name, role, department_id, class_id) 
                VALUES (?, ?, ?, ?, ?, ?)`,
            [email, hashedPassword, name, role, department_id, class_id],
            function(err) {
                if (err) {
                    return res.status(400).json({ error: 'User already exists' });
                }
                res.status(201).json({ 
                    message: 'User created successfully',
                    userId: this.lastID 
                });
            });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                name: user.name 
            }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                department_id: user.department_id,
                class_id: user.class_id
            }
        });
    });
});

// Leave application routes
app.post('/api/leave/applications', authenticateToken, (req, res) => {
    const { leave_type, start_date, end_date, reason, document_path } = req.body;
    const student_id = req.user.id;

    db.run(`INSERT INTO leave_applications 
            (student_id, leave_type, start_date, end_date, reason, document_path) 
            VALUES (?, ?, ?, ?, ?, ?)`,
        [student_id, leave_type, start_date, end_date, reason, document_path],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create leave application' });
            }
            res.status(201).json({ 
                message: 'Leave application submitted successfully',
                applicationId: this.lastID 
            });
        });
});

app.get('/api/leave/applications', authenticateToken, (req, res) => {
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = `
        SELECT la.*, u.name as student_name, u.email as student_email,
               d.name as department_name, c.name as class_name
        FROM leave_applications la
        JOIN users u ON la.student_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE 1=1
    `;
    const params = [];

    if (userRole === 'student') {
        query += ' AND la.student_id = ?';
        params.push(userId);
    } else if (userRole === 'advisor') {
        query += ` AND u.class_id IN (
            SELECT id FROM classes WHERE advisor_id = ?
        ) AND la.status IN ('pending', 'approved_advisor')`;
        params.push(userId);
    } else if (userRole === 'hod') {
        query += ' AND u.department_id = ? AND la.status IN ("approved_advisor", "approved_hod", "rejected_hod")';
        params.push(req.user.department_id);
    }

    query += ' ORDER BY la.created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch leave applications' });
        }
        res.json(rows);
    });
});

app.put('/api/leave/applications/:id/advisor-action', authenticateToken, (req, res) => {
    const { action, remark } = req.body;
    const applicationId = req.params.id;
    const advisorId = req.user.id;

    if (req.user.role !== 'advisor') {
        return res.status(403).json({ error: 'Only advisors can perform this action' });
    }

    const status = action === 'approve' ? 'approved_advisor' : 'rejected_advisor';

    db.run(`UPDATE leave_applications 
            SET status = ?, advisor_remark = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND status = 'pending'`,
        [status, remark, applicationId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update application' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Application not found or already processed' });
            }
            res.json({ message: `Leave application ${action}d successfully` });
        });
});

app.put('/api/leave/applications/:id/hod-action', authenticateToken, (req, res) => {
    const { action, remark } = req.body;
    const applicationId = req.params.id;

    if (req.user.role !== 'hod') {
        return res.status(403).json({ error: 'Only HODs can perform this action' });
    }

    const status = action === 'approve' ? 'approved_hod' : 'rejected_hod';

    db.run(`UPDATE leave_applications 
            SET status = ?, hod_remark = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND status = 'approved_advisor'`,
        [status, remark, applicationId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update application' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Application not found or already processed' });
            }
            res.json({ message: `Leave application ${action}d successfully` });
        });
});

// Department routes
app.get('/api/departments', authenticateToken, (req, res) => {
    db.all("SELECT * FROM departments ORDER BY name", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch departments' });
        }
        res.json(rows);
    });
});

// User management routes
app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const query = `
        SELECT u.*, d.name as department_name, c.name as class_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN classes c ON u.class_id = c.id
        ORDER BY u.role, u.name
    `;

    db.all(query, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});