const mysql = require('mysql');
const express = require('express');
const { spawn } = require('child_process');

const app = express();
const port = 3000;

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root1234',
    database: 'tambola',
};

const pool = mysql.createPool(dbConfig);

// ... (your existing code)

app.get('/generate-tickets', (req, res) => {
    const process = spawn('java', ['-jar', './Solution.jar']);

    let javaOutput = '';

    process.stdout.on('data', (data) => {
        javaOutput += data.toString();
    });

    process.stderr.on('data', (data) => {
        console.error(`Java process stderr: ${data}`);
    });

    process.on('exit', (code) => {
        if (code === 0) {
            console.log(`Java process output: ${javaOutput}`);

            // Parse the javaOutput and insert data into MySQL
            const tickets = parseJavaOutput(javaOutput);
            insertTicketsIntoDB(tickets, (err) => {
                if (err) {
                    console.error(`Error inserting data into MySQL: ${err.message}`);
                    res.status(500).send('Error generating tickets.');
                } else {
                    res.send('Tickets generated and saved successfully.');
                }
            });
        } else {
            console.error(`Error generating tickets. Java process exited with code ${code}`);
            res.status(500).send('Error generating tickets.');
        }
    });
});

app.get('/fetch-tickets/:set_id', (req, res) => {
    const { set_id } = req.params;

    fetchTicketsBySet(set_id, (err, tickets) => {
        if (err) {
            console.error(`Error fetching tickets from MySQL: ${err.message}`);
            res.status(500).send('Error fetching tickets.');
        } else {
            res.json({ tickets });
        }
    });
});

function fetchTicketsBySet(set_id, callback) {
    pool.getConnection((err, connection) => {
        if (err) {
            callback(err);
            return;
        }

        const selectQuery = 'SELECT * FROM tickets WHERE set_id = ?';

        connection.query(selectQuery, [set_id], (queryErr, results) => {
            if (queryErr) {
                console.error(`Error fetching data: ${queryErr.message}`);
                callback(queryErr);
            } else {
                const tickets = results.map((row) => ({
                    row1: row.row1.split(',').map(Number),
                    row2: row.row2.split(',').map(Number),
                    row3: row.row3.split(',').map(Number),
                }));
                callback(null, tickets);
            }
        });

        connection.release();
    });
}

function insertTicketsIntoDB(tickets, callback) {
    pool.getConnection((err, connection) => {
        if (err) {
            callback(err);
            return;
        }

        const insertQuery = 'INSERT INTO tickets (row1, row2, row3, set_id) VALUES (?, ?, ?, ?)';

        tickets.forEach((ticket) => {
            const values = [ticket.row1.join(','), ticket.row2.join(','), ticket.row3.join(','), 1]; // Assuming set_id is 1

            connection.query(insertQuery, values, (queryErr) => {
                if (queryErr) {
                    console.error(`Error inserting data: ${queryErr.message}`);
                    callback(queryErr);
                }
            });
        });

        connection.release();
        callback(null);
    });
}

// Helper function to parse Java output and convert it to an array of ticket objects
function parseJavaOutput(javaOutput) {
    const ticketsArray = javaOutput.trim().split('\n\n\n'); // Assuming three new lines separate tickets

    const tickets = ticketsArray.map((ticketString) => {
        const rows = ticketString.split('\n');

        return {
            row1: rows[0].split(',').map(Number),
            row2: rows[1].split(',').map(Number),
            row3: rows[2].split(',').map(Number),
        };
    });

    return tickets;
}

// ... (rest of your existing code)

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});


