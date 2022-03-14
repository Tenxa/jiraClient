const mongoose = require('mongoose')

// Tehdään päivitys kyselyt issueId mukaan.
// Jätetty kommenteiksi kenttiä, jos tarvii tulevaisuudessa formatointia
const featureSchema = new mongoose.Schema({
    featureName: String,
    toWhichEpic: String,
    storyStatusesCount: {
        toDo: Number,
        inProgress: Number,
        done: Number
    },
    storiesForFeatureBasic,
    key: String,
    fields: {

    }
})


featureSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

const Feature = mongoose.model('Feature', featureSchema)

module.exports = Feature
