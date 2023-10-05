const mongoose = require('mongoose');
const { mongoDBUri } = require('../config.json');

async function connectToDatabase() {
    try {
        mongoose.set('strictQuery', false);
        await mongoose.connect(mongoDBUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: 'Surge'
        });
        console.log('Connected to Database.');
    } catch (error) {
        console.error('Error connecting to database: ', error);
        process.exit(1);
    }
}

module.exports = connectToDatabase;