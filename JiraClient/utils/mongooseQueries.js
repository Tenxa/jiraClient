const Ticket = require('../models/ticket')
const ChangeLog = require('../models/changeLog')


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
  return await ChangeLog.find({'issueId': key})
}


module.exports = {
  storiesByParentId,
  byIssuetypeName,
  storiesByOutwardLinkId,
  issuesByParentOrOutwardLinkId,
  changeLogs,
  changelogByIssueId,
  ticketByKey
}
