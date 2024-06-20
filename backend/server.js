    const express = require('express');
    const bodyParser = require('body-parser');
    const cors = require('cors');
    const mysql = require('mysql2');
    require('dotenv').config();

    const app = express();
    const port = 5000;

    app.use(cors());
    app.use(bodyParser.json());

    const db = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
    });

    db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
    });

    // Define routes here

    // Get all lists
    app.get('/lists', (req, res) => {
    db.query('SELECT * FROM lists', (err, results) => {
        if (err) {
        return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
    });

    // Create a new list
    app.post('/lists', (req, res) => {
    const { name } = req.body;
    db.query('INSERT INTO lists (name) VALUES (?)', [name], (err, result) => {
        if (err) {
        return res.status(500).json({ error: err.message });
        }
        res.json({ id: result.insertId, name });
    });
    });

    // Get all cards for a list
    app.get('/lists/:listId/cards', (req, res) => {
    const { listId } = req.params;
    db.query('SELECT * FROM cards WHERE list_id = ?', [listId], (err, results) => {
        if (err) {
        return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
    });

    // Create a new card
    app.post('/cards', (req, res) => {
    const { list_id, title, content } = req.body;
    db.query('INSERT INTO cards (list_id, title, content) VALUES (?, ?, ?)', [list_id, title, content], (err, result) => {
        if (err) {
        return res.status(500).json({ error: err.message });
        }
        res.json({ id: result.insertId, list_id, title, content });
    });
    });

    // Update a card's list_id (for drag and drop)
    app.put('/cards/:id', (req, res) => {
    const { id } = req.params;
    const { list_id } = req.body;
    db.query('UPDATE cards SET list_id = ? WHERE id = ?', [list_id, id], (err) => {
        if (err) {
        return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Card updated successfully' });
    });
    });

    // Delete a card
    app.delete('/cards/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM cards WHERE id = ?', [id], (err) => {
        if (err) {
        return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Card deleted successfully' });
    });
    });

    // Delete a list and its cards
app.delete('/lists/:id', (req, res) => {
    const { id } = req.params;
    db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        db.query('DELETE FROM cards WHERE list_id = ?', [id], err => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ error: err.message });
                });
            }
            db.query('DELETE FROM lists WHERE id = ?', [id], err => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ error: err.message });
                    });
                }
                db.commit(err => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: err.message });
                        });
                    }
                    res.json({ message: 'List and its cards deleted successfully' });
                });
            });
        });
    });
});

    app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    });
