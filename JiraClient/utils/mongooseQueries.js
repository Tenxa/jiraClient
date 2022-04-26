const Ticket = require('../models/ticket')
const ChangeLog = require('../models/changeLog')
const Cfd = require('../models/cfdTable')
const Feature = require('../models/feature')


const byIssuetypeName = async (name) => {
  return await Ticket.find({
    'fields.issuetype.name': name
  })
}

const issuesByParentOrOutwardLinkId = async (issueId, issuetype) => {
  return await Ticket.find({
    $and: [
      {
        $or: [
          {
            'fields.issuelinks.outwardIssue.id': issueId
          },
          {
            'fields.parent.id': issueId
          },
        ],
      },
      {
        'fields.issuetype.name': issuetype
      }
    ]
  })
}

const issuesByParentOrOutwardLinkKey = async (key, issuetype) => {
  return await Ticket.find({
    $and: [
      {
        $or: [
          {
            'fields.issuelinks.outwardIssue.key': key
          },
          {
            'fields.parent.key': key
          },
        ],
      },
      {
        'fields.issuetype.name': issuetype
      }
    ]
  }, { 'key': 1 })
}

const storiesByOutwardLinkId = async (linkId) => {
  return await Ticket.find({
    $and: [
      {
        'fields.issuelinks.outwardIssue.id': linkId
      },
      {
        'fields.issuetype.name': 'Story'
      }
    ]
  })
}

const storiesByParentId = async (parentId, issuetype) => {
  return await Ticket.find({
    $and: [
      {
        'fields.parent.id': parentId
      },
      {
        'fields.issuetype.name': issuetype
      }
    ]
  })
}

const storiesByParentKey = async (key, issuetype) => {
  return await Ticket.find({
    $and: [
      {
        'fields.parent.key': key
      },
      {
        'fields.issuetype.name': issuetype
      }
    ]
  }, { 'key': 1 })
}

const storiesTasksAndBugsByParentId = async (parentId) => {
  return await Ticket.find({
    $and: [
      {
        'fields.parent.id': parentId
      },
      {
        $or: [
          {
            'fields.issuetype.name': 'Story'
          },
          {
            'fields.issuetype.name': 'Task'
          },
          {
            'fields.issuetype.name': 'Bug'
          },
        ]
      },
    ]
  })
}

const inwardLinksForFeature = async (featureKey) => {
  // get keys from stories in features inwardIssue and has type 'Feature Link'
  // get from Stories? There are also Tasks and probably Bugs also.
  return await Ticket.find({
    $and: [
      {
        'key': featureKey
      },
      {
        'fields.issuelinks.type': 'Feature link'
      }
    ]
  }, { 'fields.issuelinks': 1 })
}

const ticketByKey = async (key) => {
  return await Ticket.find({
    'key': key
  })
}

const changeLogs = async () => {
  return await ChangeLog.find({})
}

// use issue.key; bad naming for issueId
const changelogByIssueId = async (key) => {
  return await ChangeLog.find({ 'issueId': key })
}

const cfdByEpic = async (key) => {
  return await Cfd.find({ 'epic': key })
}

const cfdByEpicAndStatus = async (key, status) => {
  return await Cfd.find({ 'epic': key, 'status': status })
}

const insertFeatures = async (features) => {
  return await Feature.insertMany([...features])
}

const getFeaturesFromDB = async () => {
  return await Feature.find({})
}

const getFeatureByKeyFromDB = async (key) => {
  return await Feature.find({ 'feature': key })
}

const insertCfds = async (array) => {
  return await Cfd.insertMany([...array])
}

const cfdFeatureByDate = async (date, featureName) => {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  return await Cfd.find({
    $and: [
      { 'time': { '$gte': startOfDay, '$lte': endOfDay } },
      { 'feature': featureName },
      {
        $or: [
          { 'status': 'To Do' },
          { 'status': 'Done' },
          { 'status': 'In Progress' },
        ]
      }
    ]
  })
}

module.exports = {
  storiesByParentId,
  byIssuetypeName,
  storiesByOutwardLinkId,
  issuesByParentOrOutwardLinkId,
  issuesByParentOrOutwardLinkKey,
  changeLogs,
  changelogByIssueId,
  ticketByKey,
  storiesTasksAndBugsByParentId,
  cfdByEpic,
  cfdByEpicAndStatus,
  storiesByParentKey,
  inwardLinksForFeature,
  insertFeatures,
  getFeaturesFromDB,
  cfdFeatureByDate,
  insertCfds,
  getFeatureByKeyFromDB
}
