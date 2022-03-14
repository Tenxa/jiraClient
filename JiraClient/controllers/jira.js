const jiraRouter = require('express').Router()
const utils = require('../utils/utils')
const mongooseQuery = require('../utils/mongooseQueries')
const Issue = require('../models/issue')
require('express-async-errors')
const Ticket = require('../models/ticket')


// const jira = utils.jiraClientV2()
// const agile = utils.jiraAgileClient()

// try {
//   const epics = await jira.issueSearch.searchForIssuesUsingJql({
//     jql: 'issuetype = Epic'
//   });

//   const epicsIssues = epics.issues.map(async (epic) => {
//     // todo: if total exceeds maxResults = 50 do another round
//     const issuesInEpic = await agile.epic.getIssuesForEpic({
//       epicIdOrKey: epic.id
//     })
//     return {
//       ...epic,
//       issuesInEpic: issuesInEpic.issues
//     }
//   })
//   const result = await Promise.all(epicsIssues)
//   response.json(result)

// } catch (error) {
//   console.log(error)
//   response.status(404).end()
// }


//
jiraRouter.get('/epics', async (request, response) => {
  // find all epics that with statuses
  const epics = await mongooseQuery.mongooseEpics()
  //console.log(epics.map(epic => epic.id))

  // get all Features with an epic as parent
  const ya = epics.map(async (epic) => {
    const featuresForEpic = await mongooseQuery.featuresInEpic(epic.id)

    // next get all stories in the features. ^ returns a list of features.
    // lets map through the features and query for stories. Then add a counter for story statuses
    // return a feature doc that has the status fields...
    if (featuresForEpic.length === 0) return
    const mapStoriesToFeature = await featuresForEpic.map(async (feature) => {
      const storiesForFeature = await mongooseQuery.storiesInFeature(feature.id)
      return storiesForFeature
    })
    //console.log(await Promise.all(mapStoriesToFeature))
    return await Promise.all(mapStoriesToFeature)

  })

  const resolveArray = await Promise.all(ya)
  const filterUndefined = await resolveArray.flat().filter(a => a !== undefined)
  response.json(filterUndefined.flat().map(issue => {
    return {
      id: issue.id,
      key: issue.key,
      fields: {
        parents: issue.fields.parent,
        issuetype: issue.fields.issuetype,
        status: issue.fields.status,
        fixVersions: issue.fields.fixVersions
      }
    }
  }))



  // const tp = await mongooseQuery.ticketsByParent('31658')
  // console.log(tp.map(t => t.id))
  // const feature = await mongooseQuery.featuresInEpic('31628')
  // console.log(feature.map(f => f.id))

})

// Tarkista vielä vaikuttaako miten tuo changelog maxResult = 100 mitenkä
// Tarvitaanko parametreja changelog "created", jotta ei haeta koko historiaa?
// Toisaalta, grafana voi hoitaa haun tietokannasta omilla parametreilla?.
jiraRouter.get('/cl', async (request, response, next) => {
  const idAndMongoId = await Issue.find({}, { id: 1 })
    .then(result => result)
    .catch(error => console.log(error))

  const idOnly = idAndMongoId.map(is => parseInt(is.id))

  try {
    const updatedResults = await utils.changeLogsByIdArrayV2(idOnly)
    //console.log(updatedResults)
    response.json({ ...updatedResults })
  } catch (error) {
    console.log(error)
    response.status(404).end()
  }
})

// 1. suodatetaan issue collecionista epicit ja viedään omaan epics collectioniin.
// 2. Tehdäänkö Epic collectioni tietokantaan. Vai käytetäänkö tätä sovellista rajapintana
// Grafanalle. Jolloin riittäisi laittaa suodatuksen tulos responseen.
// 3. Epicit suoraan jirasta saadaan /search endpointista 
jiraRouter.get('/epicsFromDB', async (request, response) => {
  const epicsFromDb = await Issue.find({ 'fields.issuetype.name': "Epic" })
  response.json(epicsFromDb)
})

// Upserttaa samalla tietokantaan.
jiraRouter.post('/search', async (request, response) => {
  if (!request.body.jql) {
    return response.send({
      error: 'You must provide a JQL query'
    })
  }
  const jql = request.body.jql
  const startAt = 0
  const maxResults = 10

  try {
    const resArray = await utils.issueSearchLoop(startAt, maxResults, jql)
    response.json({ ...resArray })
  } catch (error) {
    console.log('error at api/jira/search', error)
    response.status(404).end()
  }
})


jiraRouter.get('/:id', async (request, response) => {
  try {
    const issue = await jiraGetIssue(request.params.id)
    response.json({ ...issue })
  } catch (error) {
    console.error(error)
  }
})



// Käyttää Jira /search endpointtia ja hakee kaikki issuet looppaamalla,
// jos kaikki ei mahdu yhteen responseen.
jiraRouter.post('/', async (request, response, next) => {
  console.log('Getting all issues with Search');

  // API dokumentaation mukaan maxResult defaulttina 50.
  // Kokeiltavana vielä maxResultin nostamista. Ensin pitäisi tehdä lisää testi dataa.
  let startAt = 0
  let maxResults = 10
  let jql = 'ORDER BY Created DESC'

  try {
    const resArray = await utils.issueSearchLoop(startAt, maxResults, jql)
    response.json({ ...resArray })
  } catch (error) {
    console.log('error at api/jira/', error)
    response.status(404).end()
  }
})


const jiraGetIssue = async (issueKey) => {
  const jira = utils.createJiraClientWithToken()
  const issue = await jira.issue.getIssue({
    issueKey: issueKey
  })
  return issue
}


module.exports = jiraRouter
