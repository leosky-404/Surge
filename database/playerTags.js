const { Schema, model } = require('mongoose');

const playerTagsSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    playerTag: {
        type: String,
        required: true
    }
});

module.exports = model('brawlStarsTags', playerTagsSchema);