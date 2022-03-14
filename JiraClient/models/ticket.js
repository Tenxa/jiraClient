const mongoose = require('mongoose')

// Tehdään päivitys kyselyt issueId mukaan.
// Jätetty kommenteiksi kenttiä, jos tarvii tulevaisuudessa formatointia
const ticketSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    //unique: true,
  },
  key: String,
  fields: {
    // issuetype: {
    //   self: String,
    //   id: String,
    //   description: String,
    //   name: String,
    //   subtask: Boolean,
    //   hierarchyLevel: Number
    // },
    // project: {
    //   key: String,
    //   id: String,
    //   name: String,
    //   projectTypeKey: String,
    //   simplified: Boolean
    // },
    // priority: {
    //   name: String,
    //   id: String
    // },
    // status: {
    //   description: String,
    //   name: String,
    //   id: String,
    //   statusCategory: {
    //     id: String,
    //     key: String,
    //     name: String
    //   },
    // },
    // creator: {
    //   accountId: String,
    //   emailAddress: String,
    //   displayName: String,
    //   active: Boolean,
    //   accountType: String
    // },
    // reporter: {
    //   accountId: String,
    //   emailAddress: String,
    //   displayName: String,
    //   active: Boolean,
    //   accountType: String
    // },
    // customfield_10018: {
    //   hasEpicLinkFieldDependency: Boolean,
    //   showField: Boolean,
    //   nonEditableReason: {
    //     reason: String,
    //     message: String,
    //   },
    // },
    // aggregateprogress: {
    //   progress: Number,
    //   total: Number,
    // },
    // progress: {
    //   progress: Number,
    //   total: Number
    // },
    // created: Date,
    // updated: Date,
    // assignee: String,
    // description: String,
    // summary: String,
    // timespent: String,
    // fixVersions: [String],
    // aggregatetimespent: String,
    // resolution: String,
    // resolutiondate: String,
    // workratio: Number,
    // labels: [String],
    // timeestimate: String,
    // aggregatetimeoriginalestimate: String,
    // components: [String],
    // subtasks: [String],
    // issuelinks: [String],
    // versions: [String],
    // environment: String,
    // duedate: Date,
    //parent: {},
  }
})


ticketSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.issueId = returnedObject.id
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

const Ticket = mongoose.model('Ticket', ticketSchema)

module.exports = Ticket
