const mongoose = require('mongoose')

// Tehdään päivitys kyselyt issueId mukaan.
// Jätetty kommenteiksi kenttiä, jos tarvii tulevaisuudessa formatointia
const epicSchema = new mongoose.Schema({
    epicName: String,
    toWhichTheme: String,
    storyStatusesCount: {
        toDo: Number,
        inProgress: Number,
        done: Number
    },
    relativeSize: Number,
    active: Boolean,
    delta: Number,
    monteCarloCurrent: Date,
    monteCarloRealistic: Date,
    monteCarloPessimistic: Date
})


epicSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

const Epic = mongoose.model('Epic', epicSchema)

module.exports = Epic