const jiraDbRouter = require('express').Router()
const utils = require('../utils/utils')
const config = require('../utils/config')
const JiraClient = require('jira-connector')
const Issue = require('../models/issue')
const ChangeLog = require('../models/changeLog')
const AtlassianUser = require('../models/atlassianUser')
const IssueType = require('../models/issueType')
require('express-async-errors')


jiraDbRouter.get('/issues', async (req, res) => {
    console.log('/issues')
    const issues = await Issue.find({}).populate({
        path: 'fields',
        populate: {
            path: 'issuetype',
            model: 'IssueType'
        }
    })
    console.log(issues)
    res.json(issues.map(issue => issue.toJSON()))
})

jiraDbRouter.get('/changeLogs', async (req, res) => {
    console.log('/changeLogs')
    // Populate ei toimi vielä. Jokin ongelma, kun se on sisäkkäinen viittaus.
    //const changeLogs = await ChangeLog.find({})
    const changeLogs = await ChangeLog.find({}).populate({
        path: 'values',
        populate: {
            path: 'author',
        }
    })
    console.log(changeLogs)
    res.json(changeLogs.map(log => log.toJSON()))
})

jiraDbRouter.get('/istype', async (req, res) => {
    const types = await IssueType.find({})
    res.json(types.map((e) => e.toJSON()))
})

module.exports = jiraDbRouter