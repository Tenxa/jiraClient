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
  // reporter: {
  //   user: {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: 'User'
  //   }
  // },
  priority: String,
  
})

issueSchema.statics.format = (user) => {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    adult: user.adult === undefined ? true : user.adult,
  }
}

const Issue = mongoose.model('Issue', issueSchema)

module.exports = Issue
