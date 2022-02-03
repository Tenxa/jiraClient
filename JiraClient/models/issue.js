const mongoose = require('mongoose')

const issueSchema = new mongoose.Schema({
  issueId: String,
  key: String,
  fields: {
    issuetype: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issuetype'
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    created: Date,
    priority: {
      name: String,
      id: String
    },
    status: {
      description: String,
      name: String,
      id: String,
      statusCategory: {
        id: String,
        key: String,
        name: String
      },
    },
    description: String,
    summary: String,
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AtlassianUser'
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AtlassianUser'
    },
  },
  priority: String,
  
})

issueSchema.set('toJSON', {
  transform: (document, returnedObject) => {
      returnedObject.id = returnedObject._id.toString()
      delete returnedObject._id
      delete returnedObject.__v
  }
})

const Issue = mongoose.model('Issue', issueSchema)

module.exports = Issue
