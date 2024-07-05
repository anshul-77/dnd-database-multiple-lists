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

    // Get all boards
    app.get('/boards', (req, res) => {
        db.query('SELECT * FROM boards', (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(results);
        });
    });

    // Create a new board
    app.post('/boards', (req, res) => {
        const { name } = req.body;
        db.query('INSERT INTO boards (name) VALUES (?)', [name], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: result.insertId, name });
        });
    });

    // Get all lists for a board
    app.get('/boards/:boardId/lists', (req, res) => {
        const { boardId } = req.params;
        db.query('SELECT * FROM lists WHERE board_id = ?', [boardId], (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(results);
        });
    });

    // Create a new list within a board
    app.post('/lists', (req, res) => {
        const { board_id, name } = req.body;
        db.query('INSERT INTO lists (board_id, name) VALUES (?, ?)', [board_id, name], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: result.insertId, board_id, name });
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

    app.delete('/boards/:id', (req, res) => {
        const { id } = req.params;
        db.beginTransaction(err => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Delete all cards associated with the board's lists
            db.query(
                'DELETE cards FROM cards JOIN lists ON cards.list_id = lists.id WHERE lists.board_id = ?',
                [id],
                err => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: err.message });
                        });
                    }

                    // Delete all lists associated with the board
                    db.query('DELETE FROM lists WHERE board_id = ?', [id], err => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: err.message });
                            });
                        }

                        // Delete the board itself
                        db.query('DELETE FROM boards WHERE id = ?', [id], err => {
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
                                res.json({ message: 'Board and its lists and cards deleted successfully' });
                            });
                        });
                    });
                }
            );
        });
    });

    /*app.get('/boards', (req, res) => {
        const query = `
            SELECT 
                b.id, b.name, 
                (SELECT COUNT(*) FROM lists l WHERE l.board_id = b.id) AS listCount,
                (SELECT COUNT(*) FROM cards c JOIN lists l ON c.list_id = l.id WHERE l.board_id = b.id) AS cardCount
            FROM boards b
        `;
        db.query(query, (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(results);
        });
    });*/







    // Fetch all stamp query
    app.get('/stamps', (req, res) => {
        db.query('SELECT * FROM stamps', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
        });
    });
    
    
    
    
    // Update a stamp
    app.put('/stamps/:id', (req, res) => {
        const { id } = req.params;
        const { title, content } = req.body;
        db.query('UPDATE stamps SET title = ?, content = ? WHERE id = ?', [title, content, id], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json({ message: 'Card updated successfully!' });
        });
    });
    
    
    
    
    
    // Delete a stamp
    app.delete('/stamps/:id', (req, res) => {
        const { id } = req.params;
        db.query('DELETE FROM stamps WHERE id = ?', [id], (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json({ message: 'Card deleted successfully!' });
        });
    });
    
    
    
    
    // Add a new stamp
 // Add a new stamp
app.post('/stamps', (req, res) => {
    const { title, content } = req.body;
    db.query('INSERT INTO stamps (title, content) VALUES (?, ?)', [title, content], (err, results) => {
      if (err) {
        return res.status(500).send(err);
      }
      // Ensure the response includes the new ID
      res.json({ message: 'Card added successfully!', id: results.insertId });
    });
  });
  

  app.get('/events', (req, res) => {
    db.query('SELECT * FROM events', (err, results) => {
      if (err) {
        return res.status(500).send(err);
      }
      res.json(results);
    });
  });
  
  
  
  
  
  // Add a new event
  app.post('/events', (req, res) => {
    const { date, event } = req.body;
    db.query('INSERT INTO events (date, event) VALUES (?, ?)', [date, event], (err, results) => {
      if (err) {
        return res.status(500).send(err);
      }
      res.json({ message: 'Event added successfully!', id: results.insertId });
    });
  });
  
  
  
  
  
  // Update an event
  app.put('/events/:id', (req, res) => {
    const { id } = req.params;
    const { date, event } = req.body;
    db.query('UPDATE events SET date = ?, event = ? WHERE id = ?', [date, event, id], (err, results) => {
      if (err) {
        return res.status(500).send(err);
      }
      res.json({ message: 'Event updated successfully!' });
    });
  });
  
  
  
  
  
  // Delete an event
  app.delete('/events/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM events WHERE id = ?', [id], (err, results) => {
      if (err) {
        return res.status(500).send(err);
      }
      res.json({ message: 'Event deleted successfully!' });
    });
  });
  
  


    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
