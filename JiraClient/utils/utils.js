
const JiraClient = require('jira-connector')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const AtlassianUser = require('../models/atlassianUser')
const ChangeLogValue = require('../models/changeLogValue')

const createJiraToken = () => {
  //console.log(config.jiraUser + ':' + config.jiraToken);
  //console.log('Basic ' + Buffer.from(config.jiraUser + ':' + config.jiraToken).toString('base64'));
  return Buffer.from(config.jiraUser + ':' + config.jiraToken).toString('base64')
  //return 'Basic ' + config.jiraUser + ':' + config.jiraPsw
}

const createJiraTokenFromPsw = () => {
  console.log(config.jiraDevLabsUser + ':' + config.jiraDevLabsPsw);
  console.log('Basic ' + Buffer.from(config.jiraDevLabsUser + ':' + config.jiraDevLabsPsw).toString('base64'));
  return Buffer.from(config.jiraDevLabsUser + ':' + config.jiraDevLabsPsw).toString('base64')
  //return 'Basic ' + config.jiraUser + ':' + config.jiraPsw
}

const createJiraClientWithToken = () => {
  const jira = new JiraClient({
    host: config.jiraURL,
    basic_auth: {
      base64: createJiraToken()
    }
  })
  return jira
}

const createJiraClientWithMailAndToken = () => {
  const jira = new JiraClient({
    host: config.jiraURL,
    basic_auth: {
      email: config.jiraDevLabsUser.trim(),
      api_token: config.jiraToken.trim()
    },
    strictSSL: false,
    apiVersion: '2',
  })
  return jira
}

//const getTokenFrom = (request) => {
//
//  try {
//    const authorization = request.get('Authorization')
//    console.log('authorization', authorization)
//    if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
//      console.log('index to subst', authorization.lastIndexOf('bearer ') + 7)
//      return authorization.substring(authorization.lastIndexOf('bearer ') + 7)
//    }
//    return null
//  }
//  catch (e)  {
//    console.log(e)
//  }
//}

const isValidCall = (request) => {
  try {
    const body = request.body

    //const token = getTokenFrom(request)
    const token = request.headers.authorization.split(' ')[1]
    let decodedToken = undefined
    if (token) {
      decodedToken = jwt.verify(token, process.env.SECRET)
    }


    if (!token || !decodedToken.id) {
      return { 'statuscode': 401, 'status': 'token missing or invalid' }
    }

    if (body === undefined) {
      return { 'statuscode': 400, 'status': 'content missing' }
    }
    else {
      return { 'statuscode': 200, 'status': 'OK', 'id': decodedToken.id }
    }
  }
  catch (e) {
    console.log(e)
    return { 'statuscode': 500, 'status': 'epicFail' }
  }
}

const isUser = async (addr) => {
  return await AtlassianUser.findOne({ emailAddress: addr }, (err, user) => !!user)
}

const isChangeValue = async (date) => {
  return await ChangeLogValue.findOne({ created: date }, (err, cv) => !!cv)
}

const removeObjId = (obj) => {
  let {...a} = obj
  let {_id, ...doc} = a._doc
  //console.log(doc)
  return doc
}

const compareChangeLogs = (obj1, obj2) => {
  if (obj1.self === obj2.self) {
    return true
  }
  if (obj1.total === obj2.total) {
    return true
  }
  return false
}

module.exports = {
  isValidCall,
  createJiraToken,
  createJiraTokenFromPsw,
  createJiraClientWithToken,
  createJiraClientWithMailAndToken,
  isUser,
  isChangeValue,
  removeObjId,
  compareChangeLogs
}
