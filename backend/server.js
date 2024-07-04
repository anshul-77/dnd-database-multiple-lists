//---------------libraries-----------------------------
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mysql from 'mysql2';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import axios from 'axios';






//-------------------instances-------------------------

dotenv.config();
const app = express();
const port = 5000;
const salt = 10;

app.use(cors({
    origin: ['http://localhost:3000'],
    methods : ["POST","GET","PUT","DELETE"],
    credentials : true
}));

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));






//-------------------db-connections-verifications-------------------------

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

const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.json({ Error: "You are not authenticated" });
    }

    jwt.verify(token, "jwt-secret-key", (err, decoded) => {
        if (err) {
            return res.json({ Error: "Token is not okay" });
        } else {
            req.name = decoded.name;
            next();
        }
    });
};

app.get('/', verifyUser, (req, res) => {
    res.json({ Status: "Success", name: req.name });
});










//-------------------login page routes------------------------------------



app.post('/register', (req, res) => {
    const sql = "INSERT INTO login (`name`, `email`, `password`) VALUES (?)";
    bcrypt.hash(req.body.password.toString(), salt, (err, hash) => {
        if (err) return res.json({ Error: "Error hashing password" });

        const values = [
            req.body.name,
            req.body.email,
            hash
        ]
        
        db.query(sql, [values], (err, result) => {
            if (err) return res.json({ Error: "Inserting data Error in server" });
            return res.json({ Status: 'Success' });
        })
    })
})

app.post('/login', (req, res) => {
    const sql = 'SELECT * FROM login WHERE email = ?';
    db.query(sql, [req.body.email], (err, data) => {
      if (err) return res.json({ Error: "Login error in server" });
  
      if (data.length > 0) {
        bcrypt.compare(req.body.password.toString(), data[0].password, (err, response) => {
          if (err) return res.json({ Error: "Password compare error" });
  
          if (response) {
            const name = data[0].name;
            const token = jwt.sign({ name }, "jwt-secret-key", { expiresIn: '1d' });
            res.cookie('token', token, { httpOnly: true });
            return res.json({ Status: "Success" });
          } else {
            return res.json({ Error: "Password not matched" });
          }
        });
      } else {
        return res.json({ Error: "No email existed" });
      }
    });
  });
  
  app.get('/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'Lax', // This can be 'Strict' or 'Lax' based on your requirements
      secure: true      // This should be true if you're running on HTTPS
    });
    return res.json({ Status: "Success" });
  });
  


app.get('/auth', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
      return res.json({ Status: "Failure", Error: "No token found" });
    }
  
    jwt.verify(token, "jwt-secret-key", (err, decoded) => {
      if (err) {
        return res.json({ Status: "Failure", Error: "Invalid token" });
      }
      return res.json({ Status: "Success", name: decoded.name });
    });
  });
  






//-------------------boards------------------------------------------------------------

app.get('/boards', (req, res) => {
    const { email } = req.query; // Get the email from query parameters
    if (!email) {
        return res.status(400).json({ error: "Email query parameter is required" });
    }

    db.query('SELECT * FROM boards WHERE email = ?', [email], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});


// Create a new board
app.post('/boards', (req, res) => {
    const { name, email } = req.body; // Get the name and email from the request body
    db.query('INSERT INTO boards (name, email) VALUES (?, ?)', [name, email], (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: result.insertId, name, email });
    });
  });
  









//-------------------lists-------------------------

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







//-------------------cards-------------------------
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


app.put('/cards/:id/update', (req, res) => {
    const { id } = req.params;
    const { title, content, list_id } = req.body;

    // Use COALESCE to maintain the existing value if no new value is provided
    const query = `
        UPDATE cards 
        SET 
            title = COALESCE(?, title), 
            content = COALESCE(?, content),
            list_id = COALESCE(?, list_id)
        WHERE id = ?
    `;
    const params = [title, content, list_id, id];

    db.query(query, params, (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Card updated successfully' });
    });
});








//-------------------card list update-------------------------
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












//-------------------deletion of cards,lista and boards-------------------------


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





//-------------------stamps-------------------------

// Fetch all stamp query
app.get('/stamps', (req, res) => {
    const email = req.query.email;
  
    db.query('SELECT * FROM stamps WHERE email = ?', [email], (err, results) => {
      if (err) {
        console.error('Error fetching stamps:', err);
        res.status(500).send('Internal server error');
        return;
      }
      res.json(results);
    });
  });




// Update a stamp
app.put('/stamps/:id', (req, res) => {
  const id = req.params.id;
  const { title, content, label } = req.body;
  
  db.query(
    'UPDATE stamps SET title = ?, content = ?, label = ? WHERE id = ?',
    [title, content, label === 'none' ? null : label, id],
    (err) => {
      if (err) {
        console.error('Error updating stamp:', err);
        res.status(500).send('Internal server error');
        return;
      }
      res.sendStatus(200);
    }
  );
});






// Delete a stamp
app.delete('/stamps/:id', (req, res) => {
    const id = req.params.id;
  
    db.query('DELETE FROM stamps WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('Error deleting stamp:', err);
        res.status(500).send('Internal server error');
        return;
      }
      res.sendStatus(200);
    });
  });



// Add a new stamp
app.post('/stamps', (req, res) => {
  const { email, title, content, label } = req.body;

  db.query(
    'INSERT INTO stamps (email, title, content, label) VALUES (?, ?, ?, ?)',
    [email, title, content, label === 'none' ? null : label],
    (err, result) => {
      if (err) {
        console.error('Error adding stamp:', err);
        res.status(500).send('Internal server error');
        return;
      }
      res.json({ id: result.insertId });
    }
  );
});










  //-------------------events-------------------------
  app.get('/events', (req, res) => {
    const userEmail = req.query.email; // Get the email from query parameters
    db.query('SELECT * FROM events WHERE email = ?', [userEmail], (err, results) => {
      if (err) {
        return res.status(500).send(err);
      }
      res.json(results);
    });
  });
  
  // Add a new event with the user email
  app.post('/events', (req, res) => {
    const { date, event, email } = req.body; // Include email in the request body
    db.query('INSERT INTO events (date, event, email) VALUES (?, ?, ?)', [date, event, email], (err, results) => {
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


// Fetch all profiles
/*app.get('/profile/email/:email', (req, res) => {
    const email = req.params.email;
    const sql = 'SELECT * FROM profiles WHERE email = ?';
    db.query(sql, [email], (err, result) => {
      if (err) throw err;
      res.json(result[0] || {});
    });
  });
  

  // Create a new profile
  app.post('/profile', (req, res) => {
    const newProfile = req.body;
    const sql = 'INSERT INTO profiles SET ?';
    db.query(sql, newProfile, (err, result) => {
      if (err) throw err;
      res.json({ id: result.insertId, ...newProfile });
    });
  });
  
  
  /* Get profile by user ID
  app.get('/profile/:userId', (req, res) => {
    const userId = req.params.userId;
    const sql = 'SELECT * FROM profiles WHERE id = ?';
    db.query(sql, [userId], (err, result) => {
      if (err) throw err;
      res.json(result[0] || {});
    });
  });
  
  // Update profile by user ID
  app.put('/profile/:userId', (req, res) => {
    const userId = req.params.userId;
    const profileData = req.body;
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid or missing profile ID' });
    }
    const sql = 'UPDATE profiles SET ? WHERE id = ?';
    db.query(sql, [profileData, userId], (err, result) => {
      if (err) {
        console.error('Error updating profile:', err);
        return res.status(500).json({ error: 'Failed to update profile' });
      }
      res.json(profileData);
    });
  });*/

//-------------------login details-profile section-------------------------

  app.get('/login-details/:email', (req, res) => {
    const email = req.params.email;
    const sql = 'SELECT name, email FROM login WHERE email = ?';
    db.query(sql, [email], (err, result) => {
      if (err) {
        console.error('Error fetching login details:', err);
        return res.status(500).json({ error: 'Failed to fetch login details' });
      }
      res.json(result[0] || {});
    });
  });





//-------------------profile-------------------------

  app.get('/profile/:email', (req, res) => {
    const email = req.params.email;
    const query = 'SELECT * FROM profiles WHERE email = ?';
  
    db.query(query, [email], (err, results) => {
      if (err) throw err;
      res.send(results[0]);
    });
  });

  app.post('/profiles', (req, res) => {
    const { name, email, phone, age, profile_pic } = req.body;
  
    const query = 'INSERT INTO profiles (name, email, phone, age, profile_pic) VALUES (?, ?, ?, ?, ?)';
    
    db.query(query, [name, email, phone, age, profile_pic], (err, result) => {
      if (err) throw err;
      res.send({ id: result.insertId, name, email, phone, age, profile_pic });
    });
  });
  

  app.put('/profiles/:email', (req, res) => {
    const { name, phone, age, profile_pic } = req.body;
    const email = req.params.email;
  
    const query = 'UPDATE profiles SET name = ?, phone = ?, age = ?, profile_pic = ? WHERE email = ?';
  
    db.query(query, [name, phone, age, profile_pic, email], (err, result) => {
      if (err) throw err;
      res.send({ message: 'Profile updated successfully' });
    });
  });
  
  
//---------------------to do list----------------------------------------------------

app.get('/to_do_lists', (req, res) => {
  const userEmail = req.query.userEmail;
  db.query('SELECT * FROM to_do_lists WHERE email = ?', [userEmail], (err, results) => {
    if (err) {
      console.error('Error fetching lists:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.post('/to_do_lists', (req, res) => {
  const { name, userEmail } = req.body;
  db.query('INSERT INTO to_do_lists (name, email) VALUES (?, ?)', [name, userEmail], (err, result) => {
    if (err) {
      console.error('Error creating list:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: result.insertId, name, userEmail });
  });
});

app.get('/to_do_lists/:listId/to_do_cards', (req, res) => {
  const { listId } = req.params;
  db.query('SELECT * FROM to_do_cards WHERE list_id = ?', [listId], (err, results) => {
    if (err) {
      console.error('Error fetching cards for list:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.post('/to_do_cards', (req, res) => {
  const { list_id, title, content } = req.body;
  db.query('INSERT INTO to_do_cards (list_id, title, content) VALUES (?, ?, ?)', [list_id, title, content], (err, result) => {
    if (err) {
      console.error('Error creating card:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: result.insertId, list_id, title, content });
  });
});

app.put('/to_do_cards/:id', (req, res) => {
  const { id } = req.params;
  const { list_id } = req.body;

  if (!list_id) {
    return res.status(400).json({ error: 'list_id is required' });
  }

  db.query('UPDATE to_do_cards SET list_id = ? WHERE id = ?', [list_id, id], (err, result) => {
    if (err) {
      console.error('Error updating card:', err);
      return res.status(500).json({ error: 'Error updating card' });
    }
    res.json({ message: 'Card updated successfully' });
  });
});


app.delete('/to_do_cards/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM to_do_cards WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting card:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Card deleted successfully' });
  });
});

app.delete('/to_do_lists/:id', (req, res) => {
  const { id } = req.params;
  db.beginTransaction(err => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: err.message });
    }
    db.query('DELETE FROM to_do_cards WHERE list_id = ?', [id], err => {
      if (err) {
        console.error('Error deleting cards for list:', err);
        return db.rollback(() => {
          res.status(500).json({ error: err.message });
        });
      }
      db.query('DELETE FROM to_do_lists WHERE id = ?', [id], err => {
        if (err) {
          console.error('Error deleting list:', err);
          return db.rollback(() => {
            res.status(500).json({ error: err.message });
          });
        }
        db.commit(err => {
          if (err) {
            console.error('Error committing transaction:', err);
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


//-------------------reading list-----------------------




// Get all reading list items
app.get('/reading-list', (req, res) => {
  const { email } = req.query; // Get the email from the query parameters
  const query = 'SELECT * FROM reading_list WHERE email = ?';
  db.query(query, [email], (err, results) => {
      if (err) {
          console.error(err.message);
          res.status(500).send('Server Error');
      } else {
          res.json(results);
      }
  });
});


// Add a new reading list item
app.post('/reading-list', (req, res) => {
  const { name, type, status, author, date_of_completion, email } = req.body;
  const query = 'INSERT INTO reading_list (name, type, status, author, date_of_completion, email) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(query, [name, type, status, author, date_of_completion, email], (err, results) => {
      if (err) {
          console.error(err.message);
          res.status(500).send('Server Error');
      } else {
          res.json({ id: results.insertId, ...req.body });
      }
  });
});

// Update a reading list item
app.put('/reading-list/:id', (req, res) => {
  const { id } = req.params;
  const { name, type, status, author, date_of_completion, email } = req.body;
  const query = 'UPDATE reading_list SET name = ?, type = ?, status = ?, author = ?, date_of_completion = ? WHERE id = ? AND email = ?';
  db.query(query, [name, type, status, author, date_of_completion, id, email], (err, results) => {
      if (err) {
          console.error(err.message);
          res.status(500).send('Server Error');
      } else {
          res.json({ id, ...req.body });
      }
  });
});


// Delete a reading list item
app.delete('/reading-list/:id', (req, res) => {
  const { id } = req.params;
  const { email } = req.body; // Get the email from the request body
  const query = 'DELETE FROM reading_list WHERE id = ? AND email = ?';
  db.query(query, [id, email], (err, results) => {
      if (err) {
          console.error(err.message);
          res.status(500).send('Server Error');
      } else {
          res.json({ id });
      }
  });
});

//-------------------book api------------------------------------------------

app.get('/suggest-book', async (req, res) => {
  try {
    const response = await axios.get('https://openlibrary.org/subjects/fiction.json?limit=1');
    const book = response.data.works[0];

    // Extract necessary book details
    const suggestedBook = {
      title: book.title,
      authors: book.authors ? book.authors.map(author => author.name) : ['Unknown'],
      description: book.subject ? book.subject.join(', ') : 'No description available',
    };

    res.json(suggestedBook);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

//------------------------gantcharttasks--------------------------------------------------------// Get all tasks
app.get('/tasks', (req, res) => {
  const email = req.query.email;
  db.query('SELECT * FROM tasks WHERE email = ?', [email], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Error fetching tasks' });
    } else {
      res.json(results);
    }
  });
});

app.post('/tasks', (req, res) => {
  const { title, start_date, end_date, progress, email } = req.body;
  db.query(
    'INSERT INTO tasks (title, start_date, end_date, progress, email) VALUES (?, ?, ?, ?, ?)',
    [title, start_date, end_date, progress, email],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: 'Error adding task' });
      } else {
        res.status(201).json({ id: result.insertId });
      }
    }
  );
});

app.put('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, start_date, end_date, progress } = req.body;
  db.query(
    'UPDATE tasks SET title = ?, start_date = ?, end_date = ?, progress = ? WHERE id = ?',
    [title, start_date, end_date, progress, id],
    (err) => {
      if (err) {
        res.status(500).json({ error: 'Error updating task' });
      } else {
        res.status(200).json({ message: 'Task updated successfully' });
      }
    }
  );
});

app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM tasks WHERE id = ?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: 'Error deleting task' });
    } else {
      res.status(200).json({ message: 'Task deleted successfully' });
    }
  });
});
//-------------------server port-------------------------

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

